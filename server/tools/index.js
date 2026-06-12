// ============================================================
//  server/tools/index.js  —  Unified Agent Tools Export
// ============================================================

const fs = require("fs");
const { resolvePath, setCWD, getCWD } = require("../lib/cwd");
const fsTools = require("./fs");
const shellTools = require("./shell");
const gitTools = require("./git");
const pythonTools = require("./python");
const webTools = require("./web");
const screenshotTools = require("./screenshot");
const extraTools = require("./extra");

function toolCd(dir) {
  try {
    const abs = resolvePath(dir);
    if (!fs.existsSync(abs)) return `ERROR: directory not found: ${abs}`;
    if (!fs.statSync(abs).isDirectory()) return `ERROR: not a directory: ${abs}`;
    setCWD(abs);
    return `CWD changed to: ${getCWD()}`;
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

/** think — lets the agent reason explicitly without calling any external resource */
function toolThink(thought) {
  // This is intentionally a no-op side-effect tool.
  // It allows the LLM to "think out loud" before acting.
  return `Thought recorded. Proceed with your plan.`;
}

const TOOLS = {
  // Filesystem
  read_file:       fsTools.readFile,
  read_lines:      fsTools.readLines,
  write_file:      fsTools.writeFile,
  append_file:     fsTools.appendFile,
  replace_text:    fsTools.replaceText,
  list_files:      fsTools.listFiles,
  create_dir:      fsTools.createDir,
  delete_file:     fsTools.deleteFile,
  search_in_files: fsTools.searchInFiles,
  grep:            fsTools.grep,

  // Shell
  run_command:     shellTools.runCommand,

  // Git
  git_status:      gitTools.gitStatus,
  git_diff:        gitTools.gitDiff,

  // Python
  python_eval:     pythonTools.pythonEval,

  // Web
  http_get:        webTools.httpGet,
  http_post:       webTools.httpPost,
  search_web:      webTools.searchWeb,

  // Screenshot
  screenshot:      screenshotTools.screenshot,

  // Extended Tools
  find_files:      extraTools.findFiles,
  zip:             extraTools.zip,
  diff_files:      extraTools.diffFiles,
  lint:            extraTools.lint,

  // Navigation
  cd:              a => toolCd(a.path || a.dir || a.directory || ""),

  // Reasoning (no external side effects)
  think:           a => toolThink(a.thought || a.reasoning || a.plan || ""),
};

/** Tools that produce output files — used by swarm to enforce write completion */
const WRITE_TOOLS = new Set(["write_file", "append_file", "replace_text"]);

/** Agents that MUST call a write tool before returning a result */
const WRITE_REQUIRED_AGENTS = new Set(["coder", "docs", "tester", "devops"]);

module.exports = {
  TOOLS,
  WRITE_TOOLS,
  WRITE_REQUIRED_AGENTS,
  runCommandStreaming: shellTools.runCommandStreaming,
};
