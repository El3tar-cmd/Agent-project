# 🤖 Coding Agent

> Local AI coding agent powered by Ollama — available as **Web UI**, **CLI**, **Telegram Bot**, and **Multi-Agent Swarm**.  
> Runs fully offline on your machine. Designed for Termux/Android and Linux/macOS/Windows.

---

## 📁 Project Structure

```
agent-project/
├── cli/                ← Standalone Python CLI (no server required)
│   ├── agent.py        ← CLI entry point
│   ├── tools.py        ← All 24 tool implementations (Python)
│   └── ui.py           ← Terminal rendering helpers
├── server/             ← Express.js backend (port 3131)
│   ├── routes/         ← API route handlers
│   ├── tools/          ← Server-side tool implementations
│   │   ├── extra.js    ← find_files, zip, diff_files, lint
│   │   ├── web.js      ← http_get, http_post, search_web
│   │   └── ...
│   └── lib/            ← Shared utilities (ollama, cwd, prompts)
├── swarm/              ← Multi-Agent Swarm Orchestrator
│   ├── runner.js       ← Swarm execution engine
│   └── agents.js       ← Agent definitions & system prompts
├── telegram/           ← Telegram Bot
│   └── bot.js          ← Bot with all commands and file upload
├── shared/             ← Shared constants & JSON utilities
├── src/                ← React + Vite frontend (port 5000)
│   ├── App.jsx         ← Main layout with sidebar, panels
│   ├── components/     ← Chat, Editor, Swarm, Terminal, Processes
│   └── hooks/          ← useAgent, useWorkspace, useEditor
├── docs/               ← HTML documentation pages
│   ├── index.html      ← Introduction
│   ├── setup.html      ← Setup guide
│   ├── tools.html      ← All 24 tools reference
│   ├── architecture.html ← System design
│   └── faq.html        ← Common questions
├── vite.config.js
├── package.json
└── setup.sh            ← Automated setup script
```

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Start Ollama (separate terminal)
ollama serve

# 3. Pull a model
ollama pull qwen2.5-coder:7b

# 4. Start the app
npm run start
```

Open **http://localhost:5000** in your browser.

---

## 💻 CLI Usage

Standalone Python agent — no server or browser required.

```bash
# Interactive mode
python cli/agent.py

# One-shot mode
python cli/agent.py "refactor this function to use async/await"
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/clear` | Clear current session |
| `/status` | Show model, CWD, context size |
| `/model <name>` | Switch Ollama model |
| `/tools` | List all 24 available tools |
| `/ps` | Show background processes |
| `/kill <id>` | Kill a background process |
| `/attach <path>` | Attach image to next message |
| `/screenshot <url>` | Take a screenshot |
| `/save [filename]` | Export session to Markdown file |
| `/log` | Show last 10 tool-call log entries |
| `/cwd` | Show current working directory |
| `/cd <path>` | Change working directory |
| `continue` | Resume a paused session (> 50 steps) |
| `exit` / `quit` | Exit the CLI |

---

## 🤖 Telegram Bot

Run the bot alongside the server for remote access from anywhere.

```bash
# Set your bot token in .env or environment
TELEGRAM_TOKEN=your_token_here
ALLOWED_USERS=123456789,987654321

npm run telegram
```

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + command list |
| `/model` | Switch Ollama model (inline keyboard) |
| `/persona` | Switch agent persona |
| `/swarm <task>` | Run multi-agent swarm |
| `/files` | List current workspace files |
| `/status` | Server status, model, memory |
| `/cwd` | Show working directory |
| `/cd <path>` | Change directory |
| `/screenshot <url>` | Take screenshot and send photo |
| `/processes` | List background processes |
| `/kill <id>` | Kill a background process |
| `/stop` | Stop running agent |
| `/clear` | Clear session |
| `/skip` | Skip ask_human prompt |

> **File Upload:** Send any file (code, config, text, zip) to the bot — it will save it to the workspace and auto-analyze text files.  
> **Photo Upload:** Send a photo and the bot will pass it to the agent for visual analysis.

---

## 🐝 Multi-Agent Swarm

The swarm breaks complex tasks into parallel sub-tasks executed by specialized agents:

| Agent | Role |
|-------|------|
| 🏗 **Architect** | Plans and decomposes the task |
| 🔬 **Researcher** | Reads files, gathers context |
| ⚡ **Coder** | Writes and edits code |
| 🔍 **Reviewer** | Reviews for bugs and security |
| 🧪 **Tester** | Writes and runs tests |
| 📚 **Docs** | Creates documentation |
| 🚀 **DevOps** | Handles deployment & scripts |

Launch from the Web UI (Swarm tab) or via Telegram: `/swarm <task>`

---

## 🛠️ Available Tools (24 total)

### File System
| Tool | Description |
|------|-------------|
| `read_file` | Read full file content with line numbers |
| `read_lines` | Read a specific line range |
| `write_file` | Create or overwrite a file |
| `append_file` | Append content to a file |
| `replace_text` | Targeted find-and-replace |
| `list_files` | List directory contents |
| `search_in_files` | Case-insensitive recursive search |
| `grep` | Regex search with context |
| `create_dir` | Create directory (recursive) |
| `delete_file` | Delete file or directory |
| `find_files` | Find files by name pattern or extension |

### Shell & Code
| Tool | Description |
|------|-------------|
| `run_command` | Execute shell commands |
| `python_eval` | Run Python code in-process |
| `lint` | Run ESLint (JS), flake8 (Python), or syntax check |

### Web & APIs
| Tool | Description |
|------|-------------|
| `http_get` | Fetch URL content |
| `http_post` | POST/PUT/PATCH to any API with JSON body |
| `search_web` | Search DuckDuckGo |
| `screenshot` | Take screenshot of URL or local file |

### Archives & Diff
| Tool | Description |
|------|-------------|
| `zip` | Create, extract, or list zip/tar.gz archives |
| `diff_files` | Unified diff between any two files |

### Git
| Tool | Description |
|------|-------------|
| `git_status` | Current git status |
| `git_diff` | Show diff for a file or all changes |

### Navigation & Reasoning
| Tool | Description |
|------|-------------|
| `cd` | Change working directory |
| `think` | Internal planning step (no side effects) |
| `ask_human` | Pause and ask user for clarification |

---

## 🖥️ Web UI Features

- **Chat Panel** — Stream agent thoughts and tool calls in real-time
- **Code Editor** — Built-in syntax-highlighted editor with undo/redo
- **File Tree** — Browse and open workspace files
- **Terminal** — Integrated WebSocket terminal
- **Process Manager** — Monitor and kill background processes
- **Swarm Panel** — Visual multi-agent dashboard
- **Preview Panel** — Embedded browser for local ports
- **📌 Pinned Prompts** — Save and reuse prompts (localStorage)
- **Auto-Plan Toggle** — Enable step-by-step planning before execution
- **Export Chat** — Download full conversation as Markdown

---

## 📖 Documentation

Full HTML docs in the `docs/` folder:

- **[Introduction](docs/index.html)** — Overview and key concepts
- **[Getting Started](docs/setup.html)** — Installation on all platforms
- **[Tool Reference](docs/tools.html)** — All 24 tools with examples
- **[Architecture](docs/architecture.html)** — System design and data flow
- **[FAQ](docs/faq.html)** — Troubleshooting and common questions

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `PORT` | `3131` | Express server port |
| `VITE_PORT` | `5000` | Vite dev server port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `DEFAULT_MODEL` | `qwen2.5-coder:7b` | Default LLM model |
| `TELEGRAM_TOKEN` | — | Telegram bot token |
| `ALLOWED_USERS` | — | Comma-separated Telegram user IDs |
| `MAX_STEPS` | `50` | Max agent steps per request |

---

## 📝 License

MIT License — See `LICENSE` file for details.
