import { contentService } from '../src/services/ContentService.js';

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        // GET /api/content
        if (req.method === 'GET') {
            const data = await contentService.getContent();
            return json(data);
        }

        // POST /api/content/card (Create/Update)
        if (req.method === 'POST') {
            // Extract ID from URL if provided (though usually in body for POST)
            // req.url might be /api/content/card
            // logic mostly relies on body
            const body = await req.json();
            const result = await contentService.upsertCard(body);
            return json(result);
        }

        // DELETE /api/content/card/:id
        if (req.method === 'DELETE') {
            // Need to extract ID from URL
            // req.url is full URL e.g. http://host/api/content/card/123
            const url = new URL(req.url);
            const pathParts = url.pathname.split('/');
            const id = pathParts[pathParts.length - 1]; // naive extraction

            if (!id) return json({ error: 'Missing ID' }, 400);

            const result = await contentService.deleteCard(id);
            return json(result);
        }

        return json({ error: 'Method not allowed' }, 405);

    } catch (error) {
        console.error('[AdminContent] Error:', error);
        return json({ error: error.message }, 500);
    }
}
