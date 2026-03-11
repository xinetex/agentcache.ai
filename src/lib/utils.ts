/**
 * Shared utility functions for AgentCache.ai
 */

/**
 * Robustly convert a value to a string, handling null/undefined.
 */
export function safeString(v: unknown): string {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}
