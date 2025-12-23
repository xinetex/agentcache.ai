
export async function generateEmbedding(text: string): Promise<number[]> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        console.warn('⚠️ No OPENAI_API_KEY. Using deterministic mock embedding.');
        // Generate a pseudo-random deterministic vector based on text length/content
        // This ensures the same text gets the same vector for testing
        const dim = 1536;
        const seed = text.length;
        return Array.from({ length: dim }, (_, i) => Math.sin(seed * i));
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
        const seed = text.length; // Simple deterministic seed
        return Array.from({ length: dim }, (_, i) => Math.sin(seed * i));
    }
}
