// lib/agent-sandbox.js
//
// AgentCache — Background Agent Tool Sandbox Harness.
//
// Provides safe, isolated, and bounded tool execution for autonomous background
// agents. Enforces execution timeouts, output size ceilings, and error boundaries
// to guarantee that no runaway tool call can crash the agent loop.

import { truncateObservation } from './context-compactor.js';

export const SANDBOX_DEFAULTS = {
  TIMEOUT_MS: 15000,
  MAX_OUTPUT_CHARS: 5000,
};

/**
 * Built-in safe tool implementations for background execution.
 */
export const BUILTIN_TOOLS = {
  echo: async (args = {}) => args.text || args.message || JSON.stringify(args),
  
  calculator: async (args = {}) => {
    const expr = String(args.expression || args.expr || '').trim();
    if (!expr) throw new Error('expression required');
    // Only allow safe arithmetic characters
    if (!/^[\d\s\+\-\*\/\(\)\.\%]+$/.test(expr)) {
      throw new Error(`Unsafe expression rejected: ${expr}`);
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${expr})`);
    const res = fn();
    return { expression: expr, result: res };
  },

  json_transform: async (args = {}) => {
    const { data, key } = args;
    if (key && data && typeof data === 'object') {
      return data[key];
    }
    return data;
  },

  noop: async () => ({ ok: true, timestamp: Date.now() }),
};

/**
 * Executes a tool call inside a guarded sandbox with timeout and output bounds.
 *
 * @param {Object} toolCall - { tool: string, args?: any, timeoutMs?: number }
 * @param {Object} [customToolRegistry] - Optional map of custom tool handler functions
 * @returns {Promise<{ success: boolean, tool: string, output?: any, error?: string, durationMs: number }>}
 */
export async function executeTool(toolCall = {}, customToolRegistry = {}) {
  const toolName = toolCall.tool || toolCall.name || 'unknown';
  const args = toolCall.args || toolCall.parameters || {};
  const timeoutMs = toolCall.timeoutMs || SANDBOX_DEFAULTS.TIMEOUT_MS;
  const maxOutputChars = toolCall.maxOutputChars || SANDBOX_DEFAULTS.MAX_OUTPUT_CHARS;

  const startTime = Date.now();

  const registry = {
    ...BUILTIN_TOOLS,
    ...customToolRegistry,
  };

  const handler = registry[toolName];
  if (!handler || typeof handler !== 'function') {
    return {
      success: false,
      tool: toolName,
      error: `Tool "${toolName}" is not registered in the sandbox`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    });

    const executionPromise = Promise.resolve(handler(args));
    const rawResult = await Promise.race([executionPromise, timeoutPromise]);

    const durationMs = Date.now() - startTime;
    const boundedOutput = truncateObservation(rawResult, maxOutputChars);

    return {
      success: true,
      tool: toolName,
      output: boundedOutput,
      durationMs,
    };
  } catch (err) {
    return {
      success: false,
      tool: toolName,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

export default {
  SANDBOX_DEFAULTS,
  BUILTIN_TOOLS,
  executeTool,
};
