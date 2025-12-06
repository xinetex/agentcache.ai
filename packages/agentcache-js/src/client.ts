import type { AgentCacheConfig, CacheRequest, CacheResponse, Stats } from './types';
import fetch from 'node-fetch'; // Polyfill for Node environment if needed, though modern Node has fetch

export class AgentCacheClient {
    private config: AgentCacheConfig;
    private baseUrl: string;

    constructor(config: AgentCacheConfig) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://agentcache.ai';
    }

    private async request<T>(path: string, method: string, body?: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-API-Key': this.config.apiKey
        };

        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`AgentCache API Error [${res.status}]: ${errorText}`);
        }

        return res.json() as Promise<T>;
    }

    /**
     * Check if a request is cached (does not return content)
     */
    async check(req: CacheRequest): Promise<{ cached: boolean; key: string, ttl: number }> {
        return this.request('/api/cache/check', 'POST', req);
    }

    /**
     * Get a cached response
     */
    async get(req: CacheRequest): Promise<CacheResponse> {
        return this.request<CacheResponse>('/api/cache/get', 'POST', req);
    }

    /**
     * Set a cached response
     */
    async set(req: CacheRequest, response: string): Promise<any> {
        const payload = {
            ...req,
            response,
            namespace: req.namespace || this.config.namespace
        };
        return this.request('/api/cache/set', 'POST', payload);
    }

    /**
     * Get usage stats
     */
    async stats(): Promise<Stats> {
        return this.request<Stats>('/api/stats', 'GET');
    }

    /**
     * Invalidate cache
     */
    async invalidate(options: { pattern?: string; namespace?: string; url?: string }): Promise<any> {
        return this.request('/api/cache/invalidate', 'POST', options);
    }
}
