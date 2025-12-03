import { blobStore } from '../../src/lib/blob-store';
import { Readable } from 'stream';

export const config = {
    api: {
        bodyParser: false, // Disable default body parser to handle streams manually
    },
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Blob-Key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const key = req.query.key || req.headers['x-blob-key'];

    if (!key) {
        return res.status(400).json({ error: 'Missing key (query param or X-Blob-Key header)' });
    }

    try {
        if (req.method === 'POST') {
            // Stream request body directly to blob store
            await blobStore.put(key as string, req);
            return res.status(200).json({ success: true, key });
        }

        if (req.method === 'GET') {
            const exists = await blobStore.exists(key as string);
            if (!exists) {
                return res.status(404).json({ error: 'Blob not found' });
            }

            const stream = await blobStore.get(key as string);
            if (!stream) {
                return res.status(404).json({ error: 'Blob not found' });
            }

            res.setHeader('Content-Type', 'application/octet-stream');
            stream.pipe(res);
            return;
        }

        if (req.method === 'DELETE') {
            await blobStore.delete(key as string);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('HPC Blob API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
