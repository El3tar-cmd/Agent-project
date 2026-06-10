# 🤖 Coding Agent

Local AI coding agent powered by Ollama — available as CLI and Web UI.

---

## 📁 Structure

```
agent-project/
├── agent_cli.py        ← CLI version (Python, no server needed)
├── agent_server.js     ← Express backend (Web UI backend)
├── src/
│   ├── App.jsx         ← React UI (responsive, mobile-friendly)
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