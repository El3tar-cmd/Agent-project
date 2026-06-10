// ============================================================
//  Agent Web Server  —  Express + SSE + Ollama
//  Run: node agent_server.js
//  Requires: npm install express cors
// ============================================================

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
const { execSync, spawn } = require("child_process");
const http    = require("http");

const app  = express();
const PORT = 3131;

// ─── CONFIG ────────────────────────────────────────────────
const OLLAMA_URL   = "http://localhost:11434";
const MODEL        = process.env.AGENT_MODEL || "qwen3-coder-next:cloud";
const MAX_STEPS    = 100;
const STATE_FILE   = ".agent_state.json";
const LOG_FILE     = ".agent_log.jsonl";
const MAX_CTX_CHARS = 12000;

const DANGEROUS = [/rm\s+-rf\s+\//, /rm\s+-rf\s+~/, /mkfs/, /dd\s+if=/, /:\(\)\{:\|:&\};:/, /sudo\s+rm/];

const SYSTEM_PROMPT = `You are an advanced CLI coding agent. Help users write, edit, debug, and manage code and files.

Available Tools:
read_file(path), write_file(path, content), replace_text(path, old, new),
run_command(command), list_files(path), search_in_files(pattern, directory),
create_dir(path), delete_file(path), http_get(url), python_eval(code),
git_status(), git_diff(file?), grep(pattern, path), cd(path)

Note: All relative paths are resolved from the current working directory (CWD).
The current CWD is injected at the start of each session.

Response Format — ONLY valid JSON, no markdown fences:

Use a tool:
{"thought": "why", "tool": "tool_name", "args": {...}}

Finished:
{"thought": "summary", "final": "message to user"}

Rules: Think step by step. Never guess file contents. Prefer replace_text over full rewrites.`;

// ─── MIDDLEWARE ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── STATE ─────────────────────────────────────────────────
function saveState(ctx, hist) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ saved_at: new Date().toISOString(), context: ctx, history: hist }, null, 2));
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const d = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return { context: d.context || "", history: d.history || [] };
    }
  } catch {}
  return { context: "", history: [] };
}

function appendLog(entry) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

// ─── WORKING DIRECTORY ─────────────────────────────────────
let CWD = process.cwd(); // starts from where you ran node

function resolvePath(p) {
  // if absolute, use as-is. if relative, resolve from CWD
  return path.isAbsolute(p) ? p : path.resolve(CWD, p);
}

// ─── TOOLS ─────────────────────────────────────────────────
function toolReadFile(filePath) {
  try { return fs.readFileSync(resolvePath(filePath), "utf8"); }
  catch (e) { return `ERROR: ${e.message}`; }
}

function toolWriteFile(filePath, content) {
  try {
    const abs = resolvePath(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    return `Saved ${abs} (${content.length} chars)`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

function toolReplaceText(filePath, old, replacement) {
  try {
    const abs = resolvePath(filePath);
    const t = fs.readFileSync(abs, "utf8");
    if (!t.includes(old)) return `ERROR: pattern not found in ${abs}`;
    fs.writeFileSync(abs, t.replace(old, replacement), "utf8");
    return `Updated ${abs}`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

function toolRunCommand(cmd) {
  if (DANGEROUS.some(p => p.test(cmd))) return "BLOCKED: dangerous command pattern.";
  try {
    const r = execSync(cmd, {
      encoding: "utf8", timeout: 60000, maxBuffer: 1024*1024,
      cwd: CWD   // ← runs in current working dir
    });
    return r.trim() || "(no output)";
  } catch (e) { return `EXIT:${e.status}\n${e.stderr || e.message}`; }
}

function toolListFiles(dir = ".") {
  try {
    const abs = resolvePath(dir);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory()?"📁":"📄"} ${e.name}`).join("\n") || "(empty)";
  } catch (e) { return `ERROR: ${e.message}`; }
}

function toolSearchInFiles(pattern, directory = ".") {
  const results = [];
  function walk(dir) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else {
          try {
            const lines = fs.readFileSync(full, "utf8").split("\n");
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(pattern.toLowerCase()))
                results.push(`${full}:${i+1}: ${line.trim()}`);
            });
          } catch {}
        }
      }
    } catch {}
  }
  walk(resolvePath(directory));
  return results.slice(0, 100).join("\n") || `No matches for '${pattern}'`;
}

function toolCreateDir(dirPath) {
  try {
    const abs = resolvePath(dirPath);
    fs.mkdirSync(abs, { recursive: true });
    return `Created: ${abs}`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

function toolDeleteFile(filePath) {
  try {
    const abs = resolvePath(filePath);
    const s = fs.statSync(abs);
    if (s.isDirectory()) { execSync(`rm -rf "${abs}"`); }
    else fs.unlinkSync(abs);
    return `Deleted: ${abs}`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

async function toolHttpGet(url) {
  // normalize URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    "Accept": "text/html,application/json,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
  };
  // try https first, fallback to http
  for (const attempt of [url, url.replace("https://","http://")]) {
    try {
      const res = await fetch(attempt, { headers: HEADERS, signal: AbortSignal.timeout(20000), redirect:"follow" });
      const ct  = res.headers.get("content-type") || "";
      let text  = await res.text();
      // strip HTML tags for cleaner output
      if (ct.includes("html")) {
        text = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{3,}/g, "\n")
          .trim();
      }
      return `STATUS:${res.status}\nURL:${attempt}\n\n${text.slice(0,5000)}${text.length>5000?"\n...[truncated]":""}`;
    } catch (e) {
      if (attempt === url && url.startsWith("https://")) continue; // try http
      return `ERROR: ${e.message}`;
    }
  }
  return "ERROR: Failed to fetch URL";
}

// ── search_web: DuckDuckGo with multiple fallback parsers ─
async function toolSearchWeb(query) {
  if (!query) return "ERROR: no query provided";
  const HEADERS = { "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" };

  // Try DuckDuckGo HTML
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    const html = await res.text();
    const results = [];

    // Parse result links and snippets
    const linkRe  = /class="result__a"[^>]*>([^<]+)<\/a>/g;
    const snipRe  = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const urlRe   = /result__url[^>]*>([^<]+)</g;

    const links = [...html.matchAll(linkRe)].map(m => m[1].trim());
    const snips = [...html.matchAll(snipRe)].map(m => m[1].replace(/<[^>]+>/g,"").trim());
    const urls  = [...html.matchAll(urlRe)].map(m => m[1].trim());

    for (let i = 0; i < Math.min(links.length, 6); i++) {
      const title = links[i] || "";
      const snip  = snips[i] || "";
      const href  = urls[i]  || "";
      if (title) results.push(`[${i+1}] ${title}\n${snip}\n${href}`);
    }

    if (results.length) return results.join("\n\n");
  } catch {}

  // Fallback: try DuckDuckGo API
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const d   = await res.json();
    const out = [];
    if (d.AbstractText) out.push(`[Answer] ${d.AbstractText}`);
    if (d.RelatedTopics) {
      d.RelatedTopics.slice(0,5).forEach((t,i) => {
        if (t.Text) out.push(`[${i+1}] ${t.Text}\n${t.FirstURL||""}`);
      });
    }
    if (out.length) return out.join("\n\n");
  } catch {}

  return `No results found for: ${query}`;
}

// ── screenshot tool ────────────────────────────────────────
const SCREENSHOT_DIR = path.join(process.cwd(), ".screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function toolScreenshot(urlOrFile, options = {}) {
  // normalize input
  let targetUrl = urlOrFile;
  if (!targetUrl) return "ERROR: no URL or file path provided";

  // local file → file:// URL
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && !targetUrl.startsWith("file://")) {
    const abs = resolvePath(targetUrl);
    if (!fs.existsSync(abs)) return `ERROR: file not found: ${abs}`;
    targetUrl = `file://${abs}`;
  } else if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && !targetUrl.startsWith("file://")) {
    targetUrl = "https://" + targetUrl;
  }

  const outFile = path.join(SCREENSHOT_DIR, `shot_${Date.now()}.png`);

  // Try puppeteer first
  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: options.width||1280, height: options.height||800 });
    await page.goto(targetUrl, { waitUntil:"networkidle2", timeout:30000 });
    if (options.wait) await page.waitForTimeout(options.wait);
    await page.screenshot({ path:outFile, fullPage:!!options.fullPage });
    await browser.close();
    return `SCREENSHOT:${outFile}\nURL:${targetUrl}\nSize:${fs.statSync(outFile).size} bytes`;
  } catch (puppeteerErr) {
    // Fallback: try cutycapt or wkhtmltoimage (CLI tools)
    const cmds = [
      `cutycapt --url="${targetUrl}" --out="${outFile}" 2>/dev/null`,
      `wkhtmltoimage --quiet "${targetUrl}" "${outFile}" 2>/dev/null`,
      `chromium-browser --headless --screenshot="${outFile}" --window-size=1280,800 "${targetUrl}" 2>/dev/null`,
      `google-chrome --headless --screenshot="${outFile}" --window-size=1280,800 "${targetUrl}" 2>/dev/null`,
    ];
    for (const cmd of cmds) {
      try {
        execSync(cmd, { timeout:30000 });
        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
          return `SCREENSHOT:${outFile}\nURL:${targetUrl}\nSize:${fs.statSync(outFile).size} bytes`;
        }
      } catch {}
    }
    return `ERROR: Screenshot failed. Install puppeteer: npm install puppeteer\n(${puppeteerErr.message})`;
  }
}

// ── serve screenshots ──────────────────────────────────────
app.use("/.screenshots", express.static(SCREENSHOT_DIR));

function toolGitStatus()     { return toolRunCommand("git status"); }
function toolGitDiff(file)   { return toolRunCommand(`git diff ${file||""}`.trim()); }
function toolGrep(pat, p)    { return toolRunCommand(`grep -rn "${pat}" "${resolvePath(p||".")}"`); }

// أداة تغيير الـ working directory
function toolCd(dir) {
  try {
    const abs = resolvePath(dir);
    if (!fs.existsSync(abs)) return `ERROR: directory not found: ${abs}`;
    if (!fs.statSync(abs).isDirectory()) return `ERROR: not a directory: ${abs}`;
    CWD = abs;
    return `CWD changed to: ${CWD}`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

// ─── TOOL DISPATCH ─────────────────────────────────────────

// ── ask_human: agent pauses and asks user a question ───────
const pendingHuman = new Map(); // runId → resolve

async function toolAskHuman(question, runId) {
  return new Promise(resolve => {
    pendingHuman.set(runId, resolve);
    setTimeout(() => { pendingHuman.delete(runId); resolve("(no answer — timed out)"); }, 120000);
  });
}

// ── search_web: DuckDuckGo scrape ──────────────────────────
async function toolSearchWeb(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    const results = [];
    const re = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]*)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null && results.length < 8) {
      const title   = m[2].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x27;/g,"'").trim();
      const snippet = m[3].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x27;/g,"'").trim();
      const href    = m[1];
      if (title && snippet) results.push(`[${results.length+1}] ${title}\n${snippet}\n${href}`);
    }
    return results.length ? results.join("\n\n") : `No results for: ${query}`;
  } catch (e) { return `ERROR: ${e.message}`; }
}

// ── streaming run_command via SSE ──────────────────────────
function toolRunCommandStreaming(cmd, sendFn) {
  if (DANGEROUS.some(p => p.test(cmd))) return Promise.resolve("BLOCKED: dangerous command pattern.");
  return new Promise(resolve => {
    let out = "", err = "";
    try {
      const proc = spawn("sh", ["-c", cmd], { cwd: CWD, env: process.env });
      proc.stdout.on("data", d => { const s=d.toString(); out+=s; sendFn("stream_output", { data:s }); });
      proc.stderr.on("data", d => { const s=d.toString(); err+=s; sendFn("stream_output", { data:s, stderr:true }); });
      proc.on("close", code => resolve(`EXIT:${code}\n${out}${err}`.trim()));
      proc.on("error", e => resolve(`ERROR: ${e.message}`));
      setTimeout(() => { proc.kill(); resolve(`EXIT:TIMEOUT\n${out}${err}`); }, 60000);
    } catch(e) { resolve(`ERROR: ${e.message}`); }
  });
}

// ── context summarizer ─────────────────────────────────────
async function summarizeContext(ctx, model) {
  if (ctx.length <= MAX_CTX_CHARS) return ctx;
  try {
    const raw = await askOllama([
      { role:"system", content:"You are a context summarizer. Compress the agent conversation history into a concise summary preserving all important facts, decisions, file paths, and code changes. Be brief." },
      { role:"user",   content:`Summarize this agent session context:\n\n${ctx.slice(0, 20000)}` }
    ], model, 60000);
    const parsed = JSON.parse(cleanJson(raw));
    const summary = parsed.final || parsed.summary || raw;
    return `[SUMMARIZED CONTEXT]\n${summary}`;
  } catch { return ctx.slice(-4000); }
}

const TOOLS = {
  read_file:       a => toolReadFile(a.path),
  write_file:      a => toolWriteFile(a.path, a.content),
  replace_text:    a => toolReplaceText(a.path, a.old, a.new),
  run_command:     a => toolRunCommand(a.command),
  list_files:      a => toolListFiles(a.path),
  search_in_files: a => toolSearchInFiles(a.pattern, a.directory),
  create_dir:      a => toolCreateDir(a.path),
  delete_file:     a => toolDeleteFile(a.path),
  http_get:        a => toolHttpGet(a.url),
  python_eval:     a => toolPythonEval(a.code),
  git_status:      _  => toolGitStatus(),
  git_diff:        a => toolGitDiff(a.file),
  grep:            a => toolGrep(a.pattern, a.path),
  cd:              a => toolCd(a.path),
  search_web:      a => toolSearchWeb(a.query || a.q || a.search || ""),
  screenshot:      a => toolScreenshot(a.url || a.path || a.file || "", { fullPage:a.full_page, wait:a.wait, width:a.width, height:a.height }),
};

const NEEDS_CONFIRM = new Set(["delete_file"]);
const STREAM_TOOLS  = new Set(["run_command"]);

// ─── ROBUST JSON PARSER ─────────────────────────────────────
function cleanJson(raw) {
  if (!raw) return "{}";

  // Strategy 1: direct parse
  try { JSON.parse(raw); return raw; } catch {}

  // Strategy 2: strip markdown fences
  let s = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try { JSON.parse(s); return s; } catch {}

  // Strategy 3: extract first complete JSON object with brace matching
  let depth = 0, start = -1, inStr = false, escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = raw.slice(start, i + 1);
        try { JSON.parse(candidate); return candidate; } catch {}
      }
    }
  }

  // Strategy 4: try to fix common issues
  let fixed = s
    // fix unescaped newlines in strings
    .replace(/("(?:[^"\\]|\\.)*")/g, m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"))
    // fix trailing commas
    .replace(/,\s*([}\]])/g, "$1")
    // fix single quotes → double quotes (careful)
    .replace(/'/g, '"');
  try { JSON.parse(fixed); return fixed; } catch {}

  // Strategy 5: extract key fields manually if JSON is broken
  const thought = raw.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || "";
  const tool    = raw.match(/"tool"\s*:\s*"([^"]+)"/)?.[1] || "";
  const final_  = raw.match(/"final"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || "";

  if (tool)   return JSON.stringify({ thought, tool, args: {} });
  if (final_) return JSON.stringify({ thought, final: final_ });

  // Give up — return as plain text marker
  return JSON.stringify({ __plain__: true, text: raw });
}

function trimContext(ctx, req) {
  if (ctx.length <= MAX_CTX_CHARS) return ctx;
  return `[Original task]\n${req}\n\n[...older steps trimmed...]\n\n${ctx.slice(-4000)}`;
}

// ─── OLLAMA CALL ────────────────────────────────────────────
// Retry configuration for rate limiting
const OLLAMA_RETRY_MAX = 3;
const OLLAMA_RETRY_DELAY = 2000; // 2 seconds base delay

async function askOllama(messages, model = MODEL, timeout=300000) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= OLLAMA_RETRY_MAX; attempt++) {
    if (attempt > 0) {
      const delay = OLLAMA_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`  ⚠️  Ollama rate limited (attempt ${attempt}/${OLLAMA_RETRY_MAX}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
    
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } });
      const req = http.request("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      }, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              // Handle Ollama error responses
              if (parsed.error.includes('429') || parsed.error.includes('Too Many')) {
                lastError = new Error(`Ollama rate limited: ${parsed.error}`);
                reject(lastError);
              } else {
                reject(new Error(`Ollama error: ${parsed.error}`));
              }
            } else {
              resolve(parsed.message.content);
            }
          }
          catch (e) { 
            reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0,200)}`)); 
          }
        });
      });
      req.on("error", (e) => {
        lastError = e;
        reject(e);
      });
      req.setTimeout(timeout, () => { 
        req.destroy(); 
        reject(new Error("Ollama timeout")); 
      });
      req.write(body); req.end();
    });
  }
  
  // If all retries failed
  throw lastError || new Error("Ollama API unavailable after multiple attempts");
}

// ─── PENDING CONFIRMATIONS ─────────────────────────────────
const pendingConfirms = new Map();

// ─── HUMAN ANSWER ENDPOINT ─────────────────────────────────
app.post("/api/human", (req, res) => {
  const { runId, answer } = req.body;
  const resolve = pendingHuman.get(runId);
  if (resolve) { pendingHuman.delete(runId); resolve(answer || ""); }
  res.json({ ok: true });
});

// ─── AUTO-PLANNING ──────────────────────────────────────────
async function autoplan(task, model, send) {
  send("planning", { message: "🏗 Making a plan…" });
  try {
    const raw = await askOllama([
      { role:"system", content:`You are a planning assistant. Given a coding task, produce a brief step-by-step plan.
Response format — ONLY valid JSON:
{"plan": ["step 1", "step 2", ...], "needs_files": ["file1.js"], "estimated_steps": 5}` },
      { role:"user", content: task }
    ], model, 60000);
    const d = JSON.parse(cleanJson(raw));
    send("plan_ready", { plan: d.plan || [], needs_files: d.needs_files || [], estimated_steps: d.estimated_steps || 5 });
    return d;
  } catch { return null; }
}

// ─── SSE AGENT RUN ─────────────────────────────────────────
app.post("/api/run", async (req, res) => {
  const { message, model, auto_plan } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };

  const { context, history } = loadState();
  const activeModel = model || MODEL;
  let ctx = context;

  let userMsg = message;
  if (message.toLowerCase() === "continue" && context) {
    userMsg = "Continue the previous task from where you left off. Review the context and proceed.";
  }

  // ── auto-plan if requested ─────────────────────────────
  if (auto_plan && message.length > 20) {
    await autoplan(message, activeModel, send);
  }

  // ── context summarization if too large ────────────────
  if (ctx.length > MAX_CTX_CHARS * 1.5) {
    send("summarizing", { message: "📝 Summarizing context…" });
    ctx = await summarizeContext(ctx, activeModel);
  }

  // build system prompt with persona focus
  const persona     = req.body.persona ? PERSONAS[req.body.persona] : null;
  const personaNote = persona ? `\n\n## Active Persona: ${persona.name}\n${persona.focus}` : "";
  const cwdNote     = `\n\n## Current Working Directory\n${CWD}`;
  const resume      = ctx ? `\n\n## Resumed Session Context\n${ctx}` : "";

  const FULL_PROMPT = `You are NOVA — an advanced AI coding agent running in 2026. You are a senior full-stack engineer with deep expertise in security, testing, performance, and documentation.

## Available Tools
- read_file(path) — read a file's contents
- write_file(path, content) — create or overwrite a file
- replace_text(path, old, new) — targeted find-and-replace in a file
- run_command(command) — execute shell commands with streaming output
- list_files(path) — list directory contents
- search_in_files(pattern, directory) — search text across files
- create_dir(path) — create directories
- delete_file(path) — delete files or directories
- http_get(url) — fetch a URL (handles redirects, strips HTML)
- python_eval(code) — execute Python code
- git_status() — show git status
- git_diff(file?) — show git diff
- grep(pattern, path) — search with grep
- cd(path) — change working directory
- search_web(query) — search the web via DuckDuckGo
- screenshot(url_or_path) — take a screenshot of a URL or HTML file
- ask_human(question) — pause and ask the user a specific question

## Response Format
ALWAYS respond with ONLY a single valid JSON object. NO markdown fences, NO extra text, NO explanation outside JSON.

Use a tool:
{"thought":"<concise reasoning>","tool":"<tool_name>","args":{...}}

Finished:
{"thought":"<what was accomplished>","final":"<message to user>"}

## CRITICAL JSON Rules
- Output ONLY the JSON object — nothing before or after
- Never wrap in \`\`\`json or any markdown
- All string values must have properly escaped quotes
- Use double quotes for all JSON keys and string values
- If content has newlines, use \\n escape sequences

## Engineering Standards (2026)

### Full-Stack Thinking
When building ANY feature, ALWAYS consider ALL layers:
1. **Backend**: API endpoints, business logic, data validation, error handling
2. **Frontend**: UI components, UX flow, accessibility (WCAG 2.2), responsive design
3. **Security**: Input validation, SQL injection, XSS, CSRF, auth/authorization, secrets management
4. **Testing**: Unit tests, integration tests, edge cases, error paths
5. **Documentation**: README, API docs, inline comments, usage examples
6. **Performance**: Caching, lazy loading, database indexes, bundle size
7. **DevOps**: Environment config, health checks, logging, graceful shutdown

### Code Quality
- Write TypeScript when possible (not JavaScript)
- Use modern async/await, not callbacks
- Handle ALL error cases explicitly
- Validate ALL user inputs server-side
- Never store secrets in code — use environment variables
- Follow SOLID principles and DRY

### Security First
- Sanitize ALL inputs (frontend AND backend)
- Use parameterized queries for databases
- Implement rate limiting on APIs
- Add CORS configuration
- Use HTTPS in production
- Never trust client-side validation alone

### Before Writing Code
1. Read existing files to understand the codebase
2. Ask about unclear requirements with ask_human
3. Plan the full implementation (backend + frontend + tests)
4. Implement incrementally — not in one massive write

## Workflow Rules
- NEVER guess file contents — always read first with read_file
- NEVER write a file without first understanding its current state
- Use replace_text for small changes, write_file only for new files
- After writing code, verify it works with run_command
- If a URL/page is needed, use screenshot to verify the visual result
- If unsure about requirements, ALWAYS ask_human before building`;

  const messages = [
    { role:"system", content: FULL_PROMPT + personaNote + cwdNote + resume },
    ...history,
    { role:"user", content: userMsg }
  ];

  send("start", { message: "Agent started", model: activeModel });

  // track file changes for inline diff
  const fileSnapshots = {};  // path → content before change

  let finalAnswer = null;
  const runId = `run_${Date.now()}`;

  try {
    for (let n = 1; n <= MAX_STEPS; n++) {
      send("step", { step: n, message: `Step ${n} — Thinking…` });

      let raw;
      try { raw = await askOllama(messages, activeModel); }
      catch (e) { send("error", { message: `Ollama error: ${e.message}` }); break; }

      let data;
      try {
        const cleaned = cleanJson(raw);
        data = JSON.parse(cleaned);
        // handle plain text fallback
        if (data.__plain__) {
          send("final", { message: data.text });
          messages.push({ role:"assistant", content:raw });
          ctx += `\n\n[Step ${n}] Final(plain): ${data.text}`;
          saveState(ctx, messages.slice(2));
          finalAnswer = data.text; break;
        }
      } catch {
        // absolute fallback
        send("final", { message: raw });
        messages.push({ role:"assistant", content:raw });
        ctx += `\n\n[Step ${n}] Final(raw): ${raw.slice(0,500)}`;
        saveState(ctx, messages.slice(2));
        finalAnswer = raw; break;
      }

      if (data.thought) send("thought", { message: data.thought });

      if (data.final !== undefined) {
        send("final", { message: data.final });
        messages.push({ role:"assistant", content:raw });
        ctx += `\n\n[Step ${n}] Final: ${data.final}`;
        saveState(ctx, messages.slice(2));
        appendLog({ step:n, type:"final", message:data.final });
        finalAnswer = data.final; break;
      }

      const toolName = data.tool;
      const args     = data.args || {};
      if (!toolName) { messages.push({ role:"assistant", content:raw }); continue; }

      // ── ask_human ───────────────────────────────────────
      if (toolName === "ask_human") {
        const question = args.question || args.q || "Can you clarify?";
        const askRunId = `ask_${Date.now()}`;
        send("ask_human", { question, runId: askRunId });
        const answer = await toolAskHuman(question, askRunId);
        send("human_answered", { answer });
        messages.push({ role:"assistant", content:raw });
        messages.push({ role:"user", content:`[Human answered]: ${answer}` });
        ctx += `\n\n[Step ${n}] Asked: ${question}\nAnswer: ${answer}`;
        continue;
      }

      // ── confirmation needed ──────────────────────────────
      if (NEEDS_CONFIRM.has(toolName)) {
        const preview = args.path || "";
        const confirmId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        send("confirm_request", { tool:toolName, preview, step:n, runId:confirmId });
        const confirmed = await new Promise(resolve => {
          pendingConfirms.set(confirmId, resolve);
          setTimeout(() => { pendingConfirms.delete(confirmId); resolve(false); }, 90000);
        });
        if (!confirmed) {
          const result = "Cancelled by user.";
          send("tool_result", { tool:toolName, result });
          messages.push({ role:"assistant", content:raw });
          messages.push({ role:"user", content:`[Tool result: ${toolName}]\n${result}` });
          ctx += `\n\n[Step ${n}] Tool:${toolName} → Cancelled`;
          continue;
        }
      }

      // ── snapshot file before write (for inline diff) ────
      if ((toolName === "write_file" || toolName === "replace_text") && args.path) {
        const absPath = resolvePath(args.path);
        if (!fileSnapshots[absPath]) {
          try { fileSnapshots[absPath] = fs.readFileSync(absPath, "utf8"); }
          catch { fileSnapshots[absPath] = ""; }
        }
      }

      send("tool_call", { tool:toolName, args });

      // ── streaming run_command ────────────────────────────
      let result;
      if (toolName === "run_command" && args.command) {
        send("stream_start", { tool:toolName, command:args.command });
        result = await toolRunCommandFull(args.command, send);
        send("stream_end", { tool:toolName });
      } else {
        const fn = TOOLS[toolName];
        result = fn ? String(await Promise.resolve(fn(args))) : `ERROR: unknown tool '${toolName}'`;
      }

      // ── inline diff after write ─────────────────────────
      if ((toolName === "write_file" || toolName === "replace_text") && args.path) {
        const absPath = resolvePath(args.path);
        const before = fileSnapshots[absPath] || "";
        let after = "";
        try { after = fs.readFileSync(absPath, "utf8"); } catch {}
        if (before !== after) {
          send("inline_diff", { path: args.path, before, after });
        }
      }

      send("tool_result", { tool:toolName, result: result.slice(0, 1000) });
      appendLog({ step:n, tool:toolName, args, result: result.slice(0,500) });

      messages.push({ role:"assistant", content:raw });
      messages.push({ role:"user", content:`[Tool result: ${toolName}]\n${result}` });
      ctx += `\n\n[Step ${n}] Tool:${toolName} Result:${result.slice(0,500)}`;
      ctx = trimContext(ctx, userMsg);
    }
  } catch (e) { send("error", { message: e.message }); }

  if (!finalAnswer) {
    send("paused", { message: `Reached ${MAX_STEPS} steps. Type 'continue' to resume.` });
    saveState(ctx, messages.slice(2));
  }

  res.end();
});

// ─── CONFIRM ENDPOINT ──────────────────────────────────────
app.post("/api/confirm", (req, res) => {
  const { runId, confirmed } = req.body;
  const resolve = pendingConfirms.get(runId);
  if (resolve) { pendingConfirms.delete(runId); resolve(confirmed); }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
//  PROCESS MANAGER  — track all agent-spawned processes
// ═══════════════════════════════════════════════════════════
const bgProcesses = new Map();   // id → { id, cmd, proc, output, startedAt, status }
let bgIdCounter   = 0;
const pmListeners = new Set();   // SSE response objects for /api/processes/stream

function pmBroadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const res of pmListeners) { try { res.write(msg); } catch { pmListeners.delete(res); } }
}

function pmSnapshot() {
  return [...bgProcesses.values()].map(p => ({
    id: p.id, cmd: p.cmd, status: p.status,
    startedAt: p.startedAt, exitCode: p.exitCode,
    output: p.output.slice(-3000),
    pid: p.proc?.pid,
  }));
}

function bgRun(cmd, { onLine, onDone } = {}) {
  if (DANGEROUS.some(p => p.test(cmd))) return { error:"BLOCKED" };

  const id  = ++bgIdCounter;
  const entry = {
    id, cmd, status:"running",
    startedAt: new Date().toISOString(),
    output: "", exitCode: null, proc: null,
  };
  bgProcesses.set(id, entry);
  pmBroadcast("process_start", { process: { ...entry, output:"" } });

  const proc = spawn("sh", ["-c", cmd], { cwd: CWD, env: process.env });
  entry.proc = proc;

  const append = (data, isErr=false) => {
    entry.output += data;
    if (entry.output.length > 50000) entry.output = entry.output.slice(-40000);
    pmBroadcast("process_output", { id, data, isErr });
    if (onLine) onLine(data, isErr);
  };

  proc.stdout.on("data", d => append(d.toString()));
  proc.stderr.on("data", d => append(d.toString(), true));
  proc.on("close", code => {
    entry.status   = code === 0 ? "done" : "error";
    entry.exitCode = code;
    entry.proc     = null;
    pmBroadcast("process_end", { id, exitCode: code, status: entry.status });
    if (onDone) onDone(code, entry.output);
    // keep last 50 processes
    if (bgProcesses.size > 50) {
      const oldest = [...bgProcesses.entries()].find(([,v]) => v.status !== "running");
      if (oldest) bgProcesses.delete(oldest[0]);
    }
  });
  proc.on("error", e => {
    entry.status = "error";
    append(`ERROR: ${e.message}`, true);
    pmBroadcast("process_end", { id, exitCode:-1, status:"error" });
    if (onDone) onDone(-1, entry.output);
  });

  return { id, proc };
}

// ── process manager endpoints ─────────────────────────────
app.get("/api/processes", (_, res) => res.json(pmSnapshot()));

app.delete("/api/processes/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const p  = bgProcesses.get(id);
  if (!p) return res.status(404).json({ error:"Not found" });
  if (p.proc) { try { p.proc.kill("SIGTERM"); } catch {} p.status = "killed"; }
  res.json({ ok:true });
});

app.delete("/api/processes", (_, res) => {
  for (const [,p] of bgProcesses) { if (p.proc) { try { p.proc.kill(); } catch {} } }
  bgProcesses.clear();
  res.json({ ok:true });
});

app.get("/api/processes/stream", (req, res) => {
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  // send current snapshot
  res.write(`data: ${JSON.stringify({ type:"snapshot", processes: pmSnapshot() })}\n\n`);
  pmListeners.add(res);
  req.on("close", () => pmListeners.delete(res));
});

// patch toolRunCommandStreaming to also feed process manager + agent SSE
function toolRunCommandFull(cmd, sendFn) {
  if (DANGEROUS.some(p => p.test(cmd))) return Promise.resolve("BLOCKED: dangerous command pattern.");
  return new Promise(resolve => {
    let out = "", err = "";
    const { id, error } = bgRun(cmd, {
      onLine: (data, isErr) => {
        if (isErr) err += data; else out += data;
        sendFn("stream_output", { data, stderr: isErr });
      },
      onDone: (code) => {
        resolve(`EXIT:${code}\n${out}${err}`.trim());
      }
    });
    if (error) resolve(`BLOCKED: dangerous command`);
  });
}

// ─── SCREENSHOT ENDPOINT ────────────────────────────────────
app.get("/api/screenshot", (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error:"No file" });
  const abs = path.isAbsolute(file) ? file : path.join(SCREENSHOT_DIR, file);
  if (!fs.existsSync(abs)) return res.status(404).json({ error:"Not found" });
  res.sendFile(abs);
});

app.post("/api/screenshot", async (req, res) => {
  const { url, fullPage, wait, width, height } = req.body;
  if (!url) return res.status(400).json({ error:"No url" });
  const result = await toolScreenshot(url, { fullPage, wait, width, height });
  if (result.startsWith("ERROR")) return res.status(500).json({ error: result });
  const filePath = result.match(/SCREENSHOT:(.+)/)?.[1]?.trim();
  res.json({ ok:true, path:filePath, url:`/.screenshots/${path.basename(filePath)}` });
});

// ─── IMAGE UPLOAD ENDPOINT ──────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), ".uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive:true });
app.use("/.uploads", express.static(UPLOAD_DIR));

app.post("/api/upload", express.raw({ type:"image/*", limit:"20mb" }), (req, res) => {
  try {
    const ext  = (req.headers["content-type"]||"image/png").split("/")[1]?.split(";")[0] || "png";
    const name = `upload_${Date.now()}.${ext}`;
    const dest = path.join(UPLOAD_DIR, name);
    fs.writeFileSync(dest, req.body);
    res.json({ ok:true, path:dest, url:`/.uploads/${name}`, name });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// multipart upload (from Telegram/form)
app.post("/api/upload/base64", express.json({ limit:"20mb" }), (req, res) => {
  try {
    const { data, ext="png", name:reqName } = req.body;
    if (!data) return res.status(400).json({ error:"No data" });
    const buf  = Buffer.from(data.replace(/^data:[^;]+;base64,/,""), "base64");
    const name = reqName || `upload_${Date.now()}.${ext}`;
    const dest = path.join(UPLOAD_DIR, name);
    fs.writeFileSync(dest, buf);
    res.json({ ok:true, path:dest, url:`/.uploads/${name}`, name });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.get("/api/cwd", (_, res) => res.json({ cwd: CWD }));

app.post("/api/cwd", (req, res) => {
  const { dir } = req.body;
  if (!dir) return res.status(400).json({ error: "No dir" });
  const result = toolCd(dir);
  if (result.startsWith("ERROR")) return res.status(400).json({ error: result });
  res.json({ cwd: CWD, message: result });
});

// ─── STATE ENDPOINTS ───────────────────────────────────────
app.get("/api/state",    (_, res) => res.json(loadState()));
app.delete("/api/state", (_, res) => { try { fs.unlinkSync(STATE_FILE); } catch {} res.json({ ok: true }); });

app.get("/api/log", (_, res) => {
  try {
    const lines = fs.existsSync(LOG_FILE)
      ? fs.readFileSync(LOG_FILE,"utf8").trim().split("\n").slice(-50).map(l => JSON.parse(l))
      : [];
    res.json(lines);
  } catch { res.json([]); }
});

app.get("/api/models", async (_, res) => {
  try {
    const r = await fetch("http://localhost:11434/api/tags");
    const d = await r.json();
    res.json(d.models?.map(m => m.name) || []);
  } catch { res.json([]); }
});

// ─── START (moved to bottom after WebSocket setup) ─────────

// ─── SWARM ENDPOINT ────────────────────────────────────────
const { runOrchestrator, SUB_AGENTS } = require("./agent_swarm");

app.get("/api/swarm/agents", (_, res) => res.json(SUB_AGENTS));

app.post("/api/swarm", async (req, res) => {
  const { task, model } = req.body;
  if (!task) return res.status(400).json({ error: "No task" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };

  try {
    await runOrchestrator({
      task,
      model: model || MODEL,
      onEvent: (ev) => send(ev.type, ev),
      maxRounds: 3,
    });
  } catch (e) {
    send("error", { message: e.message });
  }

  res.end();
});

// ─── FILE TREE ENDPOINT ────────────────────────────────────
function buildTree(dir, depth=0, maxDepth=6) {
  if (depth > maxDepth) return [];
  const IGNORE = new Set(['.git','node_modules','.next','dist','build','__pycache__','.DS_Store','.venv','venv','.cache','.agent_state.json','.agent_log.jsonl']);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.'))
      .sort((a,b) => (b.isDirectory()-a.isDirectory()) || a.name.localeCompare(b.name))
      .map(e => {
        const fp = path.join(dir, e.name);
        const isDir = e.isDirectory();
        return { name:e.name, path:fp, type:isDir?'dir':'file', ext:isDir?null:path.extname(e.name).slice(1), children:isDir?buildTree(fp,depth+1,maxDepth):undefined };
      });
  } catch { return []; }
}

app.get("/api/tree", (_,res) => {
  try { res.json({ cwd:CWD, tree:buildTree(CWD) }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

app.get("/api/file", (req,res) => {
  try {
    const fp = resolvePath(req.query.path);
    const content = fs.readFileSync(fp,"utf8");
    const stat = fs.statSync(fp);
    res.json({ path:fp, content, size:stat.size, mtime:stat.mtime });
  } catch(e) { res.status(400).json({ error:e.message }); }
});

app.post("/api/file", (req,res) => {
  try {
    const { path:filePath, content } = req.body;
    const abs = resolvePath(filePath);
    let original = "";
    try { original = fs.readFileSync(abs,"utf8"); } catch {}
    fs.mkdirSync(path.dirname(abs),{recursive:true});
    fs.writeFileSync(abs, content,"utf8");
    res.json({ ok:true, path:abs, original });
  } catch(e) { res.status(400).json({ error:e.message }); }
});

// ══════════════════════════════════════════════════════════
//  TERMINAL  (PTY via node-pty if available, else spawn)
// ══════════════════════════════════════════════════════════
const { WebSocketServer } = require("ws");
const httpServer = require("http").createServer(app);
// NOTE: don't add httpServer.on("request", app) — app is already passed to createServer

// Map of terminalId → {pty/proc, ws}
const terminals = new Map();

let nodePty = null;
try { nodePty = require("node-pty"); } catch {}

const wss = new WebSocketServer({ server: httpServer, path: "/terminal" });

wss.on("connection", (ws, req) => {
  const id = Date.now().toString();
  const shell = process.env.SHELL || "/bin/bash";

  if (nodePty) {
    // Full PTY — best experience
    const pty = nodePty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 220, rows: 50,
      cwd: CWD,
      env: { ...process.env, TERM: "xterm-256color" },
    });
    pty.onData(data => { if (ws.readyState === 1) ws.send(JSON.stringify({ type:"output", data })); });
    pty.onExit(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type:"exit" })); terminals.delete(id); });
    ws.on("message", raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "input")  pty.write(msg.data);
        if (msg.type === "resize") pty.resize(msg.cols, msg.rows);
        if (msg.type === "cwd")    { try { process.chdir(msg.cwd); } catch {} }
      } catch {}
    });
    ws.on("close", () => { try { pty.kill(); } catch {} terminals.delete(id); });
    terminals.set(id, { pty, ws });
  } else {
    // Fallback: line-by-line via spawn
    const proc = spawn(shell, [], { cwd: CWD, env: process.env });
    proc.stdout.on("data", d => ws.readyState===1 && ws.send(JSON.stringify({ type:"output", data:d.toString() })));
    proc.stderr.on("data", d => ws.readyState===1 && ws.send(JSON.stringify({ type:"output", data:d.toString() })));
    proc.on("exit", () => { ws.readyState===1 && ws.send(JSON.stringify({ type:"exit" })); terminals.delete(id); });
    ws.on("message", raw => {
      try { const msg=JSON.parse(raw); if(msg.type==="input") proc.stdin.write(msg.data); } catch {}
    });
    ws.on("close", () => { try { proc.kill(); } catch {} terminals.delete(id); });
    terminals.set(id, { proc, ws });
  }

  ws.send(JSON.stringify({ type:"ready", id, hasPty: !!nodePty, cwd: CWD }));
});

// ── MEMORY ENDPOINTS ──────────────────────────────────────
const MEMORY_FILE = ".agent_memory.json";

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) return JSON.parse(fs.readFileSync(MEMORY_FILE,"utf8"));
  } catch {}
  return { workspaces:{}, global:{} };
}
function saveMemory(m) { fs.writeFileSync(MEMORY_FILE, JSON.stringify(m,null,2)); }

app.get("/api/memory",  (req,res) => res.json(loadMemory()));
app.post("/api/memory", (req,res) => {
  const mem = loadMemory();
  const { workspace, key, value } = req.body;
  if (workspace) {
    if (!mem.workspaces[workspace]) mem.workspaces[workspace] = {};
    mem.workspaces[workspace][key] = value;
  } else { mem.global[key] = value; }
  saveMemory(mem); res.json({ ok:true });
});
app.delete("/api/memory", (req,res) => {
  const { workspace, key } = req.body||{};
  const mem = loadMemory();
  if (workspace && key) delete mem.workspaces?.[workspace]?.[key];
  else if (workspace)   delete mem.workspaces[workspace];
  else if (key)         delete mem.global[key];
  else                  { mem.global={}; mem.workspaces={}; }
  saveMemory(mem); res.json({ ok:true });
});

// ── TASK HISTORY ENDPOINTS ────────────────────────────────
const HISTORY_FILE = ".agent_history.json";

function loadHistory() {
  try { if(fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE,"utf8")); } catch {}
  return [];
}
function appendHistory(task) {
  const hist = loadHistory();
  hist.unshift({ ...task, id: Date.now(), timestamp: new Date().toISOString() });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist.slice(0,200),null,2));
}

app.get("/api/history",     (_,res)=> res.json(loadHistory()));
app.delete("/api/history",  (_,res)=> { try{fs.unlinkSync(HISTORY_FILE);}catch{} res.json({ok:true}); });

// ── WORKSPACES ENDPOINTS ─────────────────────────────────
const WORKSPACES_FILE = ".agent_workspaces.json";

function loadWorkspaces() {
  try { if(fs.existsSync(WORKSPACES_FILE)) return JSON.parse(fs.readFileSync(WORKSPACES_FILE,"utf8")); } catch {}
  return [{ id:"default", name:"Default", cwd: CWD, createdAt: new Date().toISOString() }];
}
function saveWorkspaces(ws) { fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(ws,null,2)); }

app.get("/api/workspaces", (_,res) => res.json(loadWorkspaces()));
app.post("/api/workspaces", (req,res) => {
  const ws = loadWorkspaces();
  const w = { id: Date.now().toString(), name: req.body.name||"Workspace", cwd: req.body.cwd||CWD, createdAt: new Date().toISOString() };
  ws.push(w); saveWorkspaces(ws); res.json(w);
});
app.delete("/api/workspaces/:id", (req,res) => {
  const ws = loadWorkspaces().filter(w=>w.id!==req.params.id);
  saveWorkspaces(ws); res.json({ok:true});
});
app.post("/api/workspaces/:id/activate", (req,res) => {
  const ws = loadWorkspaces().find(w=>w.id===req.params.id);
  if (!ws) return res.status(404).json({error:"Not found"});
  const result = toolCd(ws.cwd);
  res.json({ ok:true, cwd:CWD, message:result });
});

// Inject memory into system prompt helper
function buildSystemPrompt(workspaceName) {
  const mem = loadMemory();
  const wMem = mem.workspaces[workspaceName] || {};
  const gMem = mem.global;
  const memNote = [
    Object.keys(gMem).length ? `\n[GLOBAL MEMORY]\n${Object.entries(gMem).map(([k,v])=>`${k}: ${v}`).join('\n')}` : '',
    Object.keys(wMem).length ? `\n[WORKSPACE MEMORY: ${workspaceName}]\n${Object.entries(wMem).map(([k,v])=>`${k}: ${v}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  return `You are an advanced CLI coding agent. Help users write, edit, debug, and manage code and files.

Available Tools:
read_file(path), write_file(path, content), replace_text(path, old, new),
run_command(command), list_files(path), search_in_files(pattern, directory),
create_dir(path), delete_file(path), http_get(url), python_eval(code),
git_status(), git_diff(file?), grep(pattern, path), cd(path)

Response Format — ONLY valid JSON:
Use tool: {"thought":"why","tool":"name","args":{...}}
Finished: {"thought":"summary","final":"message"}
${memNote}`;
}

// ── PERSONAS ──────────────────────────────────────────────
const PERSONAS = {
  coder:      { name:"Coder",      emoji:"⚡", focus:"You are an expert software engineer. Focus on clean, efficient code. Always read files before editing. Prefer small targeted changes." },
  reviewer:   { name:"Reviewer",   emoji:"🔍", focus:"You are a code reviewer. Analyze code quality, find bugs, security issues, and suggest concrete improvements. Be thorough and specific." },
  docs:       { name:"Docs",       emoji:"📚", focus:"You are a technical writer. Write clear, comprehensive documentation with examples. Read the actual code before writing docs about it." },
  devops:     { name:"DevOps",     emoji:"🚀", focus:"You are a DevOps engineer. Focus on deployment, CI/CD, Docker, shell scripts, and infrastructure automation." },
  tester:     { name:"Tester",     emoji:"🧪", focus:"You are a QA engineer. Write comprehensive tests — unit, integration, and edge cases. Run existing tests to check for regressions. Be thorough." },
  researcher: { name:"Researcher", emoji:"🔬", focus:"You are a codebase researcher. Investigate files, understand patterns, trace data flow, and summarize findings clearly. Read before you report." },
  architect:  { name:"Architect",  emoji:"🏗", focus:"You are a software architect. Think about structure, scalability, and design patterns. Analyze the big picture before suggesting changes." },
};

app.get("/api/personas", (_,res) => res.json(PERSONAS));

// Persona/memory are injected via /api/run using buildSystemPrompt
// /api/run2 reserved for future use


// ── REPLACE httpServer.listen for websocket support ───────
const OLD_PORT = PORT;
httpServer.listen(OLD_PORT, () => {
  console.log(`\n  🤖 Agent server running at http://localhost:${OLD_PORT}`);
  console.log(`  🖥  Terminal WS at ws://localhost:${OLD_PORT}/terminal\n`);
});
