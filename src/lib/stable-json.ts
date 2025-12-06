/**
 * stable-json.ts
 * 
 * Implements deterministic JSON serialization by recursively sorting object keys.
 * Crucial for maximizing cache hit rates in AgentCache.
 * 
 * See Whitepaper: "Optimizing Agentic AI", Section 4.1
 */

export function stableStringify(obj: any): string {
    // 1. Handle primitives
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    // 2. Handle Arrays (maintain order, but recurse on items)
    if (Array.isArray(obj)) {
        return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
    }

    // 3. Handle Objects (sort keys)
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map(key => {
        return JSON.stringify(key) + ':' + stableStringify(obj[key]);
    });

    return '{' + parts.join(',') + '}';
}

/**
 * Helper to compute SHA-256 hash of a stable JSON string.
 * Useful for generating cache keys.
 */
import { createHash } from 'crypto';

export function stableHash(obj: any): string {
    const str = stableStringify(obj);
    return createHash('sha256').update(str).digest('hex');
}
