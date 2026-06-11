// ============================================================
//  swarm/runner.js  —  Sub-Agent Runner Loop
// ============================================================

const { getCWD } = require("../server/lib/cwd");
const { askOllama } = require("../server/lib/ollama");
const { cleanJson } = require("../shared/json");
const { SUB_AGENTS } = require("./agents");
const { TOOLS } = require("./tools");
const { SWARM_MAX_STEPS, SWARM_STEP_TIMEOUT } = require("../shared/constants");

const TOOL_DOCS = `
## Available Tools & Parameter Schemas
- read_file: {"path": "relative/or/absolute/file/path"}
  Description: Reads the contents of a file.
- write_file: {"path": "relative/or/absolute/file/path", "content": "full contents of the file"}
  Description: Creates a new file or overwrites an existing file.
- replace_text: {"path": "relative/or/absolute/file/path", "old": "exact old text to replace", "new": "new replacement text"}
  Description: Replaces a specific block of text in a file.
- run_command: {"command": "shell command string"}
  Description: Runs a command in the terminal.
- list_files: {"path": "directory path"}
  Description: Lists files in a directory.
- search_in_files: {"pattern": "search pattern", "directory": "directory to search"}
  Description: Searches for text patterns across files.
- create_dir: {"path": "directory path"}
  Description: Creates a directory recursively.
- delete_file: {"path": "file or directory path"}
  Description: Deletes a file or directory.
- python_eval: {"code": "python code"}
  Description: Evaluates python code.
- git_status: {}
  Description: Gets the current git status.
- git_diff: {"file": "optional file path"}
  Description: Gets the current git diff.
- grep: {"pattern": "regex pattern", "path": "directory path"}
  Description: Runs grep in the workspace.
- cd: {"path": "directory path"}
  Description: Changes the current working directory.
- search_web: {"query": "search term"}
  Description: Searches DuckDuckGo.
- screenshot: {"url_or_path": "url or file path"}
  Description: Takes a screenshot of a URL or HTML file.

## CRITICAL RULES FOR MULTI-AGENT SWARM:
1. **TOOL USAGE IS REQUIRED**: If your task requires you to create, modify, delete, or run files/scripts, you **MUST** invoke the correct tool (e.g., 'write_file', 'replace_text', 'run_command'). Do **NOT** just provide the code in your 'thought' or 'result' fields and assume it will be written. If you don't call the tool, the file will not be changed.
2. **JSON Format**: Respond ONLY with a single valid JSON object. No markdown block wrapping (no \`\`\`json). Escape all newlines as \\n inside JSON string values.
3. **Execution Loop**: You can call one tool per step. Once you run a tool, the framework will execute it and return the result as a user message in the next step. Inspect the result, then call another tool or finish.
`;

/**
 * Runs a single sub-agent on a specific subtask.
 */
async function runSubAgent({ agentId, task, context, model, onEvent, maxSteps = SWARM_MAX_STEPS }) {
  const agentDef = SUB_AGENTS[agentId];
  if (!agentDef) throw new Error(`Unknown agent: ${agentId}`);

  const messages = [
    { 
      role: "system", 
      content: `${agentDef.system}\n\n[CWD]: ${getCWD()}\n\n${TOOL_DOCS}${context ? `\n\n[CONTEXT FROM PREVIOUS AGENTS]\n${context}` : ""}` 
    },
    { role: "user",   content: task },
  ];

  onEvent({ type: "agent_start", agent: agentId, task });

  let toolsUsed = 0;

  for (let step = 1; step <= maxSteps; step++) {
    onEvent({ type: "agent_step", agent: agentId, step, message: `${agentDef.emoji} ${agentDef.name} — step ${step}` });

    if (step === maxSteps) {
      messages.push({
        role: "user",
        content: `CRITICAL: This is your absolute LAST step. You MUST NOT call any more tools. Summarize all your findings and work so far, and finish by returning the Finished JSON format: {"thought": "summary of findings so far", "result": "your findings", "context": {...}}`
      });
    }

    let raw;
    try {
      raw = await askOllama(messages, model, SWARM_STEP_TIMEOUT);
    } catch (e) {
      onEvent({ type: "agent_error", agent: agentId, message: e.message });
      return { error: e.message, agent: agentId };
    }

    let data;
    try {
      const cleaned = cleanJson(raw);
      data = JSON.parse(cleaned);
      
      if (data.__plain__ || (!data.tool && data.result === undefined && data.final === undefined)) {
        throw new Error("Plain text or incomplete JSON response");
      }
    } catch (err) {
      onEvent({ type: "agent_thought", agent: agentId, message: "⚠️ Response format invalid. Prompting for correct JSON..." });
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `ERROR: Your response was not formatted as a valid JSON object.
You must respond with ONLY a single JSON object.
If you want to use a tool, respond with:
{"thought": "reasoning", "tool": "tool_name", "args": {...}}

If you are finished, respond with:
{"thought": "reasoning", "result": "accomplishments summary", "files_changed": [...]}`
      });
      continue;
    }

    if (data.thought) {
      onEvent({ type: "agent_thought", agent: agentId, message: data.thought });
    }

    const toolName = data.tool;
    const args = data.args || {};

    if (toolName && typeof toolName === "string" && toolName.trim() !== "") {
      toolsUsed++;
      const fn = TOOLS[toolName];
      const toolResult = fn ? String(await Promise.resolve(fn(args))) : `ERROR: unknown tool '${toolName}'`;

      onEvent({ type: "agent_tool", agent: agentId, tool: toolName, args, result: toolResult.slice(0, 500) });

      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `[Tool result: ${toolName}]\n${toolResult}` });
      continue;
    }

    // Finished?
    if (data.result !== undefined || data.final !== undefined) {
      if (toolsUsed === 0) {
        messages.push({ role: "assistant", content: raw });
        messages.push({ role: "user", content: "ERROR: You cannot finish without using any tools! You MUST use at least one tool (like 'list_files', 'read_file', 'write_file', or 'run_command') to perform actual work or gather information before returning a result." });
        continue;
      }
      const result = data.result ?? data.final;
      onEvent({ type: "agent_done", agent: agentId, result, data });
      return { agent: agentId, result, data, steps: step };
    }

    // No tool and no result
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: "ERROR: You must either provide a 'tool' to call, or a 'result' to finish. Please provide a valid JSON." });
  }

  return { agent: agentId, result: "Max steps reached", truncated: true };
}

module.exports = { runSubAgent };
