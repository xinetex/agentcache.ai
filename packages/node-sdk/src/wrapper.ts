import { agentcache, CacheOptions } from './client';

export interface WrapperOptions extends CacheOptions {
    keyGenerator?: (...args: any[]) => string;
}

/**
 * Wraps an async function with caching logic.
 * 
 * @param fn The async function to wrap (e.g., gemini.chat)
 * @param options Caching options
 * @returns A new function with the same signature that caches results
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: WrapperOptions = {}
): T {
    return async function (...args: any[]) {
        // Generate key based on arguments
        const key = options.keyGenerator
            ? options.keyGenerator(...args)
            : JSON.stringify(args);

        // Use getOrSet to handle caching logic
        const result = await agentcache.getOrSet(
            key,
            async () => {
                const res = await fn(...args);
                // Ensure we store stringified result if it's an object
                return typeof res === 'string' ? res : JSON.stringify(res);
            },
            options
        );

        // Parse back if it looks like JSON
        try {
            return JSON.parse(result);
        } catch {
            return result;
        }
    } as T;
}
