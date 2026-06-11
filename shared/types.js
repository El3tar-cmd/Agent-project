// ============================================================
//  shared/types.js  —  Shared type definitions & interfaces
// ============================================================

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} AgentDef
 * @property {string} name
 * @property {string} emoji
 * @property {string} color
 * @property {string} description
 * @property {string} system
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} tool
 * @property {string} thought
 * @property {Object} args
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} tool
 * @property {string} result
 * @property {boolean} ok
 */

/**
 * @typedef {Object} AgentState
 * @property {string} saved_at
 * @property {string} context
 * @property {Message[]} history
 */

/**
 * @typedef {Object} Workspace
 * @property {string} id
 * @property {string} name
 * @property {string} cwd
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Persona
 * @property {string} name
 * @property {string} emoji
 * @property {string} focus
 */

/**
 * @typedef {Object} SubTask
 * @property {string} id
 * @property {string} agent
 * @property {string} task
 * @property {string[]} depends_on
 * @property {number} priority
 */

/**
 * @typedef {Object} SwarmPlan
 * @property {string} thought
 * @property {string} plan
 * @property {SubTask[]} subtasks
 */

module.exports = {};
