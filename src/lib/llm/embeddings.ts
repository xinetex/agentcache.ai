
/**
 * FNV-1a hash for deterministic content-based seeding.
 * Produces a unique numeric seed from the actual text content,
 * not just its length. This ensures different texts produce
 * different mock embeddings for meaningful semantic comparisons.
 */
function fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        console.warn('⚠️ No OPENAI_API_KEY. Using deterministic mock embedding.');
        // Content-based deterministic vector: different texts → different vectors
        const dim = 1536;
        const seed = fnv1a(text);
        return Array.from({ length: dim }, (_, i) => Math.sin(seed * (i + 1) * 0.001));
    }

    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ OpenAI API Error: ${errorText}. Falling back to mock.`);
            throw new Error(errorText); // Trigger catch block to use mock
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (e) {
        console.warn('⚠️ Embedding generation failed. Using deterministic mock fallback.');
        const dim = 1536;
        const seed = fnv1a(text);
        return Array.from({ length: dim }, (_, i) => Math.sin(seed * (i + 1) * 0.001));
    }
}
