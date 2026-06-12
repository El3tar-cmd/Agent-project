// ============================================================
//  shared/constants.js  —  Shared constants across all modules
// ============================================================

/** Dangerous shell command patterns that are always blocked */
const DANGEROUS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+~/,
  /mkfs/,
  /dd\s+if=/,
  /:\(\){\:|:&};:/,
  /sudo\s+rm/,
];

/** Default Ollama model */
const DEFAULT_MODEL = process.env.AGENT_MODEL || "qwen3-coder-next:cloud";

/** Ollama API base URL — override via OLLAMA_URL in .env */
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/** Maximum agent steps before pausing (lowered to prevent token waste & loops) */
const MAX_STEPS = 30;

/** Maximum context characters before summarization */
const MAX_CTX_CHARS = 12000;

/** Maximum messages kept in conversation history to prevent token explosion */
const MAX_HISTORY_MESSAGES = 30;

/** Agent state file */
const STATE_FILE = ".agent_state.json";

/** Agent log file */
const LOG_FILE = ".agent_log.jsonl";

/** Agent memory file */
const MEMORY_FILE = ".agent_memory.json";

/** Task history file */
const HISTORY_FILE = ".agent_history.json";

/** Workspaces config file */
const WORKSPACES_FILE = ".agent_workspaces.json";

/** Swarm constants */
const SWARM_MAX_STEPS    = 15;   // lowered from 100 — prevents per-agent token explosion
const SWARM_STEP_TIMEOUT = 120000; // 2 min per step
const SWARM_MAX_ROUNDS   = 5;

/** Available agent personas */
const PERSONAS = {
  coder:      { name: "Coder",      emoji: "⚡", focus: "You are an expert software engineer. Focus on clean, efficient code. Always read files before editing. Prefer small targeted changes." },
  reviewer:   { name: "Reviewer",   emoji: "🔍", focus: "You are a code reviewer. Analyze code quality, find bugs, security issues, and suggest concrete improvements. Be thorough and specific." },
  docs:       { name: "Docs",       emoji: "📚", focus: "You are a technical writer. Write clear, comprehensive documentation with examples. Read the actual code before writing docs about it." },
  devops:     { name: "DevOps",     emoji: "🚀", focus: "You are a DevOps engineer. Focus on deployment, CI/CD, Docker, shell scripts, and infrastructure automation." },
  tester:     { name: "Tester",     emoji: "🧪", focus: "You are a QA engineer. Write comprehensive tests — unit, integration, and edge cases. Run existing tests to check for regressions. Be thorough." },
  researcher: { name: "Researcher", emoji: "🔬", focus: "You are a codebase researcher. Investigate files, understand patterns, trace data flow, and summarize findings clearly. Read before you report." },
  architect:  { name: "Architect",  emoji: "🏗",  focus: "You are a software architect. Think about structure, scalability, and design patterns. Analyze the big picture before suggesting changes." },
};

module.exports = {
  DANGEROUS,
  DEFAULT_MODEL,
  OLLAMA_URL,
  MAX_STEPS,
  MAX_CTX_CHARS,
  MAX_HISTORY_MESSAGES,
  STATE_FILE,
  LOG_FILE,
  MEMORY_FILE,
  HISTORY_FILE,
  WORKSPACES_FILE,
  SWARM_MAX_STEPS,
  SWARM_STEP_TIMEOUT,
  SWARM_MAX_ROUNDS,
  PERSONAS,
};
