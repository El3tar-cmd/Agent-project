// ============================================================
//  server/tools/git.js  —  Git Tools
// ============================================================

const { runCommand } = require("./shell");

module.exports = {
  gitStatus: () => runCommand({ command: "git status" }),
  gitDiff: a => runCommand({ command: `git diff ${a.file || a.path || ""}`.trim() }),
};
