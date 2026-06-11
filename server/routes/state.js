// ============================================================
//  server/routes/state.js  —  Agent State & Logs Routes
// ============================================================

const express = require("express");
const fs = require("fs");
const { STATE_FILE, LOG_FILE, PERSONAS } = require("../../shared/constants");

const router = express.Router();

/**
 * Save current agent run state.
 */
function saveState(ctx, hist) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ saved_at: new Date().toISOString(), context: ctx, history: hist }, null, 2));
}

/**
 * Load agent run state from file.
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const d = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return { context: d.context || "", history: d.history || [] };
    }
  } catch {}
  return { context: "", history: [] };
}

/**
 * Append entry to log file.
 */
function appendLog(entry) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {}
}

router.get("/state", (req, res) => {
  res.json(loadState());
});

router.delete("/state", (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch {}
  res.json({ ok: true });
});

router.get("/log", (req, res) => {
  try {
    const lines = fs.existsSync(LOG_FILE)
      ? fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").slice(-50).map(l => JSON.parse(l))
      : [];
    res.json(lines);
  } catch {
    res.json([]);
  }
});

router.get("/models", async (req, res) => {
  try {
    const r = await fetch("http://localhost:11434/api/tags");
    const d = await r.json();
    res.json(d.models?.map(m => m.name) || []);
  } catch {
    res.json([]);
  }
});

router.get("/personas", (req, res) => {
  res.json(PERSONAS);
});

module.exports = {
  router,
  saveState,
  loadState,
  appendLog
};
