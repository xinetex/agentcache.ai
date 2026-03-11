/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * Shared utility functions for AgentCache.ai
 */

/**
 * Robustly convert a value to a string, handling null/undefined.
 */
export function safeString(v: unknown): string {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}
