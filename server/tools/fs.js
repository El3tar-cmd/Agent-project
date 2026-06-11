// ============================================================
//  server/tools/fs.js  —  Filesystem Tools
// ============================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { resolvePath } = require("../lib/cwd");

/**
 * Normalizes a file path from various possible argument names.
 */
function normPath(a) {
  return a.path || a.file_path || a.file || a.filepath || a.filename || "";
}

/**
 * Normalizes a search query / pattern.
 */
function normPattern(a) {
  return a.pattern || a.search || a.query || a.text || "";
}

/**
 * Normalizes a directory path.
 */
function normDir(a) {
  return a.directory || a.dir || a.path || a.folder || ".";
}

function toolReadFile(filePath) {
  try {
    const p = resolvePath(filePath);
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolWriteFile(filePath, content) {
  try {
    const abs = resolvePath(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    return `Saved ${abs} (${content.length} chars)`;
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolReplaceText(filePath, old, replacement) {
  try {
    const abs = resolvePath(filePath);
    const t = fs.readFileSync(abs, "utf8");
    if (!t.includes(old)) return `ERROR: pattern not found in ${filePath}`;
    fs.writeFileSync(abs, t.replace(old, replacement), "utf8");
    return `Updated ${abs}`;
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolListFiles(dir = ".") {
  try {
    const abs = resolvePath(dir);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`).join("\n") || "(empty)";
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolCreateDir(dirPath) {
  try {
    const abs = resolvePath(dirPath);
    fs.mkdirSync(abs, { recursive: true });
    return `Created: ${abs}`;
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolDeleteFile(filePath) {
  try {
    const abs = resolvePath(filePath);
    const s = fs.statSync(abs);
    if (s.isDirectory()) {
      execSync(`rm -rf "${abs}"`);
    } else {
      fs.unlinkSync(abs);
    }
    return `Deleted: ${abs}`;
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function toolSearchInFiles(pattern, directory = ".") {
  const results = [];
  function walk(dir) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else {
          try {
            const lines = fs.readFileSync(full, "utf8").split("\n");
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(pattern.toLowerCase())) {
                results.push(`${full}:${i + 1}: ${line.trim()}`);
              }
            });
          } catch {}
        }
      }
    } catch {}
  }
  walk(resolvePath(directory));
  return results.slice(0, 100).join("\n") || `No matches for '${pattern}'`;
}

function toolGrep(pattern, dirPath = ".") {
  try {
    const abs = resolvePath(dirPath);
    const r = execSync(`grep -rn "${pattern}" "${abs}"`, {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 512 * 1024
    });
    return r.trim() || "(no output)";
  } catch (e) {
    return `EXIT:${e.status}\n${e.stderr || e.message}`;
  }
}

module.exports = {
  normPath,
  normPattern,
  normDir,
  readFile:       a => toolReadFile(normPath(a)),
  writeFile:      a => toolWriteFile(normPath(a), a.content || a.text || ""),
  replaceText:    a => toolReplaceText(normPath(a), a.old || a.old_text || a.search || "", a.new || a.new_text || a.replacement || ""),
  listFiles:      a => toolListFiles(a.path || a.directory || a.dir || "."),
  createDir:      a => toolCreateDir(normPath(a) || a.directory || a.dir),
  deleteFile:     a => toolDeleteFile(normPath(a)),
  searchInFiles:  a => toolSearchInFiles(normPattern(a), normDir(a)),
  grep:           a => toolGrep(normPattern(a), a.path || a.directory || "."),
};
