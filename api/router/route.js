
import { CognitiveRouter } from '../../src/infrastructure/CognitiveRouter.js';

const router = new CognitiveRouter();

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
        }

        const route = await router.route(prompt);
        const signals = router.analyzeSignals(prompt); // Expose internals for visualization

        return new Response(JSON.stringify({
            route,
            signals,
            timestamp: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error("Router Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
