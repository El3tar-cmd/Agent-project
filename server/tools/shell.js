// ============================================================
//  server/tools/shell.js  —  Shell Command Execution Tools
// ============================================================

const { execSync } = require("child_process");
const { isDangerous } = require("../lib/safety");
const { getCWD } = require("../lib/cwd");
const { bgRun } = require("../lib/processManager");

/**
 * Run a command synchronously with safety checks.
 */
function toolRunCommand(cmd) {
  if (isDangerous(cmd)) {
    return "BLOCKED: dangerous command pattern.";
  }
  try {
    const r = execSync(cmd, {
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      cwd: getCWD()
    });
    return r.trim() || "(no output)";
  } catch (e) {
    return `EXIT:${e.status}\n${e.stderr || e.message}`;
  }
}

/**
 * Run a command with streaming output via SSE.
 */
function toolRunCommandStreaming(cmd, sendFn) {
  if (isDangerous(cmd)) {
    return Promise.resolve("BLOCKED: dangerous command pattern.");
  }
  return new Promise(resolve => {
    let out = "", err = "";
    const { id, error } = bgRun(cmd, {
      onLine: (data, isErr) => {
        if (isErr) {
          err += data;
        } else {
          out += data;
        }
        sendFn("stream_output", { data, stderr: isErr });
      },
      onDone: (code) => {
        resolve(`EXIT:${code}\n${out}${err}`.trim());
      }
    });
    if (error) {
      resolve(`BLOCKED: dangerous command`);
    }
  });
}

module.exports = {
  runCommand: a => toolRunCommand(a.command || a.cmd || a.run || ""),
  runCommandStreaming: toolRunCommandStreaming,
};
