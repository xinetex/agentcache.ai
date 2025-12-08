import { CognitiveRouter } from '../../src/infrastructure/CognitiveRouter.js';

const router = new CognitiveRouter();

export const config = {
    runtime: 'nodejs',
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

        const route = await router.route(prompt);
        // Cast to any to access internal analysis method until we fix TS types properly
        const signals = (router as any).analyzeSignals(prompt);

        return new Response(JSON.stringify({
            route,
            signals,
            timestamp: Date.now()
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store' // Real-time analysis should not be cached
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
