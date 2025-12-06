import { Index } from "@upstash/vector";

export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
        },
    });
}

// Lazy initialization
let index;

function getIndex() {
    if (!index) {
        const url = process.env.UPSTASH_VECTOR_REST_URL;
        consttoken = process.env.UPSTASH_VECTOR_REST_TOKEN;
        if (url && token) {
            index = new Index({ url, token });
        }
    }
    return index;
}

export default async function handler(req) {
    try {
        if (req.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405);
        }

        const { type, vector, action, id } = await req.json();
        const idx = getIndex();

        if (!idx) {
            // Fallback for when vector DB is not configured (e.g. local dev without keys)
            // We simulate a successful but empty result to prevent breaking the frontend/demo.
            console.warn('Hive Vector DB not configured (missing env vars). Returning mock response.');
            if (type === 'query') return json({ matches: [] });
            return json({ success: true, mocked: true });
        }

        if (type === 'query') {
            const results = await idx.query({
                vector,
                topK: 1,
                includeMetadata: true
            });
            return json({ matches: results });
        }

        if (type === 'upload') {
            // Use provided ID or generate random one
            const vectorId = id || `vec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            await idx.upsert([{
                id: vectorId,
                vector,
                metadata: { action }
            }]);
            return json({ success: true, id: vectorId });
        }

        return json({ error: 'Invalid type' }, 400);

    } catch (e) {
        console.error('Hive API Error:', e);
        return json({ error: e.message }, 500);
    }
}
