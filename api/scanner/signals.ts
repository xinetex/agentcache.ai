
import { ScannerService } from '../../src/services/ScannerService.js';

export const config = {
    runtime: 'nodejs', // DB requires Node.js
};

export default async function handler(req) {
    if (req.method === 'GET') {
        const data = await ScannerService.getHeatmapData();
        return new Response(JSON.stringify({ signals: data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (req.method === 'POST') {
        const body = await req.json();
        const { agentId, signal } = body;

        if (!agentId || !signal) {
            return new Response(JSON.stringify({ error: 'Missing Data' }), { status: 400 });
        }

        await ScannerService.reportSignal(agentId, signal);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
}
