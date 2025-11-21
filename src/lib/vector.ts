import { Index } from "@upstash/vector";

const VECTOR_URL = process.env.UPSTASH_VECTOR_REST_URL;
const VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

let index: Index | null = null;

if (VECTOR_URL && VECTOR_TOKEN) {
    index = new Index({
        url: VECTOR_URL,
        token: VECTOR_TOKEN,
    });
} else {
    console.warn("⚠️ UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN not set. L3 Cache disabled.");
}

export const vectorIndex = index;

/**
 * Store a memory chunk in the L3 Cold Tier
 */
export async function upsertMemory(id: string, text: string, metadata: Record<string, any>) {
    if (!vectorIndex) return;

    await vectorIndex.upsert({
        id,
        data: text,
        metadata,
    });
}

/**
 * Query the L3 Cold Tier for relevant memories
 */
export async function queryMemory(query: string, topK: number = 3) {
    if (!vectorIndex) return [];

    const results = await vectorIndex.query({
        data: query,
        topK,
        includeMetadata: true,
        includeData: true,
    });

    return results;
}
