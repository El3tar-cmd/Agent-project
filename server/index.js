// ============================================================
//  server/index.js  —  Main Server Entry Point
// ============================================================

// Load .env file when running locally (Replit uses its own Secrets panel)
try { require("dotenv").config(); } catch {}

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");

const { router: stateRouter } = require("./routes/state");
const { router: workspaceRouter } = require("./routes/workspace");
const { router: filesRouter, UPLOAD_DIR } = require("./routes/files");
const agentRouter = require("./routes/agent");
const swarmRouter = require("./routes/swarm");
const processesRouter = require("./routes/processes");
const { initTerminal } = require("./routes/terminal");
const { SCREENSHOT_DIR } = require("./tools/screenshot");

const app = express();
const PORT = 3131;

// ── MIDDLEWARES ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── STATIC SERVERS ─────────────────────────────────────────
app.use("/.screenshots", express.static(SCREENSHOT_DIR));
app.use("/.uploads", express.static(UPLOAD_DIR));

// ── ROUTES ─────────────────────────────────────────────────
app.use("/api", stateRouter);
app.use("/api", workspaceRouter);
app.use("/api", filesRouter);
app.use("/api", agentRouter);
app.use("/api", swarmRouter);
app.use("/api", processesRouter);

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize WebSocket Terminal Server
initTerminal(httpServer);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`\n  🤖 Agent server running at http://localhost:${PORT}`);
  console.log(`  🖥  Terminal WS at ws://localhost:${PORT}/terminal\n`);
});
