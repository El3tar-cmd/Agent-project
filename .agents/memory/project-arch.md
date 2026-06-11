---
name: Project architecture
description: Local AI Coding Agent — overview of all modules and their ports/entry points
---

## Architecture

- **Web UI**: React + Vite on port 5000 (`npm run start` via concurrently)
- **Backend**: Express on port 3131 (`server/index.js`)
- **CLI**: Python (`cli/agent.py` + `cli/tools.py`) — run standalone
- **Telegram bot**: `telegram/bot.js` — connects to backend at SERVER_URL (default localhost:3131)
- **Swarm**: `swarm/orchestrator.js` + `swarm/runner.js` + `swarm/agents.js`

## Key constants (shared/constants.js)
- `MAX_STEPS = 30` (was 100)
- `SWARM_MAX_STEPS = 15` (was 100)
- `MAX_HISTORY_MESSAGES = 30` (new — prevents token explosion)

## Workflow
- Start: `npm run start` → concurrently runs server (3131) + vite (5000)
- Vite proxy: all `/api/*` → port 3131

**Why:** Remember ports and concurrently setup to avoid confusion when debugging.
