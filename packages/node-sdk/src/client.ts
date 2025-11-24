import axios, { AxiosInstance } from 'axios';

export interface AgentCacheConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    defaultTtl?: number;
    disabled?: boolean;
}

export interface CacheOptions {
    ttl?: number;
    namespace?: string;
}

export class AgentCache {
    private client: AxiosInstance;
    private apiKey: string;
    private disabled: boolean;
    private defaultTtl: number;

    constructor(config: AgentCacheConfig = {}) {
        this.apiKey = config.apiKey || process.env.AGENTCACHE_API_KEY || '';
        this.disabled = config.disabled || process.env.AGENTCACHE_ENABLED === 'false';
        this.defaultTtl = config.defaultTtl || 3600;

        const baseUrl = config.baseUrl || process.env.AGENTCACHE_API_URL || 'https://agentcache-lzjb08qkg-drgnflai-jetty.vercel.app';

        if (!this.apiKey && !this.disabled) {
            console.warn('⚠️ AgentCache: No API Key provided. Caching disabled.');
            this.disabled = true;
        }

        this.client = axios.create({
            baseURL: baseUrl,
            timeout: config.timeout || 5000,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'agentcache-node/0.1.0'
            }
        });
    }

    private getNamespacedKey(key: string, namespace?: string): string {
        return namespace ? `${namespace}:${key}` : key;
    }

    async get(key: string, options: CacheOptions = {}): Promise<string | null> {
        if (this.disabled) return null;

        try {
            const fullKey = this.getNamespacedKey(key, options.namespace);
            const encodedKey = encodeURIComponent(fullKey);
            const response = await this.client.get(`/api/cache/get?key=${encodedKey}`);
            return response.data.value;
        } catch (error: any) {
            // Graceful degradation - never throw on cache miss or error
            if (error.response?.status !== 404) {
                console.warn(`⚠️ AgentCache Get Error: ${error.message}`);
            }
            return null;
        }
    }

    async set(key: string, value: string, options: CacheOptions = {}): Promise<boolean> {
        if (this.disabled) return false;

        try {
            const fullKey = this.getNamespacedKey(key, options.namespace);
            await this.client.post('/api/cache/set', {
                key: fullKey,
                value: value,
                ttl: options.ttl || this.defaultTtl
            });
            return true;
        } catch (error: any) {
            console.warn(`⚠️ AgentCache Set Error: ${error.message}`);
            return false;
        }
    }

    async getOrSet(
        key: string,
        fn: () => Promise<string>,
        options: CacheOptions = {}
    ): Promise<string> {
        // 1. Try Cache
        const cached = await this.get(key, options);
        if (cached) return cached;

        // 2. Execute Function
        const result = await fn();

        // 3. Store Result (Fire and forget)
        this.set(key, result, options).catch(() => { });

        return result;
    }
}

export const agentcache = new AgentCache();
