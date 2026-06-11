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

/**
 * Change the current working directory of the agent.
 */
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

const TOOLS = {
  read_file:       fsTools.readFile,
  write_file:      fsTools.writeFile,
  replace_text:    fsTools.replaceText,
  list_files:      fsTools.listFiles,
  create_dir:      fsTools.createDir,
  delete_file:     fsTools.deleteFile,
  search_in_files: fsTools.searchInFiles,
  grep:            fsTools.grep,
  
  run_command:     shellTools.runCommand,
  
  git_status:      gitTools.gitStatus,
  git_diff:        gitTools.gitDiff,
  
  python_eval:     pythonTools.pythonEval,
  
  http_get:        webTools.httpGet,
  search_web:      webTools.searchWeb,
  
  screenshot:      screenshotTools.screenshot,
  
  cd:              a => toolCd(a.path),
};

module.exports = {
  TOOLS,
  runCommandStreaming: shellTools.runCommandStreaming,
};
