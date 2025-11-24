import { serializer } from '../../src/lib/proto/serializer';

export const config = {
    runtime: 'edge',
};

interface PrewarmRequest {
    scenarios: string[];
    priority: 'high' | 'low';
    ttl?: number;
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // Support both JSON and Binary input
        const contentType = req.headers.get('content-type') || '';
        let body: PrewarmRequest;

        if (contentType.includes('application/octet-stream')) {
            const buffer = await req.arrayBuffer();
            const envelope = serializer.deserialize(new Uint8Array(buffer));
            body = envelope.payload;
        } else {
            body = await req.json();
        }

        const { scenarios, priority } = body;

        if (!scenarios || !Array.isArray(scenarios)) {
            return new Response(JSON.stringify({ error: 'Invalid scenarios' }), { status: 400 });
        }

        const start = Date.now();
        const jobId = `prewarm:${Date.now()}:${Math.random().toString(36).substr(2, 5)}`;

        // In a real HFT system, this would push to a high-priority queue (e.g., Kafka/Redis Stream)
        // For this demo, we'll simulate the "Fire and Forget" dispatch to the Swarm Grid

        // Simulate dispatch latency
        const dispatchTime = Date.now() - start;

        const response = {
            jobId,
            status: 'dispatched',
            count: scenarios.length,
            estimated_completion: `${scenarios.length * 50}ms`, // Fast pre-calc
            dispatch_latency: `${dispatchTime}ms`
        };

        // Return Binary if requested, else JSON
        if (req.headers.get('accept') === 'application/octet-stream') {
            const serialized = serializer.serialize({
                id: jobId,
                type: 'signal',
                timestamp: Date.now(),
                payload: response
            });
            return new Response(serialized.buffer.buffer as ArrayBuffer, {
                headers: { 'Content-Type': 'application/octet-stream' }
            });
        }

        return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
