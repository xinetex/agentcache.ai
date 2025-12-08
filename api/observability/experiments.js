
export const config = { runtime: 'nodejs' };

export default async function handler(req) {
    // "Active Experiments" showing A/B test results on the pipeline

    const experiments = [
        {
            id: 'exp_001',
            name: 'Global Latency Optimization',
            status: 'running',
            treatment: { name: 'Smart Routing V2', score: 98.2, latency: 145 },
            control: { name: 'Baseline', score: 94.5, latency: 210 },
            delta: '+3.7%',
            confidence: 'High'
        },
        {
            id: 'exp_002',
            name: 'Generic Prompt Compression',
            status: 'collecting',
            treatment: { name: 'Brotli-LLM', score: 88.0, latency: 300 },
            control: { name: 'Raw Text', score: 88.1, latency: 450 },
            delta: '-0.1%',
            confidence: 'Low'
        }
    ];

    return new Response(JSON.stringify(experiments), {
        headers: { 'Content-Type': 'application/json' }
    });
}
