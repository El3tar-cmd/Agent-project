// ============================================================
//  AGENT SWARM  —  Orchestrator + Parallel Sub-Agents
//  Endpoint: POST /api/swarm  (SSE stream)
// ============================================================

const { execSync } = require("child_process");
const http = require("http");
const fs   = require("fs");
const path = require("path");

// ─── SWARM CONFIG ─────────────────────────────────────────
const SWARM_MAX_STEPS    = 100;
const SWARM_STEP_TIMEOUT = 300000;  // 5 min per Ollama call
const SWARM_MAX_ROUNDS   = 5;
const SUB_AGENTS = {
  architect: {
    name: "Architect",
    emoji: "🏗",
    color: "#58a6ff",
    description: "Plans structure, breaks tasks into subtasks, decides which agents to use",
    system: `You are the Architect agent. You analyze tasks and produce an execution plan.

AVAILABLE AGENTS:
- researcher: reads files, investigates codebase, gathers information — USE FIRST for any task needing file knowledge
- coder: writes/edits code files — needs researcher context first
- reviewer: reviews code for bugs/quality — runs after coder
- tester: writes and runs tests — runs after coder
- docs: writes documentation — needs researcher context, depends on coder output
- devops: handles deployment/scripts/CI

RULES:
1. For tasks needing file reading, ALWAYS start with researcher tasks (priority 1)
2. Coding tasks depend on researcher tasks (priority 2)
3. Review/test/docs tasks depend on coding tasks (priority 3)
4. Use depends_on to chain tasks correctly — docs MUST depend on researcher tasks
5. Keep task descriptions specific and actionable
6. Maximum 8 subtasks total

Response format — ONLY valid JSON, no markdown:
{
  "thought": "analysis of the task and what agents are needed",
  "plan": "brief strategy",
  "subtasks": [
    {"id": "t1", "agent": "researcher", "task": "specific task", "depends_on": [], "priority": 1},
    {"id": "t2", "agent": "coder", "task": "specific task using t1 findings", "depends_on": ["t1"], "priority": 2}
  ]
}

If the task is trivial (no file access needed, simple question):
{"thought": "simple task", "final": "direct answer here"}`,
  },

  coder: {
    name: "Coder",
    emoji: "⚡",
    color: "#3fb950",
    description: "Writes, edits, and refactors code",
    system: `You are the Coder agent. You write clean, efficient, well-structured code.
You always read files before editing them. You prefer small targeted changes over rewrites.
You follow existing code style and conventions.

Available tools: read_file, write_file, replace_text, run_command, list_files, create_dir, python_eval

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"what was accomplished","files_changed":["path1","path2"]}`,
  },

  reviewer: {
    name: "Reviewer",
    emoji: "🔍",
    color: "#d29922",
    description: "Reviews code for bugs, security issues, and improvements",
    system: `You are the Reviewer agent. You analyze code for:
- Bugs and logical errors
- Security vulnerabilities
- Performance issues
- Code style and maintainability
- Missing edge cases

Available tools: read_file, list_files, grep, search_in_files, git_diff

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"review findings","issues":[{"severity":"high|medium|low","file":"path","line":0,"description":"issue"}],"suggestions":["suggestion1"]}`,
  },

  tester: {
    name: "Tester",
    emoji: "🧪",
    color: "#bc8cff",
    description: "Writes tests and validates code correctness",
    system: `You are the Tester agent. You write comprehensive tests and validate implementations.
You create unit tests, integration tests, and edge case tests.
You run existing tests to check for regressions.

Available tools: read_file, write_file, run_command, list_files, python_eval

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"test results","tests_written":["path"],"tests_passed":0,"tests_failed":0,"failures":[]}`,
  },

  docs: {
    name: "Docs",
    emoji: "📚",
    color: "#f0c060",
    description: "Writes documentation, README, and code comments",
    system: `You are the Docs agent. You write clear, comprehensive documentation.
You read the actual code to write accurate docs. You use examples and explain why, not just what.
You write README files, inline comments, JSDoc/docstrings, and API references.

Available tools: read_file, write_file, list_files, search_in_files

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"documentation written","files_created":["path"]}`,
  },

  researcher: {
    name: "Researcher",
    emoji: "🔬",
    color: "#79c0ff",
    description: "Investigates codebase, finds patterns, gathers context",
    system: `You are the Researcher agent. You investigate codebases and gather information.
You find relevant files, understand patterns, identify dependencies, and summarize findings.
You are thorough but concise — you find what other agents need to do their work.

Available tools: read_file, list_files, grep, search_in_files, git_status, git_diff

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"findings","context":{"key_files":[],"patterns":[],"dependencies":[]}}`,
  },

  devops: {
    name: "DevOps",
    emoji: "🚀",
    color: "#ff7b72",
    description: "Handles deployment, scripts, CI/CD, and infrastructure",
    system: `You are the DevOps agent. You handle deployment, automation, and infrastructure.
You write shell scripts, Docker configs, CI/CD pipelines, and deployment procedures.
You focus on reliability, reproducibility, and automation.

Available tools: read_file, write_file, run_command, list_files, create_dir

Response format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"tool_name","args":{...}}
Finished: {"thought":"summary","result":"what was configured/deployed","commands_run":["cmd1"]}`,
  },
};

// ══════════════════════════════════════════════════════════
//  TOOL EXECUTION (shared with main server)
// ══════════════════════════════════════════════════════════
const DANGEROUS = [/rm\s+-rf\s+\//, /rm\s+-rf\s+~/, /mkfs/, /dd\s+if=/, /sudo\s+rm/];

function getCWD() {
  try {
    const s = fs.readFileSync(".agent_state.json","utf8");
    return JSON.parse(s).cwd || process.cwd();
  } catch { return process.cwd(); }
}

function resolvePath(p) {
  const cwd = getCWD();
  return path.isAbsolute(p) ? p : path.resolve(cwd, p);
}

// ── ARG NORMALIZER — models use different key names ──────
function normPath(a) {
  return a.path || a.file_path || a.file || a.filepath || a.filename || "";
}
function normPattern(a) {
  return a.pattern || a.search || a.query || a.text || "";
}
function normDir(a) {
  return a.directory || a.dir || a.path || a.folder || ".";
}

const TOOLS = {
  read_file:       a => { const p=normPath(a); if(!p)return "ERROR: no path provided"; try { return fs.readFileSync(resolvePath(p),"utf8"); } catch(e){return `ERROR: ${e.message}`;} },
  write_file:      a => { const p=normPath(a); if(!p)return "ERROR: no path"; try { const abs=resolvePath(p); fs.mkdirSync(path.dirname(abs),{recursive:true}); fs.writeFileSync(abs,a.content||a.text||"","utf8"); return `Saved ${abs}`; } catch(e){return `ERROR: ${e.message}`;} },
  replace_text:    a => { const p=normPath(a); if(!p)return "ERROR: no path"; try { const abs=resolvePath(p); const t=fs.readFileSync(abs,"utf8"); const old=a.old||a.old_text||a.search||""; const nw=a.new||a.new_text||a.replacement||""; if(!old)return "ERROR: no old text"; if(!t.includes(old))return `ERROR: pattern not found in ${p}`; fs.writeFileSync(abs,t.replace(old,nw),"utf8"); return `Updated ${abs}`; } catch(e){return `ERROR: ${e.message}`;} },
  list_files:      a => { const p=a.path||a.directory||a.dir||"."; try { return fs.readdirSync(resolvePath(p),{withFileTypes:true}).map(e=>`${e.isDirectory()?"📁":"📄"} ${e.name}`).join("\n")||"(empty)"; } catch(e){return `ERROR: ${e.message}`;} },
  create_dir:      a => { const p=normPath(a)||a.directory||a.dir; if(!p)return "ERROR: no path"; try { fs.mkdirSync(resolvePath(p),{recursive:true}); return `Created: ${p}`; } catch(e){return `ERROR: ${e.message}`;} },
  grep:            a => { const pat=normPattern(a); const p=a.path||a.directory||"."; return runCmd(`grep -rn "${pat}" "${resolvePath(p)}"`); },
  search_in_files: a => { const pat=normPattern(a); const dir=normDir(a); const res=[]; function walk(d){try{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else{try{fs.readFileSync(f,"utf8").split("\n").forEach((l,i)=>{if(l.toLowerCase().includes(pat.toLowerCase()))res.push(`${f}:${i+1}: ${l.trim()}`);});}catch{}}}}catch{}}walk(resolvePath(dir));return res.slice(0,50).join("\n")||`No matches for '${pat}'`; },
  git_status:      _  => runCmd("git status"),
  git_diff:        a  => runCmd(`git diff ${a.file||a.path||""}`.trim()),
  run_command:     a  => { const cmd=a.command||a.cmd||a.run||""; if(!cmd)return "ERROR: no command"; if(DANGEROUS.some(p=>p.test(cmd)))return "BLOCKED: dangerous command"; return runCmd(cmd); },
  python_eval:     a  => { const code=a.code||a.python||a.script||""; if(!code)return "ERROR: no code"; try{const tmp=`/tmp/_swarm_${Date.now()}.py`;fs.writeFileSync(tmp,code);const r=execSync(`python3 "${tmp}"`,{encoding:"utf8",timeout:10000,cwd:getCWD()});try{fs.unlinkSync(tmp);}catch{}return r.trim()||"(no output)";}catch(e){return `ERROR: ${e.stderr||e.message}`;} },
};

function runCmd(cmd) {
  try {
    return execSync(cmd,{encoding:"utf8",timeout:30000,maxBuffer:512*1024,cwd:getCWD()}).trim()||"(no output)";
  } catch(e) { return `EXIT:${e.status}\n${e.stderr||e.message}`; }
}

function cleanJson(raw) {
  const s = raw.replace(/```json\s*/g,"").replace(/```/g,"");
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s.trim();
}

// ══════════════════════════════════════════════════════════
//  OLLAMA CALL
// ══════════════════════════════════════════════════════════
async function callOllama(messages, model, timeout=180000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, stream:false, options:{temperature:0.15} });
    const req = http.request("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Content-Length":Buffer.byteLength(body) },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data).message.content); }
        catch(e) { reject(new Error(`Ollama parse error: ${data.slice(0,200)}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Ollama timeout")); });
    req.write(body); req.end();
  });
}

// ══════════════════════════════════════════════════════════
//  SUB-AGENT RUNNER
// ══════════════════════════════════════════════════════════
async function runSubAgent({ agentId, task, context, model, onEvent, maxSteps=SWARM_MAX_STEPS }) {
  const agentDef = SUB_AGENTS[agentId];
  if (!agentDef) throw new Error(`Unknown agent: ${agentId}`);

  const messages = [
    { role:"system", content:`${agentDef.system}\n\n[CWD]: ${getCWD()}${context?`\n\n[CONTEXT FROM PREVIOUS AGENTS]\n${context}`:""}` },
    { role:"user",   content: task },
  ];

  onEvent({ type:"agent_start", agent:agentId, task });

  for (let step=1; step<=maxSteps; step++) {
    onEvent({ type:"agent_step", agent:agentId, step, message:`${agentDef.emoji} ${agentDef.name} — step ${step}` });

    let raw;
    try { raw = await callOllama(messages, model, SWARM_STEP_TIMEOUT); }
    catch(e) { onEvent({ type:"agent_error", agent:agentId, message:e.message }); return { error:e.message, agent:agentId }; }

    let data;
    try { data = JSON.parse(cleanJson(raw)); }
    catch { onEvent({ type:"agent_done", agent:agentId, result:raw }); return { result:raw, agent:agentId, raw:true }; }

    if (data.thought) onEvent({ type:"agent_thought", agent:agentId, message:data.thought });

    // Finished?
    if (data.result !== undefined || data.final !== undefined) {
      const result = data.result ?? data.final;
      onEvent({ type:"agent_done", agent:agentId, result, data });
      return { agent:agentId, result, data, steps:step };
    }

    // Tool call
    const toolName = data.tool;
    const args     = data.args || {};
    if (!toolName) { messages.push({ role:"assistant", content:raw }); continue; }

    const fn = TOOLS[toolName];
    const toolResult = fn ? String(await Promise.resolve(fn(args))) : `ERROR: unknown tool '${toolName}'`;

    onEvent({ type:"agent_tool", agent:agentId, tool:toolName, args, result:toolResult.slice(0,500) });

    messages.push({ role:"assistant", content:raw });
    messages.push({ role:"user", content:`[Tool result: ${toolName}]\n${toolResult}` });
  }

  return { agent:agentId, result:"Max steps reached", truncated:true };
}

// ══════════════════════════════════════════════════════════
//  ORCHESTRATOR
// ══════════════════════════════════════════════════════════
async function runOrchestrator({ task, model, onEvent, maxRounds=SWARM_MAX_ROUNDS }) {
  onEvent({ type:"orchestrator_start", task });

  // ── STEP 1: Architect plans ──────────────────────────────
  onEvent({ type:"phase", phase:"planning", message:"🏗 Architect is planning…" });

  const archMessages = [
    { role:"system", content:`${SUB_AGENTS.architect.system}\n\n[CWD]: ${getCWD()}` },
    { role:"user",   content:`Plan how to accomplish this task:\n\n${task}` },
  ];

  let archRaw, archPlan;
  try {
    archRaw  = await callOllama(archMessages, model, 120000);
    archPlan = JSON.parse(cleanJson(archRaw));
  } catch(e) {
    onEvent({ type:"error", message:`Architect failed: ${e.message}` });
    // fallback: treat whole task as coder task
    archPlan = { subtasks:[{ id:"t1", agent:"coder", task, depends_on:[], priority:1 }] };
  }

  onEvent({ type:"plan", plan:archPlan });

  // If architect answered directly
  if (archPlan.final) {
    onEvent({ type:"final", message:archPlan.final, source:"architect" });
    return;
  }

  const subtasks = archPlan.subtasks || [];
  if (!subtasks.length) {
    onEvent({ type:"error", message:"Architect produced no subtasks" });
    return;
  }

  // ── STEP 2: Execute subtasks (respecting dependencies) ───
  onEvent({ type:"phase", phase:"execution", message:`⚡ Executing ${subtasks.length} subtasks…` });

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
      onEvent({ type:"error", message:"Dependency deadlock — running remaining tasks anyway" });
      ready.push(...remaining);
    }

    // Sort by priority
    ready.sort((a,b) => (a.priority||5) - (b.priority||5));

    // Group tasks that can run in parallel (same priority, no inter-deps)
    const batch = [];
    const seenPriority = ready[0]?.priority;
    for (const t of ready) {
      if (t.priority === seenPriority || batch.length===0) batch.push(t);
      else break;
    }

    onEvent({ type:"batch_start", batch:batch.map(t=>({id:t.id,agent:t.agent,task:t.task})) });

    // Build rich context for this batch from ALL previous results
    const prevContext = Object.entries(results)
      .map(([id,r]) => {
        const t = subtasks.find(s=>s.id===id);
        const result = typeof r.result==='string' ? r.result : JSON.stringify(r.result,null,2);
        return `### ${SUB_AGENTS[r.agent]?.emoji} ${SUB_AGENTS[r.agent]?.name} completed: "${t?.task||id}"\n${result}`;
      })
      .join("\n\n---\n\n")
      .slice(0, 8000); // increased from 3000

    // For each task in batch, build its specific context including only its dependencies
    const batchPromises = batch.map(t => {
      const depContext = (t.depends_on||[])
        .map(depId => {
          const r = results[depId];
          if (!r) return '';
          const depTask = subtasks.find(s=>s.id===depId);
          return `### Result from ${SUB_AGENTS[r.agent]?.name} (${depId}): "${depTask?.task||depId}"\n${typeof r.result==='string'?r.result:JSON.stringify(r.result)}`;
        })
        .join("\n\n---\n\n")
        .slice(0, 10000);

      const ctx = depContext || prevContext || archPlan.plan || '';

      return runSubAgent({
        agentId:  t.agent,
        task:     t.task,
        context:  ctx,
        model,
        onEvent,
        maxSteps: 20,
      }).then(r => ({ ...r, taskId:t.id }));
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const settled of batchResults) {
      const r = settled.status==="fulfilled" ? settled.value : { error:settled.reason?.message, agent:"unknown" };
      const taskId = r.taskId || batch[batchResults.indexOf(settled)]?.id;
      results[taskId] = r;
      completed.add(taskId);
      remaining.splice(remaining.findIndex(t=>t.id===taskId), 1);
    }
  }

  // ── STEP 3: Synthesize results ───────────────────────────
  onEvent({ type:"phase", phase:"synthesis", message:"🧬 Synthesizing results…" });

  const synthesis = Object.entries(results).map(([id, r]) => {
    const t = subtasks.find(s=>s.id===id);
    return `## ${SUB_AGENTS[r.agent]?.emoji||"•"} ${SUB_AGENTS[r.agent]?.name||r.agent} (${id})\nTask: ${t?.task||"?"}\nResult: ${typeof r.result==="string"?r.result:JSON.stringify(r.result,null,2)}`;
  }).join("\n\n---\n\n");

  const synthMessages = [
    { role:"system", content:`You are a synthesis agent. Combine the results of multiple specialized agents into a clear, concise summary for the user. Highlight what was accomplished, any issues found, and next steps.` },
    { role:"user",   content:`Original task: ${task}\n\nAgent Results:\n\n${synthesis}\n\nWrite a clear summary of what was accomplished.` },
  ];

  let finalMsg = "All agents completed their tasks.";
  try {
    const synthRaw = await callOllama(synthMessages, model, 60000);
    const parsed = JSON.parse(cleanJson(synthRaw));
    finalMsg = parsed.final || parsed.result || synthRaw;
  } catch {
    // build simple summary from results
    finalMsg = `Completed ${Object.keys(results).length} subtasks:\n\n` +
      Object.entries(results).map(([id,r]) => {
        const t=subtasks.find(s=>s.id===id);
        return `• ${SUB_AGENTS[r.agent]?.emoji} **${SUB_AGENTS[r.agent]?.name}**: ${t?.task||id}`;
      }).join("\n");
  }

  onEvent({ type:"final", message:finalMsg, synthesis, results });
}

// ══════════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════════
module.exports = { runOrchestrator, runSubAgent, SUB_AGENTS, TOOLS };
