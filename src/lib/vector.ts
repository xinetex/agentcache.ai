/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { redis as globalRedis } from './redis.js';
import { VectorClient } from '../infrastructure/VectorClient.js';
import { generateEmbedding } from './llm/embeddings.js';

const vectorClientSingleton = new VectorClient(process.env.VECTOR_SERVICE_URL);

// Keys
const SEQ_KEY = 'vector:seq';
const MAP_UUID_TO_LONG = 'vector:map:u2l';
const MAP_LONG_TO_UUID = 'vector:map:l2u';
const PREFIX_META = 'vector:meta:';

/**
 * HybridVectorIndex: Bridges FAISS (Vectors) and Redis (Metadata)
 * Now supports Dependency Injection for the Redis client.
 */
export class HybridVectorIndex {
    constructor(
        private redis: any = globalRedis,
        private vectorClient: VectorClient = vectorClientSingleton
    ) {}

    async fetch(ids: string[], options?: any): Promise<any[]> {
        return await Promise.all(ids.map(async (id) => {
            const metaStr = await this.redis.get(`${PREFIX_META}${id}`);
            if (!metaStr) return null;

            const record = JSON.parse(metaStr as string);
            let result: any = {
                id: id,
                metadata: record.metadata,
                data: record.data
            };

            if (options?.includeVectors) {
                const longIdStr = await this.redis.hget(MAP_UUID_TO_LONG, id);
                if (longIdStr) {
                    const longId = Number(longIdStr);
                    try {
                        const rawVec = await this.vectorClient.fetch(longId);
                        result.vector = rawVec;
                    } catch (e) {
                        console.warn(`Failed to fetch vector for ${id}`, e);
                    }
                }
            }

            return result;
        }));
    }

    async upsert(records: any | any[]) {
        const docs = Array.isArray(records) ? records : [records];

        for (const record of docs) {
            const id = record.id;
            const metaKey = `${PREFIX_META}${id}`;
            const existingRaw = await this.redis.get(metaKey);
            const existing = existingRaw ? JSON.parse(existingRaw as string) : null;

            let longIdString = await this.redis.hget(MAP_UUID_TO_LONG, id);
            let longId: number;

            if (!longIdString) {
                longId = await this.redis.incr(SEQ_KEY);
                await this.redis.hset(MAP_UUID_TO_LONG, { [id]: longId });
                await this.redis.hset(MAP_LONG_TO_UUID, { [String(longId)]: id });
            } else {
                longId = Number(longIdString);
            }

            const vector = record.vector || await generateEmbedding(record.data || record.metadata?.query || '');
            await this.vectorClient.addVectors([longId], vector);

            await this.redis.set(metaKey, JSON.stringify({
                id,
                data: record.data ?? existing?.data ?? record.metadata?.query ?? '',
                metadata: {
                    ...(existing?.metadata || {}),
                    ...(record.metadata || {}),
                },
            }));
        }
    }

    async query(options: { data?: string; vector?: number[]; topK?: number; includeMetadata?: boolean; includeData?: boolean; filter?: Record<string, any> }) {
        if (options.vector) {
            const results = await this.vectorClient.search(options.vector, options.topK || 3, options.filter);
            return await Promise.all(results.map(async (res) => {
                const uuid = await this.redis.hget(MAP_LONG_TO_UUID, String(res.id));
                if (!uuid) return null;
                const metaStr = await this.redis.get(`${PREFIX_META}${uuid}`);
                if (!metaStr) return null;
                const record = JSON.parse(metaStr as string);
                return {
                    id: uuid,
                    score: res.distance,
                    data: record.data,
                    metadata: record.metadata
                };
            })).then(r => r.filter(x => x !== null));
        }

        // Implementation of queryMemory inline or imported (using this.redis)
        const queryVector = await generateEmbedding(options.data || '');
        const results = await this.vectorClient.search(queryVector, options.topK || 3, options.filter);
        return await Promise.all(results.map(async (res) => {
            const uuid = await this.redis.hget(MAP_LONG_TO_UUID, String(res.id));
            if (!uuid) return null;
            const metaStr = await this.redis.get(`${PREFIX_META}${uuid}`);
            if (!metaStr) return null;
            const record = JSON.parse(metaStr as string);
            return {
                id: uuid,
                score: res.distance,
                data: record.data,
                metadata: record.metadata
            };
        })).then(r => r.filter(x => x !== null));
    }

    async delete(id: string) {
        await this.redis.del(`${PREFIX_META}${id}`);
        const longIdStr = await this.redis.hget(MAP_UUID_TO_LONG, id);
        if (longIdStr) {
            await this.redis.hdel(MAP_UUID_TO_LONG, id);
            await this.redis.hdel(MAP_LONG_TO_UUID, String(longIdStr));
        }
    }
}

// Export the singleton for backward compatibility
export const vectorIndex = new HybridVectorIndex();

/**
 * Functional exports for existing callers
 */
export async function upsertMemory(id: string, text: string, metadata: Record<string, any>): Promise<void> {
    return vectorIndex.upsert({ id, data: text, metadata });
}

export async function queryMemory(query: string, topK: number = 3, filter?: Record<string, any>): Promise<any[]> {
    return vectorIndex.query({ data: query, topK, filter });
}
