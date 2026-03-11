
import { redis } from '../lib/redis.js';
import { coherenceService } from './CoherenceService.js';
import { createHash } from 'crypto';

interface Watcher {
    url: string;
    lastEtag?: string;
    lastSemanticHash?: string;
    patterns: string[]; // Redis key patterns to invalidate
}

/**
 * InvalidationService: The Active Maintenance Swarm.
 * Monitors external sources and automatically refreshes/invalidates stale memory.
 */
export class InvalidationService {
    private watchers: Map<string, Watcher> = new Map();
    private activeAgents = 0;

    /**
     * Register a new external source to watch.
     */
    async registerWatcher(url: string, patterns: string[]) {
        console.log(`[Invalidation] 🔭 Registering watcher for: ${url}`);
        this.watchers.set(url, { url, patterns });
        await redis.sadd('system:watchers', url);
    }

    /**
     * The main maintenance loop called by AutonomyService.
     */
    async runMaintenanceStep() {
        this.activeAgents = this.watchers.size;
        for (const [url, watcher] of this.watchers) {
            try {
                await this.poll(watcher);
            } catch (err) {
                console.error(`[Invalidation] Failed to poll ${url}:`, err);
            }
        }
    }

    private async poll(watcher: Watcher) {
        // In a real environment, we'd use Firecrawl or fetch with Etags
        const response = await fetch(watcher.url, {
            headers: watcher.lastEtag ? { 'If-None-Match': watcher.lastEtag } : {}
        });

        if (response.status === 304) return; // Unchanged

        const content = await response.text();
        const etag = response.headers.get('etag');
        const semanticHash = createHash('sha256').update(content.trim()).digest('hex');

        if (semanticHash === watcher.lastSemanticHash) return; // Content looks the same

        // DETECT SEMANTIC DRIFT (Phase 4.2)
        console.log(`[Invalidation] 🌊 Semantic change detected at ${watcher.url}. Evaluating drift...`);
        
        // Use CoherenceService logic to check if this is significant
        // For MVP, we'll assume any hash change is significant if not just whitespace
        await this.invalidatePatterns(watcher.patterns);
        
        // Update watcher state
        watcher.lastEtag = etag || undefined;
        watcher.lastSemanticHash = semanticHash;
        
        await redis.incr('stats:maintenance:heals');
    }

    private async invalidatePatterns(patterns: string[]) {
        console.log(`[Invalidation] 🧹 Invalidating patterns: ${patterns.join(', ')}`);
        for (const pattern of patterns) {
            const keys = await redis.keys(pattern);
            if (keys && keys.length > 0) {
                await redis.del(...keys);
                console.log(`   ✅ Cleared ${keys.length} keys for pattern ${pattern}`);
            }
        }
    }

    async getStatus() {
        const heals = await redis.get('stats:maintenance:heals') || "0";
        return {
            activeAgents: this.activeAgents,
            heals: parseInt(heals as string),
            watchersCount: this.watchers.size
        };
    }
}

export const invalidationService = new InvalidationService();
