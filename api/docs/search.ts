import { vectorIndex } from '../../src/lib/vector';

export const config = {
    runtime: 'nodejs',
};

interface SearchRequest {
    query: string;
    limit?: number;
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    try {
        const { query, limit = 3 } = await req.json() as SearchRequest;

        if (!query) return new Response(JSON.stringify({ error: 'Query required' }), { status: 400 });

        if (!vectorIndex) {
            return new Response(JSON.stringify({ error: 'Vector DB not configured' }), { status: 503 });
        }

        const results = await vectorIndex.query({
            data: query,
            topK: limit,
            includeMetadata: true,
            includeData: true,
        });

        // Format for RAG
        const context = results.map(r => ({
            content: r.data,
            url: r.metadata?.url,
            score: r.score
        }));

        return new Response(JSON.stringify({
            results: context
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
