#!/usr/bin/env node
// ============================================================
//  Telegram Agent Bot
//  Connects to agent_server.js (port 3131)
//
//  Setup:
//    npm install node-telegram-bot-api
//    export TELEGRAM_TOKEN="your_bot_token"
//    node telegram_bot.js
//
//  Get token: talk to @BotFather on Telegram → /newbot
// ============================================================

const TelegramBot = require("node-telegram-bot-api");
const http        = require("http");
const https       = require("https");
const fs          = require("fs");

// ── CONFIG ──────────────────────────────────────────────────
const TOKEN      = process.env.TELEGRAM_TOKEN;
const SERVER_URL = process.env.AGENT_SERVER || "http://localhost:3131";
const ALLOWED_USERS = process.env.ALLOWED_USERS
  ? process.env.ALLOWED_USERS.split(",").map(s => s.trim())
  : [];  // empty = allow everyone

if (!TOKEN) {
  console.error("❌  Set TELEGRAM_TOKEN environment variable");
  console.error("    export TELEGRAM_TOKEN=your_token_here");
  process.exit(1);
}

// ── BOT INIT ────────────────────────────────────────────────
const bot = new TelegramBot(TOKEN, { polling: true });

// ── STATE ───────────────────────────────────────────────────
const sessions = new Map();  // chatId → { model, persona, running, abortCtrl }

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { model: null, persona: "coder", running: false });
  }
  return sessions.get(chatId);
}

// ── AUTH ─────────────────────────────────────────────────────
function isAllowed(msg) {
  if (ALLOWED_USERS.length === 0) return true;
  const username = msg.from?.username || "";
  const userId   = String(msg.from?.id || "");
  return ALLOWED_USERS.includes(username) || ALLOWED_USERS.includes(userId);
}

// ── SERVER API HELPERS ──────────────────────────────────────
async function apiGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL + path);
    const lib = url.protocol === "https:" ? https : http;
    lib.get(url.href, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on("error", reject);
  });
}

async function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(SERVER_URL + path);
    const data = JSON.stringify(body);
    const lib  = url.protocol === "https:" ? https : http;
    const req  = lib.request(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on("error", reject);
    req.write(data); req.end();
  });
}

// ── SSE STREAMING RUNNER ─────────────────────────────────────
async function runAgent(chatId, message, model, persona, msgId) {
  const session = getSession(chatId);
  if (session.running) {
    bot.sendMessage(chatId, "⏳ Agent is already running. Send /stop to cancel.");
    return;
  }

  session.running = true;
  const url  = new URL(SERVER_URL + "/api/run");
  const body = JSON.stringify({ message, model, persona });
  const lib  = url.protocol === "https:" ? https : http;

  // ── Live status message ──────────────────────────────────
  let statusMsgId = null;
  let statusText  = "";
  let lastEditAt  = 0;
  const EDIT_INTERVAL = 1500; // ms between edits

  async function setStatus(text) {
    statusText = text;
    const now = Date.now();
    if (now - lastEditAt < EDIT_INTERVAL) return; // throttle
    lastEditAt = now;
    try {
      if (!statusMsgId) {
        const m = await bot.sendMessage(chatId, text, { parse_mode:"HTML", disable_web_page_preview:true });
        statusMsgId = m.message_id;
      } else {
        await bot.editMessageText(text, { chat_id:chatId, message_id:statusMsgId, parse_mode:"HTML", disable_web_page_preview:true });
      }
    } catch {}
  }

  async function deleteStatus() {
    if (!statusMsgId) return;
    try { await bot.deleteMessage(chatId, statusMsgId); } catch {}
    statusMsgId = null;
  }

  async function sendMsg(text, opts={}) {
    const chunks = chunkText(text, 4000);
    for (const chunk of chunks) {
      try {
        await bot.sendMessage(chatId, chunk, { parse_mode:"HTML", disable_web_page_preview:true, ...opts });
      } catch {
        try { await bot.sendMessage(chatId, chunk, { disable_web_page_preview:true }); } catch {}
      }
    }
  }

  // ── State ────────────────────────────────────────────────
  let stepCount   = 0;
  let finalAnswer = null;
  let currentThought = "";
  let streamBuf   = "";
  let streamTimer = null;
  let planShown   = false;

  // Step tracker: array of {tool, args, result, thought}
  const steps = [];
  let curStep = null;

  function buildStatusText() {
    const bar = "▰".repeat(Math.min(stepCount, 10)) + "▱".repeat(Math.max(0, 10-stepCount));
    let lines = [`🤖 <b>Agent Running</b>  <code>${bar}</code>  step ${stepCount}`];
    if (currentThought) lines.push(`\n💭 <i>${escHtml(currentThought.slice(0,120))}${currentThought.length>120?"…":""}</i>`);
    if (curStep?.tool) {
      lines.push(`\n⚙️ <b>${escHtml(curStep.tool)}</b>`);
      const argStr = formatArgs(curStep.args);
      if (argStr) lines.push(`<code>${escHtml(argStr)}</code>`);
    }
    if (steps.length > 1) {
      const recent = steps.slice(-3).map(s =>
        `  ${toolEmoji(s.tool)} ${escHtml(s.tool)}${s.ok?"  ✓":"  ✗"}`
      ).join("\n");
      lines.push(`\n<b>Recent:</b>\n${recent}`);
    }
    return lines.join("\n");
  }

  return new Promise(resolve => {
    const req = lib.request(url.href, {
      method:"POST",
      headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}
    }, res => {
      let buf = "";

      res.on("data", chunk => {
        buf += chunk.toString();
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try { handleEvent(JSON.parse(line.slice(5).trim())); } catch {}
        }
      });

      res.on("end", async () => {
        session.running = false;
        clearTimeout(streamTimer);
        await deleteStatus();
        if (finalAnswer) {
          await sendFinalMessage(chatId, finalAnswer, stepCount, steps);
        } else {
          await sendMsg(`⚠️ <b>Session ended</b>\n\nNo final answer. Send <b>continue</b> to resume.`);
        }
        resolve();
      });

      res.on("error", async e => {
        session.running = false;
        await deleteStatus();
        await sendMsg(`❌ <b>Connection error:</b> ${escHtml(e.message)}`);
        resolve();
      });
    });

    req.on("error", async e => {
      session.running = false;
      try { await deleteStatus(); await sendMsg(`❌ <b>Server error:</b> ${escHtml(e.message)}`); } catch {}
      resolve();
    });

    req.write(body); req.end();
    session.abortReq = req;

    // ── EVENT HANDLER ──────────────────────────────────────
    async function handleEvent(ev) {
      switch (ev.type) {

        case "step":
          stepCount++;
          curStep = { tool:null, args:{}, result:null };
          await setStatus(buildStatusText());
          break;

        case "thought":
          currentThought = ev.message || "";
          await setStatus(buildStatusText());
          break;

        case "tool_call":
          curStep = { tool: ev.tool, args: ev.args||{}, result:null, ok:false };
          await setStatus(buildStatusText());
          break;

        case "tool_result": {
          if (curStep) { curStep.result = ev.result; curStep.ok = !ev.result?.startsWith("ERROR"); }
          const tool   = ev.tool || curStep?.tool || "tool";
          const result = ev.result || "";
          const args   = curStep?.args || {};

          // Push to steps history
          steps.push({ tool, args, result, ok: !result.startsWith("ERROR") });

          // Send rich result card
          await sendToolCard(tool, args, result);

          curStep = null;
          await setStatus(buildStatusText());
          break;
        }

        case "stream_start":
          streamBuf = "";
          await setStatus(`▶️ <b>Running:</b> <code>${escHtml(ev.command||"")}</code>\n\n<i>Streaming output…</i>`);
          break;

        case "stream_output":
          streamBuf += ev.data || "";
          clearTimeout(streamTimer);
          streamTimer = setTimeout(async () => {
            const lines = streamBuf.trim().split("\n").slice(-15);
            await setStatus(
              `▶️ <b>Terminal output:</b>\n<pre>${escHtml(lines.join("\n").slice(0,600))}</pre>`
            );
          }, 500);
          break;

        case "stream_end": {
          clearTimeout(streamTimer);
          const outLines = streamBuf.trim().split("\n").slice(-20).join("\n");
          if (outLines.trim()) {
            await sendMsg(`💻 <b>Command output:</b>\n<pre>${escHtml(outLines.slice(0,3000))}</pre>`);
          }
          streamBuf = "";
          break;
        }

        case "planning":
          await setStatus(`🏗 <b>Making a plan…</b>\n<i>Analyzing task…</i>`);
          break;

        case "plan_ready":
          if (ev.plan?.length && !planShown) {
            planShown = true;
            const planLines = ev.plan.map((s,i) => `${i+1}. ${s}`).join("\n");
            await sendMsg(`📋 <b>Plan ready</b>\n\n${escHtml(planLines)}`);
          }
          break;

        case "summarizing":
          await setStatus(`📝 <b>Summarizing context…</b>\n<i>Context too large, compressing…</i>`);
          break;

        case "inline_diff": {
          const diff = buildRichDiff(ev.before||"", ev.after||"");
          if (diff) {
            await sendMsg(
              `📝 <b>File changed:</b> <code>${escHtml(ev.path)}</code>\n\n<pre>${escHtml(diff)}</pre>`
            );
          }
          break;
        }

        case "ask_human": {
          session.pendingAsk = { runId: ev.runId, question: ev.question };
          await deleteStatus();
          statusMsgId = null;
          await sendMsg(
            `❓ <b>Agent needs your input:</b>\n\n${escHtml(ev.question)}\n\n<i>Reply with your answer, or send /skip</i>`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text:"⏭ Skip", callback_data:`human_skip_${ev.runId}` }
                ]]
              }
            }
          );
          break;
        }

        case "human_answered":
          await sendMsg(`✅ <b>Answer sent to agent</b>`);
          break;

        case "confirm_request":
          await deleteStatus();
          statusMsgId = null;
          await sendMsg(
            `⚠️ <b>Confirm action:</b>\n\n` +
            `Tool: <code>${escHtml(ev.tool)}</code>\n` +
            `<pre>${escHtml(ev.preview||"")}</pre>`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text:"✔ Run it", callback_data:`confirm_yes_${ev.runId}` },
                  { text:"✘ Cancel", callback_data:`confirm_no_${ev.runId}` }
                ]]
              }
            }
          );
          break;

        case "final":
          finalAnswer = ev.message;
          break;

        case "paused":
          await deleteStatus();
          await sendMsg(`⏸ <b>Agent paused</b> after ${stepCount} steps.\n\nSend <b>continue</b> to resume.`);
          break;

        case "error":
          await deleteStatus();
          await sendMsg(`❌ <b>Error:</b> ${escHtml(ev.message||"Unknown error")}`);
          break;
      }
    }

    // ── TOOL RESULT CARD ────────────────────────────────────
    async function sendToolCard(tool, args, result) {
      const emoji = toolEmoji(tool);
      const isErr = result?.startsWith("ERROR");
      const header = `${emoji} <b>${escHtml(tool)}</b>${isErr ? " ❌" : " ✅"}`;

      switch (tool) {
        case "read_file": {
          const path  = args.path || "";
          const lines = (result||"").split("\n");
          const preview = lines.slice(0,30).join("\n");
          const more    = lines.length > 30 ? `\n<i>…+${lines.length-30} more lines</i>` : "";
          await sendMsg(
            `${header}\n<code>${escHtml(path)}</code>  <i>(${lines.length} lines)</i>\n\n` +
            `<pre>${escHtml(preview.slice(0,2000))}</pre>${more}`
          );
          break;
        }

        case "write_file": {
          const path = args.path || "";
          const size = (args.content||"").length;
          await sendMsg(`${header}\n<code>${escHtml(path)}</code>\n<i>${size} chars written</i>`);
          break;
        }

        case "replace_text": {
          const path  = args.path || "";
          const oldSnip = (args.old||"").slice(0,60).replace(/\n/g,"↵");
          const newSnip = (args.new||"").slice(0,60).replace(/\n/g,"↵");
          await sendMsg(
            `${header}\n<code>${escHtml(path)}</code>\n\n` +
            `<b>Before:</b> <code>${escHtml(oldSnip)}</code>\n` +
            `<b>After:</b>  <code>${escHtml(newSnip)}</code>`
          );
          break;
        }

        case "list_files": {
          const path  = args.path || ".";
          const items = (result||"").split("\n").filter(Boolean);
          const dirs  = items.filter(l=>l.startsWith("📁"));
          const files = items.filter(l=>l.startsWith("📄"));
          const text  = items.slice(0,40).join("\n");
          await sendMsg(
            `${header}\n<code>${escHtml(path)}</code>\n` +
            `<i>${dirs.length} folders, ${files.length} files</i>\n\n<pre>${escHtml(text)}</pre>`
          );
          break;
        }

        case "run_command": {
          // streaming output handled separately — just skip here
          if (!isErr && streamBuf) break;
          const cmd    = args.command || "";
          const output = (result||"").split("\n").slice(0,20).join("\n");
          await sendMsg(
            `${header}\n<code>$ ${escHtml(cmd.slice(0,100))}</code>\n\n` +
            `<pre>${escHtml(output.slice(0,2000))}</pre>`
          );
          break;
        }

        case "grep":
        case "search_in_files": {
          const lines   = (result||"").split("\n").filter(Boolean);
          const pattern = args.pattern || args.query || "";
          const preview = lines.slice(0,15).join("\n");
          await sendMsg(
            `${header}\n<i>Pattern:</i> <code>${escHtml(pattern)}</code>\n` +
            `<i>${lines.length} matches</i>\n\n<pre>${escHtml(preview.slice(0,1500))}</pre>`
          );
          break;
        }

        case "search_web": {
          const query   = args.query || args.q || "";
          const results = (result||"").split("\n\n").filter(Boolean).slice(0,4);
          const text    = results.join("\n\n");
          await sendMsg(
            `${header}\n🔍 <i>${escHtml(query)}</i>\n\n${escHtml(text.slice(0,2500))}`
          );
          break;
        }

        case "python_eval": {
          const code    = (args.code||"").split("\n").slice(0,5).join("\n");
          const output  = result||"";
          await sendMsg(
            `${header}\n<pre>${escHtml(code.slice(0,300))}</pre>\n\n` +
            `<b>Output:</b>\n<pre>${escHtml(output.slice(0,800))}</pre>`
          );
          break;
        }

        case "git_status":
        case "git_diff": {
          const out = (result||"").split("\n").slice(0,25).join("\n");
          await sendMsg(`${header}\n<pre>${escHtml(out.slice(0,2000))}</pre>`);
          break;
        }

        case "http_get": {
          const url   = args.url || "";
          const lines = (result||"").split("\n");
          const status = lines[0] || "";
          const body   = lines.slice(1,6).join("\n");
          await sendMsg(
            `${header}\n🌐 <code>${escHtml(url.slice(0,80))}</code>\n` +
            `<i>${escHtml(status)}</i>\n<pre>${escHtml(body.slice(0,500))}</pre>`
          );
          break;
        }

        case "create_dir":
        case "cd":
          await sendMsg(`${header}\n<code>${escHtml(result||"")}</code>`);
          break;

        case "delete_file":
          await sendMsg(`${header}\n<code>${escHtml(result||"")}</code>`);
          break;

        default:
          if (isErr) {
            await sendMsg(`${header}\n<pre>${escHtml((result||"").slice(0,500))}</pre>`);
          }
          // for unknown tools with OK result, skip to avoid spam
          break;
      }
    }
  });
}

// ── SEND FINAL MESSAGE ──────────────────────────────────────
async function sendFinalMessage(chatId, text, steps, stepsArr) {
  const toolCount = stepsArr?.length || 0;
  const header = `✅ <b>Done</b>  •  ${steps} steps  •  ${toolCount} tool calls\n${"─".repeat(20)}\n\n`;
  const chunks  = chunkText(text, 3800);
  for (let i = 0; i < chunks.length; i++) {
    const prefix = i === 0 ? header : "";
    try {
      await bot.sendMessage(chatId, prefix + escHtml(chunks[i]), {
        parse_mode:"HTML", disable_web_page_preview:true
      });
    } catch {
      try { await bot.sendMessage(chatId, (i===0?`✅ Done (${steps} steps)\n\n`:"")+chunks[i]); } catch {}
    }
  }
}

// ── SWARM RUNNER ─────────────────────────────────────────────
async function runSwarm(chatId, task, model) {
  const session = getSession(chatId);
  if (session.running) { bot.sendMessage(chatId, "⏳ Already running."); return; }
  session.running = true;

  const msg = await bot.sendMessage(chatId,
    `🐝 <b>Swarm starting…</b>\n<i>${escHtml(task.slice(0,100))}</i>`,
    { parse_mode:"HTML" }
  );
  const statusId = msg.message_id;

  const url  = new URL(SERVER_URL + "/api/swarm");
  const body = JSON.stringify({ task, model });
  const lib  = url.protocol==="https:" ? https : http;

  const agentStatus = {};  // agentId → { status, task, steps, thought, tool }
  let finalMsg = "";
  let phase    = "";
  let lastEdit = 0;

  async function updateSwarm() {
    const now = Date.now();
    if (now - lastEdit < 1200) return;
    lastEdit = now;

    const agLines = Object.entries(agentStatus).map(([a,s]) => {
      const icon   = { running:"🔄", done:"✅", error:"❌", idle:"⬜" }[s.status]||"⬜";
      const emoji  = { architect:"🏗",researcher:"🔬",coder:"⚡",reviewer:"🔍",tester:"🧪",docs:"📚",devops:"🚀" }[a]||"🤖";
      const detail = s.status==="running"
        ? (s.tool ? `  ⚙️ <i>${escHtml(s.tool)}</i>` : s.thought ? `  💭 <i>${escHtml((s.thought||"").slice(0,50))}</i>` : "")
        : s.status==="done" ? `  ✓ <i>${escHtml((s.result||"").slice(0,60))}</i>` : "";
      return `${icon} ${emoji} <b>${a}</b>${detail}`;
    }).join("\n");

    const phaseIcon = { planning:"🏗",execution:"⚡",synthesis:"🧬" }[phase]||"🔄";
    const txt = `🐝 <b>Agent Swarm</b> ${phaseIcon}\n\n${agLines||"<i>Initializing…</i>"}`;

    try {
      await bot.editMessageText(txt, { chat_id:chatId, message_id:statusId, parse_mode:"HTML" });
    } catch {}
  }

  return new Promise(resolve => {
    const req = lib.request(url.href, {
      method:"POST",
      headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}
    }, res => {
      let buf = "";

      res.on("data", c => {
        buf += c.toString();
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            handleSwarmEv(ev);
          } catch {}
        }
      });

      res.on("end", async () => {
        session.running = false;
        // final edit showing all done
        const allDone = Object.entries(agentStatus)
          .map(([a,s])=>`${s.status==="done"?"✅":"❌"} ${a}: ${(s.result||"").slice(0,80)}`)
          .join("\n");
        try {
          await bot.editMessageText(
            `🐝 <b>Swarm Complete</b>\n\n${allDone}`,
            { chat_id:chatId, message_id:statusId, parse_mode:"HTML" }
          );
        } catch {}
        if (finalMsg) await sendFinalMessage(chatId, finalMsg, 0, []);
        resolve();
      });

      res.on("error", async e => {
        session.running = false;
        bot.sendMessage(chatId, `❌ Swarm error: ${e.message}`);
        resolve();
      });
    });

    req.on("error", async e => {
      session.running = false;
      bot.sendMessage(chatId, `❌ Swarm request error: ${e.message}`);
      resolve();
    });

    req.write(body); req.end();

    async function handleSwarmEv(ev) {
      switch (ev.type) {
        case "phase":
          phase = ev.phase || "";
          await updateSwarm();
          break;
        case "plan":
          if (ev.plan?.subtasks?.length) {
            const tasks = ev.plan.subtasks.map(t =>
              `${{"researcher":"🔬","coder":"⚡","reviewer":"🔍","tester":"🧪","docs":"📚","devops":"🚀","architect":"🏗"}[t.agent]||"🤖"} <b>${t.agent}</b>: ${escHtml(t.task.slice(0,80))}`
            ).join("\n");
            try {
              await bot.sendMessage(chatId,
                `📋 <b>Swarm Plan</b> — ${ev.plan.subtasks.length} tasks\n\n${tasks}`,
                { parse_mode:"HTML" }
              );
            } catch {}
          }
          break;
        case "batch_start":
          if (ev.batch?.length) {
            const agents = ev.batch.map(t=>t.agent).join(", ");
            try { await bot.sendMessage(chatId, `⚡ <b>Running in parallel:</b> ${escHtml(agents)}`, { parse_mode:"HTML" }); } catch {}
          }
          break;
        case "agent_start":
          agentStatus[ev.agent] = { status:"running", task:ev.task, steps:0, thought:"", tool:"", result:"" };
          await updateSwarm();
          break;
        case "agent_step":
          if (agentStatus[ev.agent]) agentStatus[ev.agent].steps = ev.step;
          await updateSwarm();
          break;
        case "agent_thought":
          if (agentStatus[ev.agent]) agentStatus[ev.agent].thought = ev.message;
          await updateSwarm();
          break;
        case "agent_tool":
          if (agentStatus[ev.agent]) agentStatus[ev.agent].tool = `${ev.tool}(${JSON.stringify(ev.args||{}).slice(0,40)})`;
          await updateSwarm();
          break;
        case "agent_done":
          if (agentStatus[ev.agent]) {
            agentStatus[ev.agent].status = "done";
            agentStatus[ev.agent].result = typeof ev.result==="string" ? ev.result : JSON.stringify(ev.result);
            agentStatus[ev.agent].tool   = "";
            // send agent result card
            try {
              const r = (agentStatus[ev.agent].result||"").slice(0,600);
              await bot.sendMessage(chatId,
                `✅ <b>${ev.agent}</b> done\n\n<pre>${escHtml(r)}</pre>`,
                { parse_mode:"HTML" }
              );
            } catch {}
          }
          await updateSwarm();
          break;
        case "agent_error":
          if (agentStatus[ev.agent]) { agentStatus[ev.agent].status="error"; agentStatus[ev.agent].result=ev.message; }
          try { await bot.sendMessage(chatId, `❌ <b>${ev.agent}</b>: ${escHtml(ev.message)}`, { parse_mode:"HTML" }); } catch {}
          await updateSwarm();
          break;
        case "final":
          finalMsg = ev.message;
          break;
        case "error":
          try { await bot.sendMessage(chatId, `❌ ${escHtml(ev.message)}`, { parse_mode:"HTML" }); } catch {}
          break;
      }
    }
  });
}

// ── UTILS ────────────────────────────────────────────────────
function toolEmoji(tool) {
  const map = {
    read_file:"📖", write_file:"✍️", replace_text:"🔄",
    run_command:"💻", list_files:"📂", search_in_files:"🔍",
    create_dir:"📁", delete_file:"🗑️", http_get:"🌐",
    python_eval:"🐍", git_status:"📊", git_diff:"📊",
    grep:"🔎", cd:"📍", search_web:"🔍", ask_human:"❓",
  };
  return map[tool] || "⚙️";
}

function formatArgs(args) {
  if (!args || !Object.keys(args).length) return "";
  const key = args.path || args.command || args.query || args.pattern || args.url || args.code || "";
  return String(key).slice(0,80).replace(/\n/g,"↵");
}

function buildRichDiff(before, after) {
  if (!before && !after) return "";
  const ol = (before||"").split("\n"), nl = (after||"").split("\n");
  const lines = [];
  const max = Math.min(Math.max(ol.length, nl.length), 40);
  let changes = 0;
  for (let i = 0; i < max; i++) {
    if (ol[i] !== nl[i]) {
      changes++;
      if (ol[i] !== undefined) lines.push(`- ${ol[i].slice(0,80)}`);
      if (nl[i] !== undefined) lines.push(`+ ${nl[i].slice(0,80)}`);
    }
  }
  if (!changes) return "";
  return lines.join("\n");
}

function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i+size));
  return chunks.length ? chunks : [""];
}

function buildSimpleDiff(before, after) {
  if (!before && !after) return "";
  const ol = (before||"").split("\n"), nl = (after||"").split("\n");
  const lines = [];
  const max = Math.max(ol.length, nl.length);
  for (let i = 0; i < Math.min(max, 30); i++) {
    if (ol[i] !== nl[i]) {
      if (ol[i] !== undefined) lines.push(`- ${ol[i]}`);
      if (nl[i] !== undefined) lines.push(`+ ${nl[i]}`);
    }
  }
  return lines.join("\n");
}

// ── COMMANDS ─────────────────────────────────────────────────
bot.onText(/\/start/, async msg => {
  if (!isAllowed(msg)) return;
  const name = msg.from?.first_name || "there";
  bot.sendMessage(msg.chat.id,
    `👋 <b>Hello ${escHtml(name)}!</b>\n\n` +
    `I'm your local AI coding agent.\n\n` +
    `<b>Commands:</b>\n` +
    `/model — switch Ollama model\n` +
    `/persona — switch agent persona\n` +
    `/swarm &lt;task&gt; — run multi-agent swarm\n` +
    `/status — server status\n` +
    `/cwd — show working directory\n` +
    `/cd &lt;path&gt; — change directory\n` +
    `/stop — stop running agent\n` +
    `/clear — clear session\n\n` +
    `Just type any message to chat with the agent!`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/status/, async msg => {
  if (!isAllowed(msg)) return;
  try {
    const [models, cwd, mem] = await Promise.all([
      apiGet("/api/models"),
      apiGet("/api/cwd"),
      apiGet("/api/memory"),
    ]);
    const session = getSession(msg.chat.id);
    bot.sendMessage(msg.chat.id,
      `🖥 <b>Server Status</b>\n\n` +
      `🟢 agent_server.js is running\n` +
      `📁 CWD: <code>${escHtml(cwd.cwd||"?")}</code>\n` +
      `🤖 Models: ${(models||[]).slice(0,5).join(", ")}\n` +
      `⚡ Persona: ${session.persona}\n` +
      `📊 Memory entries: ${Object.keys(mem?.global||{}).length}`,
      { parse_mode: "HTML" }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Can't reach server: ${e.message}`);
  }
});

bot.onText(/\/cwd/, async msg => {
  if (!isAllowed(msg)) return;
  try {
    const d = await apiGet("/api/cwd");
    bot.sendMessage(msg.chat.id, `📁 CWD: <code>${escHtml(d.cwd)}</code>`, { parse_mode:"HTML" });
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/cd (.+)/, async (msg, match) => {
  if (!isAllowed(msg)) return;
  try {
    const d = await apiPost("/api/cwd", { dir: match[1].trim() });
    if (d.cwd) bot.sendMessage(msg.chat.id, `✅ CWD → <code>${escHtml(d.cwd)}</code>`, { parse_mode:"HTML" });
    else bot.sendMessage(msg.chat.id, `❌ ${d.error}`);
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/model/, async msg => {
  if (!isAllowed(msg)) return;
  try {
    const models = await apiGet("/api/models");
    if (!models?.length) return bot.sendMessage(msg.chat.id, "No models found");
    const buttons = models.slice(0,10).map(m => [{ text: m, callback_data: `model_${m}` }]);
    bot.sendMessage(msg.chat.id, "Choose a model:", {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/persona/, msg => {
  if (!isAllowed(msg)) return;
  const personas = [
    ["⚡ Coder", "🔍 Reviewer"],
    ["📚 Docs", "🚀 DevOps"],
    ["🧪 Tester", "🔬 Researcher"],
    ["🏗 Architect"]
  ];
  const buttons = personas.map(row =>
    row.map(p => ({ text: p, callback_data: `persona_${p.split(" ")[1].toLowerCase()}` }))
  );
  bot.sendMessage(msg.chat.id, "Choose a persona:", { reply_markup: { inline_keyboard: buttons } });
});

bot.onText(/\/stop/, async msg => {
  if (!isAllowed(msg)) return;
  const session = getSession(msg.chat.id);
  if (session.running) {
    try { session.abortReq?.destroy(); } catch {}
    session.running = false;
    bot.sendMessage(msg.chat.id, "⏹ Agent stopped.");
  } else {
    bot.sendMessage(msg.chat.id, "Nothing is running.");
  }
});

bot.onText(/\/clear/, async msg => {
  if (!isAllowed(msg)) return;
  try {
    await apiPost("/api/state", {});  // clear is a DELETE but let's handle
    await fetch(SERVER_URL + "/api/state", { method:"DELETE" }).catch(()=>{});
    sessions.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, "✅ Session cleared.");
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/skip/, async msg => {
  if (!isAllowed(msg)) return;
  const session = getSession(msg.chat.id);
  if (session.pendingAsk) {
    await apiPost("/api/human", { runId: session.pendingAsk.runId, answer: "skip" });
    session.pendingAsk = null;
    bot.sendMessage(msg.chat.id, "⏭ Skipped.");
  }
});

bot.onText(/\/swarm (.+)/, async (msg, match) => {
  if (!isAllowed(msg)) return;
  const session = getSession(msg.chat.id);
  await runSwarm(msg.chat.id, match[1].trim(), session.model);
});

// ── CALLBACK QUERIES (inline buttons) ──────────────────────
bot.on("callback_query", async query => {
  const chatId = query.message.chat.id;
  const data   = query.data;

  if (data.startsWith("human_skip_")) {
    const runId = data.slice(11);
    await apiPost("/api/human", { runId, answer: "skip" });
    bot.answerCallbackQuery(query.id, { text: "⏭ Skipped" });
    const session = getSession(chatId);
    session.pendingAsk = null;
  }

  if (data.startsWith("model_")) {
    const model = data.slice(6);
    getSession(chatId).model = model;
    bot.answerCallbackQuery(query.id, { text: `✅ Model: ${model}` });
    bot.editMessageText(`✅ Model set to: <code>${escHtml(model)}</code>`, {
      chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML"
    });
  }

  if (data.startsWith("persona_")) {
    const persona = data.slice(8);
    getSession(chatId).persona = persona;
    bot.answerCallbackQuery(query.id, { text: `✅ Persona: ${persona}` });
    bot.editMessageText(`✅ Persona set to: <b>${escHtml(persona)}</b>`, {
      chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML"
    });
  }

  if (data.startsWith("confirm_yes_")) {
    const runId = data.slice(12);
    await apiPost("/api/confirm", { runId, confirmed: true });
    bot.answerCallbackQuery(query.id, { text: "✔ Confirmed" });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId, message_id: query.message.message_id
    });
  }

  if (data.startsWith("confirm_no_")) {
    const runId = data.slice(11);
    await apiPost("/api/confirm", { runId, confirmed: false });
    bot.answerCallbackQuery(query.id, { text: "✘ Cancelled" });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId, message_id: query.message.message_id
    });
  }
});

// ── MAIN MESSAGE HANDLER ────────────────────────────────────
// ── /processes — show background processes ──────────────────
bot.onText(/\/processes/, async msg => {
  if (!isAllowed(msg)) return;
  try {
    const procs = await apiGet("/api/processes");
    if (!procs?.length) return bot.sendMessage(msg.chat.id, "⚙️ No processes yet.");

    const lines = procs.slice(0,15).map(p => {
      const icon = p.status==="running"?"🔄":p.status==="done"?"✅":p.status==="error"?"❌":"○";
      const cmd  = p.cmd.slice(0,60);
      const out  = p.output ? `\n<pre>${escHtml(p.output.slice(-200))}</pre>` : "";
      return `${icon} <code>${escHtml(cmd)}</code> <i>[${p.id}]</i>${out}`;
    }).join("\n\n");

    const running = procs.filter(p=>p.status==="running");
    const header  = `⚙️ <b>Processes</b> — ${procs.length} total, ${running.length} running\n\n`;
    bot.sendMessage(msg.chat.id, header+lines, { parse_mode:"HTML" });
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/kill (\d+)/, async (msg, match) => {
  if (!isAllowed(msg)) return;
  try {
    await fetch(SERVER_URL+`/api/processes/${match[1]}`, { method:"DELETE" });
    bot.sendMessage(msg.chat.id, `✅ Process ${match[1]} killed.`);
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

// ── /screenshot <url or file> ────────────────────────────────
bot.onText(/\/screenshot (.+)/, async (msg, match) => {
  if (!isAllowed(msg)) return;
  const target = match[1].trim();
  try {
    bot.sendMessage(msg.chat.id, `📸 Taking screenshot of: <code>${escHtml(target)}</code>…`, { parse_mode:"HTML" });
    const d = await apiPost("/api/screenshot", { url:target, fullPage:false });
    if (d.error) return bot.sendMessage(msg.chat.id, `❌ ${d.error}`);
    // fetch and send the image
    const imgUrl = SERVER_URL + d.url;
    await bot.sendPhoto(msg.chat.id, imgUrl, {
      caption:`📸 <b>Screenshot</b>\n<code>${escHtml(target)}</code>`,
      parse_mode:"HTML"
    });
  } catch(e) { bot.sendMessage(msg.chat.id, `❌ Screenshot error: ${e.message}`); }
});

// ── PHOTO HANDLER — user sends image to agent ────────────────
bot.on("photo", async msg => {
  if (!isAllowed(msg)) return;
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  const caption = msg.caption?.trim() || "Describe this image and tell me what you see. If it's code or UI, analyze it in detail.";

  try {
    // Get highest resolution photo
    const photo    = msg.photo[msg.photo.length - 1];
    const fileInfo = await bot.getFile(photo.file_id);
    const fileUrl  = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;

    bot.sendMessage(chatId, "📥 Downloading image…");

    // Download image
    const res  = await fetch(fileUrl);
    const buf  = Buffer.from(await res.arrayBuffer());
    const ext  = fileInfo.file_path.split(".").pop() || "jpg";
    const name = `tg_${Date.now()}.${ext}`;

    // Upload to server
    const formData = JSON.stringify({
      data: "data:image/" + ext + ";base64," + buf.toString("base64"),
      ext, name
    });
    const uploaded = await fetch(SERVER_URL + "/api/upload/base64", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:formData
    }).then(r=>r.json());

    if (!uploaded.ok) return bot.sendMessage(chatId, "❌ Upload failed");

    const prompt = `${caption}\n\n[Attached image: ${uploaded.path}]`;
    bot.sendMessage(chatId, `📎 Image attached. Running agent…`);
    await runAgent(chatId, prompt, session.model, session.persona, msg.message_id);

  } catch(e) { bot.sendMessage(chatId, `❌ Photo error: ${e.message}`); }
});

// ── DOCUMENT HANDLER — user sends file ───────────────────────
bot.on("document", async msg => {
  if (!isAllowed(msg)) return;
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  const doc     = msg.document;
  const caption = msg.caption?.trim() || `Analyze this file: ${doc.file_name}`;

  // only handle text/code files
  const textTypes = ["text/","application/json","application/xml","application/javascript","application/x-python"];
  if (!textTypes.some(t => doc.mime_type?.startsWith(t)) && !doc.file_name?.match(/\.(js|ts|py|json|html|css|md|txt|sh|yaml|yml|env|jsx|tsx)$/i)) {
    return bot.sendMessage(chatId, "⚠️ Only text/code files are supported.");
  }

  try {
    const fileInfo = await bot.getFile(doc.file_id);
    const fileUrl  = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;
    const res      = await fetch(fileUrl);
    const text     = await res.text();

    // Save to CWD
    const savePath = `/tmp/${doc.file_name}`;
    await apiPost("/api/file", { path: savePath, content: text });

    const prompt = `${caption}\n\n[File saved at: ${savePath}]\nContent:\n\`\`\`\n${text.slice(0,3000)}\n\`\`\``;
    bot.sendMessage(chatId, `📄 File received: <code>${escHtml(doc.file_name)}</code>`, { parse_mode:"HTML" });
    await runAgent(chatId, prompt, session.model, session.persona, msg.message_id);
  } catch(e) { bot.sendMessage(chatId, `❌ File error: ${e.message}`); }
});

// ── MAIN MESSAGE HANDLER ────────────────────────────────────
bot.on("message", async msg => {
  if (!isAllowed(msg)) { bot.sendMessage(msg.chat.id, "⛔ Not authorized."); return; }
  if (msg.text?.startsWith("/")) return;
  if (msg.photo || msg.document) return; // handled above

  const text = msg.text?.trim();
  if (!text) return;

  const chatId  = msg.chat.id;
  const session = getSession(chatId);

  if (session.pendingAsk) {
    const { runId } = session.pendingAsk;
    session.pendingAsk = null;
    await apiPost("/api/human", { runId, answer:text });
    bot.sendMessage(chatId, "✅ Answer sent to agent.");
    return;
  }

  await runAgent(chatId, text, session.model, session.persona, msg.message_id);
});

// ── START ────────────────────────────────────────────────────
console.log("\n  🤖 Telegram Agent Bot started");
console.log(`  📡 Connected to: ${SERVER_URL}`);
if (ALLOWED_USERS.length) console.log(`  🔒 Allowed users: ${ALLOWED_USERS.join(", ")}`);
else console.log("  ⚠️  No ALLOWED_USERS set — open to everyone");
console.log("\n  Commands: /start /model /persona /swarm /processes /kill /screenshot /status /cwd /cd /stop /clear\n");

bot.on("polling_error", e => console.error("Polling error:", e.message));
