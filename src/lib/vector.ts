import { redis } from './redis.js';
import { VectorClient } from '../infrastructure/VectorClient.js';
import { generateEmbedding } from './llm/embeddings.js';

// Hybrid Vector Store (FAISS + Redis)
// FAISS (C#) stores Vectors + Long IDs
// Redis stores Metadata + UUID<->Long Mapping

const vectorClient = new VectorClient(process.env.VECTOR_SERVICE_URL);

// Keys
const SEQ_KEY = 'vector:seq';
const MAP_UUID_TO_LONG = 'vector:map:u2l';
const MAP_LONG_TO_UUID = 'vector:map:l2u';
const PREFIX_META = 'vector:meta:';

/**
 * Store a memory chunk in the Hybrid Store
 */
export async function upsertMemory(id: string, text: string, metadata: Record<string, any>): Promise<void> {
    // 1. Get or Assign Long ID for FAISS
    let longIdString = await redis.hget(MAP_UUID_TO_LONG, id);
    let longId: number;

    if (!longIdString) {
        longId = await redis.incr(SEQ_KEY);
        // Store mappings
        await redis.hset(MAP_UUID_TO_LONG, id, longId);
        await redis.hset(MAP_LONG_TO_UUID, longId, id);
    } else {
        longId = Number(longIdString);
    }

    // 2. Generate Embedding (if not provided in metadata, assuming caller handles this or we do it here)
    // The previous implementation didn't generate embedding inside upsert, but DriftWalker does.
    // However, CognitiveEngine implementation stubbed it. 
    // Ideally, we should generate it here if we want to be drop-in replacement.
    // Let's generate it here for robustness.
    const embedding = await generateEmbedding(text);

    // 3. Store in FAISS (C#)
    await vectorClient.addVectors([longId], embedding);

    // 4. Store Metadata in Redis
    const metaKey = `${PREFIX_META}${id}`;
    // Store as JSON for simplicity, or Hash
    // We add 'data' (text) to metadata to match original Upstash contract
    await redis.set(metaKey, JSON.stringify({
        id,
        data: text,
        metadata,
        vector: embedding // Optional: Store vector in Redis too for Drift Checks (Source of Truth)? 
        // Yes, DriftWalker needs it. AND we added 'Fetch' to C# to avoid this duplication.
        // But storing here makes 'fetch' faster? 
        // Let's stick to the plan: C# has the vector. DriftWalker fetches from C#.
        // We WON'T store vector in Redis to save RAM.
    }));
}

/**
 * Query the Hybrid Store
 */
export async function queryMemory(query: string, topK: number = 3): Promise<any[]> {
    // 1. Generate Query Vector
    const queryVector = await generateEmbedding(query);

    // 2. Search FAISS
    const results = await vectorClient.search(queryVector, topK);

    // 3. Hydrate Results (Resolve UUIDs + Metadata)
    const hydrated = await Promise.all(results.map(async (res) => {
        // Resolve Long -> UUID
        const uuid = await redis.hget(MAP_LONG_TO_UUID, String(res.id));
        if (!uuid) return null;

        // Fetch Metadata
        const metaStr = await redis.get(`${PREFIX_META}${uuid}`);
        if (!metaStr) return null;

        const record = JSON.parse(metaStr);

        return {
            id: uuid,
            score: res.distance, // Note: FAISS returns distance, we might want similarity. 
            // L2 Distance: Lower is better. 0 = exact match.
            // Upstash usually returns wrapper with score 0..1? 
            // For now return raw distance.
            data: record.data,
            metadata: record.metadata
        };
    }));

    return hydrated.filter(r => r !== null);
}

// Export a "index" object that mimics the Upstash Interface for DriftWalker
// DriftWalker calls: index.fetch([id], { includeVectors: true, includeMetadata: true })
export const vectorIndex = {
    async fetch(ids: string[], options?: any): Promise<any[]> {
        return await Promise.all(ids.map(async (id) => {
            // 1. Get Metadata
            const metaStr = await redis.get(`${PREFIX_META}${id}`);
            if (!metaStr) return null; // or empty object

            const record = JSON.parse(metaStr);
            let result: any = {
                id: id,
                metadata: record.metadata,
                data: record.data
            };

            // 2. Get Vector (if requested)
            if (options?.includeVectors) {
                const longIdStr = await redis.hget(MAP_UUID_TO_LONG, id);
                if (longIdStr) {
                    const longId = Number(longIdStr);
                    // Call C# Fetch Endpoint
                    // We need to expose raw fetch on VectorClient
                    try {
                        const rawVec = await vectorClient.fetch(longId);
                        result.vector = rawVec;
                    } catch (e) {
                        console.warn(`Failed to fetch vector for ${id}`, e);
                    }
                }
            }

            return result;
        }));
    },

    // Support delete
    async delete(id: string) {
        // We can't easily delete from FAISS without rebuilding or using specific ID selectors 
        // (IDMap supports remove_ids, but need logic).
        // For MVP: Just remove metadata from Redis. Search will return ID but we'll fail to look up UUID/Metadata and filter it out.
        // "Soft Delete"
        await redis.del(`${PREFIX_META}${id}`);
        // Optional: Remove from maps to be cleaner
        const longIdStr = await redis.hget(MAP_UUID_TO_LONG, id);
        if (longIdStr) {
            await redis.hdel(MAP_UUID_TO_LONG, id);
            await redis.hdel(MAP_LONG_TO_UUID, longIdStr);
        }
    }
};
