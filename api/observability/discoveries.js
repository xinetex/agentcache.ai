
export const config = { runtime: 'nodejs' };
import fetch from 'node-fetch';

export default async function handler(req) {
    try {
        // Fetch latest "AI" or "LLM" stories from Hacker News
        const query = 'AI OR LLM OR GPT OR Claude OR Llama';
        const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=10`;

        const res = await fetch(url);
        const data = await res.json();

        // Map HN stories to our "Discovery" format
        const discoveries = data.hits.map(hit => ({
            id: hit.objectID,
            type: getCategory(hit.title),
            label: hit.title,
            value: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            agent: hit.author, // The "Agent" finding it is the HN user
            timestamp: hit.created_at,
            isExternal: true
        }));

        return new Response(JSON.stringify(discoveries), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=30'
            }
        });

    } catch (err) {
        console.error("Discovery API Error:", err);
        // Fallback static data if HN is down
        return new Response(JSON.stringify([
            { id: 'err', type: 'network', label: 'Scanner Offline', value: 'Reconnecting to grid...', agent: 'System', timestamp: new Date().toISOString() }
        ]), { status: 200 });
    }
}

function getCategory(title) {
    const t = title.toLowerCase();
    if (t.includes('release') || t.includes('launch') || t.includes('v1') || t.includes('v2')) return 'tool';
    if (t.includes('research') || t.includes('paper') || t.includes('study')) return 'domain';
    if (t.includes('model') || t.includes('gpt') || t.includes('llama')) return 'pattern';
    return 'network'; // default
}
