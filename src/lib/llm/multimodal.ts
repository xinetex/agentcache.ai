import { generateEmbedding } from './embeddings.js';

export class MultiModalEncoder {

    /**
     * Embeds a multi-modal input into a shared vector space.
     * Supports:
     * - Text (String) -> Uses LLM Embedding
     * - Sensor Data (Object/Buffer) -> Uses Simulated Visual Encoder
     */
    async embed(input: string | Buffer | any): Promise<number[]> {
        if (typeof input === 'string') {
            return this.embedText(input);
        } else {
            return this.embedVisual(input);
        }
    }

    /**
     * Compute Cosine Similarity between two vectors
     */
    cosineSimilarity(a: number[], b: number[]): number {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private async embedText(text: string): Promise<number[]> {
        // Use real embeddings from the centralized LLM service
        try {
            return await generateEmbedding(text);
        } catch (e) {
            console.error('Embedding Generation Failed:', e);
            // Fallback to zero vector only in catastrophic failure, but log error
            return new Array(1536).fill(0);
        }
    }

    /**
     * VISUAL Encoder (Semantic Bridge)
     * Maps "Visual Features" to vector space by converting to text description.
     * This acts as a semantic bridge (Concept -> Text -> Vector).
     */
    private async embedVisual(input: any): Promise<number[]> {
        let content = '';

        if (Buffer.isBuffer(input)) {
            // In a full production system, this would call CLIP/ResNet.
            // For now, we assume the buffer contains a decodable text signal or metadata.
            content = input.toString('utf-8');
        } else if (typeof input === 'object') {
            // Semantic Serialization: Convert object properties to conceptual text
            // e.g. { label: 'chair', color: 'red' } -> "A red chair"
            const parts = [];
            if (input.color) parts.push(input.color);
            if (input.label) parts.push(input.label);
            if (parts.length > 0) {
                content = `A ${parts.join(' ')}`;
            } else {
                content = JSON.stringify(input);
            }
        } else {
            content = String(input);
        }

        // Bridge to Text Embedding
        return this.embedText(content);
    }
}

