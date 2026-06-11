// ============================================================
//  shared/json.js  —  Robust JSON parser (used everywhere)
// ============================================================

/**
 * Robustly parse LLM output into a JSON object.
 * Tries multiple strategies: direct parse, strip fences, brace
 * matching, key extraction, and finally returns a plain text marker.
 * @param {string} raw
 * @returns {string} JSON string
 */
function cleanJson(raw) {
  if (!raw) return "{}";

  // Strategy 1: direct parse
  try { JSON.parse(raw); return raw; } catch {}

  // Strategy 2: strip markdown fences
  let s = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try { JSON.parse(s); return s; } catch {}

  // Strategy 3: extract first complete JSON object with brace matching
  let depth = 0, start = -1, inStr = false, escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = raw.slice(start, i + 1);
        try { JSON.parse(candidate); return candidate; } catch {}
      }
    }
  }

  // Strategy 4: try to fix common issues
  let fixed = s
    .replace(/(\"(?:[^\"\\]|\\.)*\")/g, m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"))
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/'/g, '"');
  try { JSON.parse(fixed); return fixed; } catch {}

  // Strategy 5: extract key fields manually if JSON is broken
  const thought = raw.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || "";
  const tool    = raw.match(/"tool"\s*:\s*"([^"]+)"/)?.[1] || "";
  const final_  = raw.match(/"final"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || "";

  if (tool)   return JSON.stringify({ thought, tool, args: {} });
  if (final_) return JSON.stringify({ thought, final: final_ });

  // Give up — return as plain text marker
  return JSON.stringify({ __plain__: true, text: raw });
}

module.exports = { cleanJson };
