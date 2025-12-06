export interface AgentCacheConfig {
    apiKey: string;
    baseUrl?: string;
    namespace?: string;
    defaultTtl?: number;
}

export interface CacheRequest {
    provider: 'openai' | 'anthropic' | 'moonshot' | 'cohere' | 'together' | 'groq';
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    temperature?: number;
    ttl?: number;
    namespace?: string;
    sourceUrl?: string; // For anti-cache
}

export interface CacheResponse {
    hit: boolean;
    response?: string;
    latency: number;
    saved?: string;
    freshness?: {
        status: string;
        age: number;
        freshnessScore: number;
        shouldRefresh: boolean;
    };
    key?: string;
}

export interface Stats {
    tier: string;
    monthlyQuota: number | string;
    used: number;
    remaining: number | string;
    percentUsed: number;
    resetDate: string;
}
