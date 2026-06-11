# 🤖 Coding Agent

Local AI coding agent powered by Ollama — available as CLI and Web UI.

---

## 📁 Structure

```
agent-project/
├── cli/                ← Standalone Python CLI
├── server/             ← Express web server
├── swarm/              ← Sub-Agent Swarm Orchestrator
├── telegram/           ← Telegram Agent Bot
├── shared/             ← Shared utility modules
├── src/                ← React Frontend UI
│   ├── App.jsx         ← Layout and components
│   └── main.jsx        ← React entry point
├── index.html
├── vite.config.js
├── package.json
├── docs/               ← Documentation (HTML pages)
│   ├── index.html
│   ├── setup.html
│   ├── tools.html
│   ├── architecture.html
│   └── faq.html
├── .gitignore
└── setup.sh            ← Automated setup script
```

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

Run the setup script to install dependencies and start the server:

```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Ollama** (in a separate terminal):
   ```bash
   ollama serve
   ```

3. **Pull the model** (if not already downloaded):
   ```bash
   ollama pull qwen2.5-coder:7b
   ```

4. **Start the server**:
   ```bash
   npm run start
   ```

5. **Open your browser** to `http://localhost:5173`

---

## 💻 CLI Usage

The agent is also available as a standalone CLI tool (no server required):

### Interactive Mode

```bash
python cli/agent.py
```

### One-Shot Mode

```bash
python cli/agent.py "your task here"
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/clear` | Clear current session |
| `/status` | Show session info (model, CWD, context size) |
| `/model <name>` | Switch to a different Ollama model |
| `/tools` | List all available agent tools |
| `/ps` | Show background processes |
| `/kill <id>` | Kill a background process |
| `/attach <path>` | Attach an image to the next message |
| `/screenshot <url>` | Take a screenshot of a URL |
| `/cwd` | Show current working directory |
| `/cd <path>` | Change working directory |
| `continue` | Resume a paused session |
| `exit` / `quit` | Exit the CLI |

### Available Tools

The agent has access to the following tools:
- `read_file`, `write_file`, `replace_text` — File operations
- `run_command`, `list_files`, `search_in_files`, `grep` — System operations
- `create_dir`, `delete_file`, `cd` — Directory management
- `http_get`, `search_web` — Web operations
- `python_eval` — Execute Python code
- `git_status`, `git_diff` — Git operations
- `screenshot`, `show_image` — Visual operations
- `ask_human` — Pause for user input

---

---

## 📖 Documentation

Complete documentation is available in the `docs/` folder:

- **[Introduction](docs/index.html)** - Overview of the project
- **[Getting Started](docs/setup.html)** - Installation and setup guide
- **[Tool Reference](docs/tools.html)** - All available agent tools
- **[Architecture](docs/architecture.html)** - System design details
- **[FAQ](docs/faq.html)** - Common questions and troubleshooting

---

## 🛠️ Features

- 🤖 **AI-Powered Coding** - Uses Ollama with qwen2.5-coder model
- 📱 **Responsive Web UI** - Works on desktop and mobile
- 🔧 **Tool Execution** - Read, write, search, and execute commands
- 📊 **Real-Time Logs** - Monitor agent's thought process
- 🚀 **Fast Setup** - Automated installation script
- 🔒 **Secure** - Sandboxed execution environment

---

## 📦 Project Archive

A complete project archive is available as `agent-project.zip`, containing all source files, documentation, and configuration. This is ideal for sharing or deployment.

---

## 📝 License

MIT License - See LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

---

## 📞 Support

For issues and questions:
- Check the [FAQ](docs/faq.html)
- Review the [Architecture](docs/architecture.html) documentation
- Open an issue on GitHub

---

*Built with ❤️ for the future of software engineering*