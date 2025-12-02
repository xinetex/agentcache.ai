
export async function generateEmbedding(text: string): Promise<number[]> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        throw new Error('OpenAI API key not configured');
    }

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
        const error = await response.text();
        throw new Error(`OpenAI embeddings failed: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}
