import { EmbeddingProvider } from '../types.js';

export class LocalEmbeddingProvider implements EmbeddingProvider {
    private dimensions: number;

    constructor(dimensions: number = 1536) { // Default to OpenAI text-embedding-ada-002 size
        this.dimensions = dimensions;
    }

    /**
     * Generates a deterministic "mock" embedding for text.
     * Same text = Same vector.
     * Similar text != Similar vector (Limitations of hashing),
     * but helpful for "Exact Semantic Match" testing.
     */
    async embed(text: string): Promise<number[]> {
        const vector = new Array(this.dimensions).fill(0);

        // Simple hashing to seed the vector
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }

        // Fill vector based on hash seed to ensure determinism
        for (let i = 0; i < this.dimensions; i++) {
            // Pseudo-random-ish generator linear congruential
            hash = (hash * 1664525 + 1013904223) % 4294967296;
            // Normalize roughly between -1 and 1
            vector[i] = (hash / 4294967296) * 2 - 1;
        }

        // Normalize vector to unit length (Cosine Similarity requires this for dot product optimization)
        let magnitude = 0;
        for (let i = 0; i < this.dimensions; i++) magnitude += vector[i] * vector[i];
        magnitude = Math.sqrt(magnitude);

        return vector.map(v => v / magnitude);
    }
}
