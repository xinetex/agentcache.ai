// lib/context-compactor.js
//
// AgentCache — Context Compactor & Observation Distiller.
//
// Solves context window explosion and reasoning degradation for long-running
// background agents. Compresses large tool results, extracts structured facts,
// and enforces sliding-window distillation across multi-turn agent runs.
//
// PURE and deterministic.

export const COMPACT_DEFAULTS = {
  MAX_OBSERVATION_CHARS: 2000,
  MAX_TOTAL_TOKENS_ESTIMATE: 8000,
  KEEP_RECENT_TURNS: 4,
};

// Rough token estimator (~4 characters per token for English text/code)
export function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

/**
 * Truncates bulky tool outputs (e.g. 50KB webpage scrapes, large logs)
 * to keep context tightly bounded.
 */
export function truncateObservation(output, maxChars = COMPACT_DEFAULTS.MAX_OBSERVATION_CHARS) {
  if (output === null || output === undefined) return '';
  if (typeof output !== 'string') {
    const str = JSON.stringify(output, null, 2);
    if (str.length <= maxChars) return output;
    return truncateObservation(str, maxChars);
  }
  if (output.length <= maxChars) return output;

  const keepHead = Math.floor(maxChars * 0.6);
  const keepTail = Math.floor(maxChars * 0.35);
  const omitted = output.length - (keepHead + keepTail);

  return `${output.slice(0, keepHead)}\n\n[... Truncated ${omitted} characters / ~${Math.ceil(omitted / 4)} tokens omitted by AgentCache ContextCompactor ...]\n\n${output.slice(output.length - keepTail)}`;
}

/**
 * Condenses a list of tool call results into a high-density summary map.
 */
export function summarizeToolResults(results = []) {
  if (!Array.isArray(results)) return [];
  return results.map((res, index) => {
    const name = res.name || res.tool || `tool_${index + 1}`;
    const success = res.success !== false && !res.error;
    const output = res.output !== undefined ? res.output : res.result || res.error || '';
    const truncated = truncateObservation(output, 800);
    return {
      tool: name,
      status: success ? 'ok' : 'failed',
      summary: typeof truncated === 'string' ? truncated.trim() : JSON.stringify(truncated),
    };
  });
}

/**
 * Compacts a conversation history using a sliding window:
 * Preserves initial prompt + recent N turns intact; older turns are consolidated into
 * a distilled state observation summary.
 */
export function compactHistory(messages = [], opts = {}) {
  const maxTokens = opts.maxTokens || COMPACT_DEFAULTS.MAX_TOTAL_TOKENS_ESTIMATE;
  const keepRecent = opts.keepRecentTurns || COMPACT_DEFAULTS.KEEP_RECENT_TURNS;

  if (!Array.isArray(messages) || messages.length <= keepRecent + 1) {
    return {
      messages: messages || [],
      compacted: false,
      estimatedTokens: estimateTokens(messages),
      distilledTurns: 0,
    };
  }

  const currentTokens = estimateTokens(messages);
  if (currentTokens <= maxTokens) {
    return {
      messages,
      compacted: false,
      estimatedTokens: currentTokens,
      distilledTurns: 0,
    };
  }

  // Preserve the system/initial task prompt
  const initial = messages[0];
  const tail = messages.slice(-keepRecent);
  const middle = messages.slice(1, -keepRecent);

  // Distill middle turns into concise bullet points
  const distilledBullets = middle.map((m, i) => {
    const role = m.role || 'step';
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    const snippet = content.length > 250 ? content.slice(0, 240) + '...' : content;
    return `- [${role.toUpperCase()} #${i + 1}]: ${snippet.replace(/\n+/g, ' ')}`;
  });

  const distilledMessage = {
    role: 'system',
    content: `[AgentCache Context Distillation: Consolidated ${middle.length} earlier turns to preserve token budget]\n${distilledBullets.join('\n')}`,
    _distilled: true,
  };

  const compactedMessages = [initial, distilledMessage, ...tail];

  return {
    messages: compactedMessages,
    compacted: true,
    estimatedTokens: estimateTokens(compactedMessages),
    distilledTurns: middle.length,
    tokensSavedEstimate: Math.max(0, currentTokens - estimateTokens(compactedMessages)),
  };
}

export default {
  COMPACT_DEFAULTS,
  estimateTokens,
  truncateObservation,
  summarizeToolResults,
  compactHistory,
};
