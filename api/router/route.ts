import { router } from '../../src/lib/llm/router';

export const config = {
    runtime: 'edge',
};

interface RouteRequest {
    prompt: string;
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    try {
        const { prompt } = await req.json() as RouteRequest;

        if (!prompt) return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400 });

        const result = router.route(prompt);

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600' // Route decisions are highly cacheable!
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
