// ============================================================
//  server/lib/safety.js  —  Dangerous command detection
// ============================================================

const { DANGEROUS } = require("../../shared/constants");

/**
 * Returns true if the command matches any dangerous pattern.
 * @param {string} cmd
 * @returns {boolean}
 */
function isDangerous(cmd) {
  return DANGEROUS.some(p => p.test(cmd));
}

module.exports = { isDangerous, DANGEROUS };
