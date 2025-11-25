import { uploadToIPFS, getGatewayUrl } from '../../src/lib/ipfs';

export const config = {
    runtime: 'nodejs',
    regions: ['iad1'], // Optional: Configure regions
};

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // Authenticate (Simple API Key check for now, mirroring cache.js)
        const apiKey = req.headers.get('x-api-key');
        if (!apiKey || !apiKey.startsWith('ac_')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Upload to IPFS (Pass File object directly)
        const cid = await uploadToIPFS(file);
        const gatewayUrl = getGatewayUrl(cid);

        return new Response(JSON.stringify({
            success: true,
            cid,
            url: gatewayUrl,
            name: file.name,
            size: file.size,
            timestamp: Date.now()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({
            error: 'Upload failed',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
