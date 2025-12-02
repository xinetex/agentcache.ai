import { createHash } from 'crypto';
import { redis } from '../redis.js';

export interface ToolCacheOptions {
    ttl?: number; // Seconds
    namespace?: string;
}

/**
 * Decorator/Wrapper for tool functions to enable caching
 * 
 * @param toolName - Unique name of the tool
 * @param fn - The tool function to wrap
 * @param options - Cache options
 */
export function withToolCache<T extends (...args: any[]) => Promise<any>>(
    toolName: string,
    fn: T,
    options: ToolCacheOptions = {}
): T {
    return async function (...args: any[]): Promise<any> {
        const ttl = options.ttl || 3600; // Default 1 hour
        const namespace = options.namespace || 'default';

        // Generate cache key
        // SHA-256(toolName + namespace + JSON(args))
        const argsString = JSON.stringify(args);
        const hash = createHash('sha256')
            .update(`${toolName}:${namespace}:${argsString}`)
            .digest('hex');

        const cacheKey = `cache:tool:${hash}`;

        try {
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                console.log(`[ToolCache] HIT: ${toolName} (${hash})`);
                return JSON.parse(cached);
            }
        } catch (err) {
            console.warn('[ToolCache] Read error:', err);
        }

        // Execute tool
        const start = Date.now();
        const result = await fn(...args);
        const duration = Date.now() - start;

        try {
            // Cache result
            // Only cache if result is JSON serializable
            const payload = JSON.stringify(result);
            await redis.setex(cacheKey, ttl, payload);
            console.log(`[ToolCache] MISS: ${toolName} (${hash}) - Executed in ${duration}ms`);
        } catch (err) {
            console.warn('[ToolCache] Write error:', err);
        }

        return result;
    } as T;
}
