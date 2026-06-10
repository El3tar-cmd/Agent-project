# 🤖 Coding Agent

**Coding Agent** is a professional-grade, local AI-powered development assistant. It leverages the power of Ollama to provide a seamless coding experience through both a high-performance Command Line Interface (CLI) and a modern, responsive Web User Interface.

Designed for developers who prioritize privacy and speed, Coding Agent operates entirely on your local machine, allowing for secure file manipulation, system command execution, and intelligent code generation without relying on external cloud services.

---

## 📚 Documentation

For detailed information on using and extending the agent, please refer to our professional documentation:

- [🏠 Home / Overview](docs/index.html) - General introduction and project goals.
- [🛠️ API Reference](docs/api.html) - Detailed technical specifications of the agent's capabilities.
- [⚙️ Setup Guide](docs/setup.html) - Step-by-step installation and configuration instructions.

---

## 📁 Structure


agent-project/
├── agent_cli.py        ← CLI version (Python, no server needed)
├── agent_server.js     ← Express backend (Web UI backend)
├── src/
│   ├── App.jsx         ← React UI (responsive, mobile-friendly)
│   └── main.jsx        ← React entry point
├── index.html
├── vite.config.js
└── package.json


---

## 🚀 Setup

### 1. Install Node dependencies

bash
npm install


### 2. Make sure Ollama is running

bash
ollama serve
# and have at least one model pulled:
ollama pull qwen2.5-coder:7b


---

## ▶️ Run

### Option A — CLI only (no Node needed)

bash
python agent_cli.py


CLI commands:
- `exit` / `quit` — exit
- `/clear` — clear saved session
- `/status` — show session info
- `/log` — show last 10 log entries
- `/model <name>` — switch model
- `/tools` — list all tools
- `continue` — resume paused session

---

### Option B — Web UI

**Start everything with one command:**

bash
npm run start


This runs the Express server (port 3131) + Vite dev server (port 5173) together.

Then open: **http://localhost:5173**

**Or run separately:**

bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run dev


---

### Option C — Build for production

bash
npm run build
# serves the built files via the Express server
node agent_server.js
# open http://localhost:3131


---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read a file |
| `write_file` | Write/create a file |
| `replace_text` | Find & replace in a file |
| `run_command` | Run a shell command |
| `list_files` | List directory contents |
| `search_in_files` | Search text in files recursively |
| `create_dir` | Create a directory |
| `delete_file` | Delete a file or directory |
| `http_get` | Fetch a URL |
| `python_eval` | Run Python code |
| `git_status` | Git status |
| `git_diff` | Git diff |
| `grep` | Grep in files |

---

## ⚙️ Config

Edit the top of `agent_server.js` or `agent_cli.py`:

js
const MODEL = "qwen2.5-coder:7b";  // change model
const MAX_STEPS = 100;              // max steps per run
const MAX_CTX_CHARS = 12000;        // context trim limit


---

## 📱 Mobile

The Web UI is fully responsive:
- Sidebar hidden by default → tap ☰ to open
- Touch-friendly confirm dialogs
- Auto-resizing textarea