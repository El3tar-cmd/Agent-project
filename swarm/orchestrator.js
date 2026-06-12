// ============================================================
//  swarm/orchestrator.js  —  Swarm Orchestrator
// ============================================================

const { getCWD } = require("../server/lib/cwd");
const { askOllama } = require("../server/lib/ollama");
const { cleanJson } = require("../shared/json");
const { SUB_AGENTS } = require("./agents");
const { runSubAgent } = require("./runner");
const { SWARM_MAX_ROUNDS, SWARM_MAX_STEPS } = require("../shared/constants");

/**
 * Validate and auto-correct plans for file writing tasks to ensure they contain a writer agent.
 */
function validateAndFixPlan(archPlan, task) {
  const lowerTask = task.toLowerCase();
  const needsWriting = ["create", "write", "generate", "add", "implement", "make", "test", "fix", "new", "build"].some(w => lowerTask.includes(w));
  
  if (!needsWriting) return archPlan;
  
  // If the architect answered directly with "final" but the task needs writing, remove "final" so we run subtasks
  if (archPlan.final) {
    delete archPlan.final;
  }
  
  if (!archPlan.subtasks) {
    archPlan.subtasks = [];
  }
  
  const subtasks = archPlan.subtasks;
  const hasWriter = subtasks.some(t => ["coder", "tester", "devops", "docs"].includes(t.agent));
  
  if (!hasWriter) {
    if (subtasks.length === 0) {
      // No subtasks at all, fallback to a 2-task plan
      subtasks.push(
        { id: "t1", agent: "researcher", task: "Explore the project structure and context for the task", depends_on: [], priority: 1 },
        { id: "t2", agent: lowerTask.includes("test") ? "tester" : "coder", task: `Write/implement the requested changes: ${task}`, depends_on: ["t1"], priority: 2 }
      );
    } else {
      // Append a coder/tester task dependent on the last task
      const lastTask = subtasks[subtasks.length - 1];
      const agent = lowerTask.includes("test") ? "tester" : "coder";
      subtasks.push({
        id: `t_auto_${subtasks.length + 1}`,
        agent,
        task: `Write/implement the requested changes based on gathered findings: ${task}`,
        depends_on: [lastTask.id],
        priority: (lastTask.priority || 1) + 1
      });
    }
  }
  
  return archPlan;
}

/**
 * Coordinate planning, execution, and synthesis of sub-agent swarm tasks.
 */
async function runOrchestrator({ task, model, onEvent, maxRounds = SWARM_MAX_ROUNDS }) {
  onEvent({ type: "orchestrator_start", task });

  // ── STEP 1: Architect plans ──────────────────────────────
  onEvent({ type: "phase", phase: "planning", message: "🏗 Architect is planning…" });

  const archMessages = [
    { role: "system", content: `${SUB_AGENTS.architect.system}\n\n[CWD]: ${getCWD()}` },
    { role: "user",   content: `Plan how to accomplish this task:\n\n${task}` },
  ];

  let archRaw, archPlan;
  try {
    archRaw = await askOllama(archMessages, model, 120000);
    archPlan = JSON.parse(cleanJson(archRaw));
  } catch (e) {
    onEvent({ type: "error", message: `Architect failed: ${e.message}` });
    // Fallback: treat whole task as coder task
    archPlan = { subtasks: [{ id: "t1", agent: "coder", task, depends_on: [], priority: 1 }] };
  }

  // Validate and auto-correct the plan if it's missing coder/tester tasks
  archPlan = validateAndFixPlan(archPlan, task);

  onEvent({ type: "plan", plan: archPlan });

  // If architect answered directly
  if (archPlan.final) {
    onEvent({ type: "final", message: archPlan.final, source: "architect" });
    return;
  }

  const subtasks = archPlan.subtasks || [];
  if (!subtasks.length) {
    onEvent({ type: "error", message: "Architect produced no subtasks" });
    return;
  }

  // ── STEP 2: Execute subtasks (respecting dependencies) ───
  onEvent({ type: "phase", phase: "execution", message: `⚡ Executing ${subtasks.length} subtasks…` });

  const results = {};      // taskId → result
  const completed = new Set();
  const remaining = [...subtasks];
  let round = 0;

  while (remaining.length > 0 && round < maxRounds * subtasks.length) {
    round++;

    // Find tasks whose dependencies are all completed
    const ready = remaining.filter(t =>
      (t.depends_on || []).every(dep => completed.has(dep))
    );

    if (ready.length === 0) {
      onEvent({ type: "error", message: "Dependency deadlock — running remaining tasks anyway" });
      ready.push(...remaining);
    }

    // Sort by priority
    ready.sort((a, b) => (a.priority || 5) - (b.priority || 5));

    // Group tasks that can run in parallel (same priority, no inter-deps)
    const batch = [];
    const seenPriority = ready[0]?.priority;
    for (const t of ready) {
      if (t.priority === seenPriority || batch.length === 0) {
        batch.push(t);
      } else {
        break;
      }
    }

    onEvent({ type: "batch_start", batch: batch.map(t => ({ id: t.id, agent: t.agent, task: t.task })) });

    // Build rich context for this batch from ALL previous results
    const prevContext = Object.entries(results)
      .map(([id, r]) => {
        const t = subtasks.find(s => s.id === id);
        const result = typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2);
        return `### ${SUB_AGENTS[r.agent]?.emoji} ${SUB_AGENTS[r.agent]?.name} completed: "${t?.task || id}"\n${result}`;
      })
      .join("\n\n---\n\n")
      .slice(0, 15000);

    // For each task in batch, build its specific context including only its dependencies
    const batchPromises = batch.map(t => {
      const depContext = (t.depends_on || [])
        .map(depId => {
          const r = results[depId];
          if (!r) return '';
          const depTask = subtasks.find(s => s.id === depId);
          return `### Result from ${SUB_AGENTS[r.agent]?.name} (${depId}): "${depTask?.task || depId}"\n${typeof r.result === 'string' ? r.result : JSON.stringify(r.result)}`;
        })
        .join("\n\n---\n\n")
        .slice(0, 20000);

      const ctx = depContext || prevContext || archPlan.plan || '';

      // Different agents need different step budgets
      const agentMaxSteps = {
        researcher: 100, // needs many steps to read all files thoroughly
        tester: 90,      // needs to read source + write tests + run them
        coder: 85,       // needs to read context + write code + verify
        docs: 70,        // needs to read source + write docs
        reviewer: 60,    // reads and analyzes
        devops: 75,      // writes configs + runs commands
      };

      return runSubAgent({
        agentId:  t.agent,
        task:     t.task,
        context:  `## Original User Task\n${task}\n\n## Context from Previous Agents\n${ctx}`,
        model,
        onEvent,
        maxSteps: agentMaxSteps[t.agent] || SWARM_MAX_STEPS,
      }).then(r => ({ ...r, taskId: t.id }));
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const settled of batchResults) {
      const r = settled.status === "fulfilled" ? settled.value : { error: settled.reason?.message, agent: "unknown" };
      const taskId = r.taskId || batch[batchResults.indexOf(settled)]?.id;
      results[taskId] = r;
      completed.add(taskId);
      remaining.splice(remaining.findIndex(t => t.id === taskId), 1);
    }
  }

  // ── STEP 3: Synthesize results ───────────────────────────
  onEvent({ type: "phase", phase: "synthesis", message: "🧬 Synthesizing results…" });

  const synthesis = Object.entries(results).map(([id, r]) => {
    const t = subtasks.find(s => s.id === id);
    const resultText = r.result != null
      ? (typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 2))
      : (r.error ? `ERROR: ${r.error}` : "(no output)");
    return `## ${SUB_AGENTS[r.agent]?.emoji || "•"} ${SUB_AGENTS[r.agent]?.name || r.agent} (${id})\nTask: ${t?.task || "?"}\nResult: ${resultText}`;
  }).join("\n\n---\n\n");

  const synthMessages = [
    { role: "system", content: `You are a synthesis agent. Combine the results of multiple specialized agents into a clear, concise summary for the user. Highlight what was accomplished, any issues found, and next steps.` },
    { role: "user",   content: `Original task: ${task}\n\nAgent Results:\n\n${synthesis}\n\nWrite a clear summary of what was accomplished.` },
  ];

  let finalMsg = "All agents completed their tasks.";
  try {
    const synthRaw = await askOllama(synthMessages, model, 60000);
    // Synthesis prompt asks for plain text — use it directly without JSON parsing
    finalMsg = synthRaw.trim() || `Completed ${Object.keys(results).length} subtasks.`;
  } catch {
    // build simple summary from results if synthesis fails
    finalMsg = `Completed ${Object.keys(results).length} subtasks:\n\n` +
      Object.entries(results).map(([id, r]) => {
        const t = subtasks.find(s => s.id === id);
        return `• ${SUB_AGENTS[r.agent]?.emoji} **${SUB_AGENTS[r.agent]?.name}**: ${t?.task || id}`;
      }).join("\n");
  }

  onEvent({ type: "final", message: finalMsg, synthesis, results });
}

module.exports = { runOrchestrator };
