// ============================================================
//  server/lib/ollama.js  —  Ollama HTTP client with retry logic
// ============================================================

const http = require("http");
const { OLLAMA_URL, DEFAULT_MODEL } = require("../../shared/constants");

const OLLAMA_RETRY_MAX   = 3;
const OLLAMA_RETRY_DELAY = 2000; // base delay in ms

/**
 * Call Ollama /api/chat and return the assistant message content.
 * Automatically retries on rate-limit errors with exponential backoff.
 * @param {Array<{role:string, content:string}>} messages
 * @param {string} [model]
 * @param {number} [timeout]
 * @returns {Promise<string>}
 */
async function askOllama(messages, model = DEFAULT_MODEL, timeout = 300000) {
  let lastError = null;

  for (let attempt = 0; attempt <= OLLAMA_RETRY_MAX; attempt++) {
    if (attempt > 0) {
      const delay = OLLAMA_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`  ⚠️  Ollama rate limited (attempt ${attempt}/${OLLAMA_RETRY_MAX}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const result = await _callOllama(messages, model, timeout);
      return result;
    } catch (e) {
      lastError = e;
      // only retry on rate-limit errors
      if (!e.message.includes("429") && !e.message.includes("Too Many") && !e.message.includes("rate")) {
        throw e;
      }
    }
  }

  throw lastError || new Error("Ollama API unavailable after multiple attempts");
}

function _callOllama(messages, model, timeout) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } });
    const req = http.request(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`Ollama error: ${parsed.error}`));
          } else {
            resolve(parsed.message.content);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Ollama timeout")); });
    req.write(body);
    req.end();
  });
}

module.exports = { askOllama };
