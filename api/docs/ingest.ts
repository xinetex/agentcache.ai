import { vectorIndex } from '../../src/lib/vector';

export const config = {
    runtime: 'nodejs',
};

interface IngestRequest {
    url: string;
}

// Simple HTML to Markdown converter for Edge
function htmlToMarkdown(html: string): string {
    let text = html;

    // Remove scripts and styles
    text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

    // Headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gim, "# $1\n");
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gim, "## $1\n");
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gim, "### $1\n");

    // Paragraphs
    text = text.replace(/<p[^>]*>(.*?)<\/p>/gim, "$1\n\n");

    // Links
    text = text.replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gim, "[$2]($1)");

    // Lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gim, "- $1\n");

    // Code blocks
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gim, "```\n$1\n```\n");
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gim, "`$1`");

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode entities (basic)
    text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    // Collapse whitespace
    text = text.replace(/\n\s+\n/g, "\n\n");
    text = text.replace(/\s+/g, " ");

    return text.trim();
}

function chunkText(text: string, maxChunkSize = 1000): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const sentences = text.split(/([.?!]\s+)/);

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    try {
        const { url } = await req.json() as IngestRequest;

        if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400 });

        if (!vectorIndex) {
            return new Response(JSON.stringify({ error: 'Vector DB not configured' }), { status: 503 });
        }

        console.log(`Ingesting ${url}...`);
        const res = await fetch(url);
        const html = await res.text();

        const markdown = htmlToMarkdown(html);
        const chunks = chunkText(markdown);

        console.log(`Generated ${chunks.length} chunks`);

        const vectors = chunks.map((chunk, i) => ({
            id: `doc:${url}:${i}`,
            data: chunk,
            metadata: {
                type: 'doc',
                url,
                chunkIndex: i,
                timestamp: Date.now()
            }
        }));

        // Batch upsert (Upstash limit is usually 1000, we'll assume chunks < 1000)
        await vectorIndex.upsert(vectors);

        return new Response(JSON.stringify({
            success: true,
            url,
            chunks: chunks.length,
            message: 'Documentation ingested successfully'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
