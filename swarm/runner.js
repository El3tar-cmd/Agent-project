// ============================================================
//  swarm/runner.js  —  Sub-Agent Runner Loop
// ============================================================

const { getCWD } = require("../server/lib/cwd");
const { askOllama } = require("../server/lib/ollama");
const { cleanJson } = require("../shared/json");
const { SUB_AGENTS } = require("./agents");
const { TOOLS, WRITE_TOOLS, WRITE_REQUIRED_AGENTS } = require("./tools");
const { SWARM_MAX_STEPS, SWARM_STEP_TIMEOUT } = require("../shared/constants");

const TOOL_DOCS = `
## Available Tools & Parameter Schemas

### Filesystem
- read_file: {"path": "file path"} — reads file with line numbers
- read_lines: {"path": "file path", "start": 1, "end": 50} — read specific line range (use for large files)
- write_file: {"path": "file path", "content": "full file content"} — creates/overwrites a file
- append_file: {"path": "file path", "content": "text to append"} — appends to a file
- replace_text: {"path": "file path", "old": "exact text to find", "new": "replacement text"} — targeted edit
- list_files: {"path": "directory path"} — lists files (call ONCE per directory)
- search_in_files: {"pattern": "search text", "directory": "path"} — case-insensitive text search across files
- grep: {"pattern": "regex", "path": "directory"} — regex grep across files
- create_dir: {"path": "directory path"} — create directory and parents
- delete_file: {"path": "file or directory path"} — delete file or directory

### Shell & Code
- run_command: {"command": "shell command"} — run shell command, see stdout/stderr
- python_eval: {"code": "python code"} — execute Python code inline

### Git
- git_status: {} — current git status
- git_diff: {"file": "optional specific file"} — show diff

### Web & Network
- http_get: {"url": "https://..."} — fetch a URL and return cleaned text content
- http_post: {"url": "https://...", "body": {...}, "method": "POST", "headers": {}} — POST/PUT/PATCH to any API with JSON body
- search_web: {"query": "search terms"} — search the web via DuckDuckGo

### File Discovery & Archives
- find_files: {"pattern": "name", "directory": ".", "ext": "js", "maxdepth": 8} — find files by name/extension
- zip: {"action": "create|extract|list", "file": "out.zip", "source": "dir", "dest": "outdir"} — create or extract zip/tar.gz archives
- diff_files: {"file1": "a.js", "file2": "b.js"} — unified diff between any two files

### Code Quality
- lint: {"file": "path/to/file.js", "linter": "eslint|flake8|json|sh"} — run linter on code files

### Navigation
- cd: {"path": "directory path"} — change current working directory

### Reasoning & Deep Thinking
- think: {"thought": "your reasoning"} — internal planning step (no external side effects)
- sequential_thinking: {"thought": "step analysis", "thoughtNumber": 1, "totalThoughts": 3, "nextThoughtNeeded": true} — structured multi-step reasoning. Use for complex analysis before acting.

## CRITICAL RULES FOR MULTI-AGENT SWARM
1. **TOOL CALLS ARE REQUIRED**: You MUST use write_file, append_file, or replace_text to actually save files.
   Simply including file contents in your "result" field does NOT save anything to disk.
2. **JSON Format**: Respond ONLY with a single valid JSON object. No markdown, no code fences.
   Escape all newlines as \\\\n inside JSON strings.
3. **No repeated list_files**: Call list_files on any directory at most once. Use that knowledge.
4. **Use read_lines**: For large files, use read_lines with start/end instead of re-reading the whole file.
5. **Execution Loop**: Call one tool per step, wait for result, then call next tool or finish.
6. **Finish with result**: {"thought":"summary","result":"what was accomplished","files_changed":["path1"]}
7. **Be thorough**: Read ALL relevant files before acting. Do NOT cut corners.
`;

/**
 * Minimum files that should be read per agent type.
 * Researcher must read enough files to provide useful context.
 */
const MIN_FILES_READ = {
  researcher: 4,
  tester: 3,
  coder: 1,
  reviewer: 2,
  docs: 2,
  devops: 1,
};

/**
 * Runs a single sub-agent on a specific subtask.
 */
async function runSubAgent({ agentId, task, context, model, onEvent, maxSteps = SWARM_MAX_STEPS }) {
  const agentDef = SUB_AGENTS[agentId];
  if (!agentDef) throw new Error(`Unknown agent: ${agentId}`);

  const requiresWrite = WRITE_REQUIRED_AGENTS.has(agentId);

  const messages = [
    {
      role: "system",
      content: `${agentDef.system}\n\n[CWD]: ${getCWD()}\n\n${TOOL_DOCS}${context ? `\n\n[CONTEXT FROM PREVIOUS AGENTS]\n${context}` : ""}`
    },
    { role: "user", content: task },
  ];

  onEvent({ type: "agent_start", agent: agentId, task });

  let toolsUsed = 0;
  let writeToolsUsed = 0;
  let filesRead = 0;        // track how many files were actually read
  let noToolRetries = 0;
  const MAX_NO_TOOL_RETRIES = 3;
  const listedDirs = new Set(); // track listed directories to detect repetition
  const readFiles = new Set();  // track read files to measure thoroughness

  for (let step = 1; step <= maxSteps; step++) {
    onEvent({ type: "agent_step", agent: agentId, step, message: `${agentDef.emoji} ${agentDef.name} — step ${step}/${maxSteps}` });

    // Warn at 75% of steps to encourage progress
    if (step === Math.floor(maxSteps * 0.75)) {
      messages.push({
        role: "user",
        content: `NOTE: You have used ${step}/${maxSteps} steps. You have ${maxSteps - step} steps remaining. Start wrapping up — if you need to write files, do it NOW.`
      });
    }

    if (step === maxSteps) {
      messages.push({
        role: "user",
        content: `CRITICAL: This is your LAST step (${step}/${maxSteps}). You MUST finish now.\n${requiresWrite && writeToolsUsed === 0 ? "WARNING: You have NOT called write_file/append_file/replace_text yet! You must write your output to a file NOW, then return your result." : "Summarize all work done and return your result."}\nFormat: {"thought":"summary","result":"accomplishments","files_changed":["path"]}`
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
      if (data.__plain__ || (!data.tool && data.result == null && data.final == null)) {
        throw new Error("Plain text or incomplete JSON response");
      }
    } catch {
      onEvent({ type: "agent_thought", agent: agentId, message: "⚠️ Invalid JSON format — re-prompting…" });
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `ERROR: Your response was not valid JSON. Respond with ONLY a JSON object:\n- To use a tool: {"thought":"reasoning","tool":"tool_name","args":{...}}\n- To finish: {"thought":"reasoning","result":"summary","files_changed":["paths"]}`
      });
      continue;
    }

    if (data.thought) {
      onEvent({ type: "agent_thought", agent: agentId, message: data.thought });
    }

    const toolName = data.tool;
    const args = data.args || {};

    // Handle "none" tool — model thinks no tool is needed but used tool:"none" instead of result
    const NONE_TOOLS = new Set(["none","null","n/a","no_tool","no tool","finish","done","respond"]);
    if (toolName && NONE_TOOLS.has(String(toolName).toLowerCase().trim())) {
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: 'Do NOT use tool:"none". Instead finish with: {"thought":"brief","result":"your findings","files_changed":[]}' });
      continue;
    }

    if (toolName && typeof toolName === "string" && toolName.trim() !== "") {
      // Warn about repeated list_files on same directory
      if (toolName === "list_files") {
        const dir = args.path || args.directory || args.dir || ".";
        if (listedDirs.has(dir)) {
          onEvent({ type: "agent_thought", agent: agentId, message: `⚠️ Skipping duplicate list_files for: ${dir}` });
          messages.push({ role: "assistant", content: raw });
          messages.push({ role: "user", content: `You already listed "${dir}". Use that information instead of listing it again. Proceed with your next action.` });
          continue;
        }
        listedDirs.add(dir);
      }

      // Track file reads for thoroughness checking
      if (toolName === "read_file" || toolName === "read_lines") {
        const filePath = args.path || args.file || "";
        if (filePath && !readFiles.has(filePath)) {
          readFiles.add(filePath);
          filesRead++;
        }
      }

      toolsUsed++;
      if (WRITE_TOOLS.has(toolName)) writeToolsUsed++;

      const fn = TOOLS[toolName];
      const toolResult = fn
        ? String(await Promise.resolve(fn(args)))
        : `ERROR: unknown tool '${toolName}'. Available: ${Object.keys(TOOLS).join(", ")}`;

      onEvent({ type: "agent_tool", agent: agentId, tool: toolName, args, result: toolResult.slice(0, 500) });

      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `[Tool result: ${toolName}]\n${toolResult}` });
      continue;
    }

    // Finished?
    if (data.result != null || data.final != null) {
      const result = (data.result ?? data.final ?? "").toString() || "(no summary)";

      // If this agent is required to write files but hasn't — push back
      if (requiresWrite && writeToolsUsed === 0) {
        noToolRetries++;
        if (noToolRetries >= MAX_NO_TOOL_RETRIES) {
          onEvent({ type: "agent_done", agent: agentId, result, data });
          return { agent: agentId, result, data, steps: step, filesRead };
        }
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `ERROR: Your task requires you to WRITE files to disk. You have only read files so far.\nYou MUST call write_file, append_file, or replace_text to save your output.\nDo NOT return a result until you have written at least one file. (Attempt ${noToolRetries}/${MAX_NO_TOOL_RETRIES})`
        });
        continue;
      }

      // If toolsUsed === 0 (no tools at all) — push back
      if (toolsUsed === 0) {
        noToolRetries++;
        if (noToolRetries >= MAX_NO_TOOL_RETRIES) {
          onEvent({ type: "agent_done", agent: agentId, result, data });
          return { agent: agentId, result, data, steps: step, filesRead };
        }
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `ERROR: You cannot finish without using any tools. You must at least read the relevant files or run a command. (Attempt ${noToolRetries}/${MAX_NO_TOOL_RETRIES})`
        });
        continue;
      }

      // Check thoroughness — researcher/tester must read enough files
      const minFiles = MIN_FILES_READ[agentId] || 0;
      if (filesRead < minFiles && step < maxSteps - 1) {
        noToolRetries++;
        if (noToolRetries >= MAX_NO_TOOL_RETRIES) {
          onEvent({ type: "agent_done", agent: agentId, result: `${result}\n\n⚠️ Warning: Only ${filesRead} files were read (minimum recommended: ${minFiles})`, data });
          return { agent: agentId, result, data, steps: step, filesRead };
        }
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `WARNING: You have only read ${filesRead} files so far, but thorough analysis requires reading at least ${minFiles} files. You MUST read more source files before returning your result. Read the files that are most relevant to your task. (Attempt ${noToolRetries}/${MAX_NO_TOOL_RETRIES})`
        });
        continue;
      }

      onEvent({ type: "agent_done", agent: agentId, result, data, filesRead });
      return { agent: agentId, result, data, steps: step, filesRead };
    }

    // No tool and no result
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `ERROR: Provide either a tool call {"tool":"name","args":{...}} or a result {"result":"summary"}.`
    });
  }

  return { agent: agentId, result: "Max steps reached without completion", truncated: true, filesRead };
}

module.exports = { runSubAgent };
