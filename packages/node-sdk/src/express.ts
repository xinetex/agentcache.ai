import { Request, Response, NextFunction } from 'express';
import { agentcache, CacheOptions } from './client';

export interface MiddlewareOptions extends CacheOptions {
    keyGenerator?: (req: Request) => string;
    namespaceFromReq?: (req: Request) => string;
    shouldCache?: (req: Request) => boolean;
}

export function agentCacheMiddleware(options: MiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Skip if caching is disabled or condition not met
            if (options.shouldCache && !options.shouldCache(req)) {
                return next();
            }

            // Generate Cache Key
            const key = options.keyGenerator
                ? options.keyGenerator(req)
                : `${req.method}:${req.originalUrl}:${JSON.stringify(req.body)}`;

            // Determine Namespace
            const namespace = options.namespaceFromReq
                ? options.namespaceFromReq(req)
                : options.namespace;

            // 1. Check Cache
            const cached = await agentcache.get(key, { namespace });

            if (cached) {
                res.setHeader('X-AgentCache', 'HIT');
                return res.json(JSON.parse(cached));
            }

            // 2. Intercept Response to Cache it
            res.setHeader('X-AgentCache', 'MISS');

            const originalSend = res.json;
            res.json = function (body: any) {
                // Restore original method to prevent recursion
                res.json = originalSend;

                // Fire and forget cache set
                agentcache.set(key, JSON.stringify(body), {
                    namespace,
                    ttl: options.ttl
                }).catch(err => console.warn('Cache write failed:', err));

                // Send response
                return originalSend.call(this, body);
            };

            next();
        } catch (err: any) {
            console.error('🔥 Middleware Crash:', err);
            next(); // Fail open
        }
    };
}
