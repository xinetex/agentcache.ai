import { EmbeddingProvider } from '../lib/llm/types.js';
import { LocalEmbeddingProvider } from '../lib/llm/providers/local-embeddings.js';

export class VectorClient {
    private baseUrl: string;
    private embeddingProvider: EmbeddingProvider;

    private vectors = new Map<number, number[]>(); // Mock storage

    constructor(baseUrl: string = 'http://localhost:5000/Vectors') {
        this.baseUrl = baseUrl;
        // Default to local embeddings for now logic
        this.embeddingProvider = new LocalEmbeddingProvider();

        if (!process.env.VECTOR_SERVICE_URL || process.env.VECTOR_SERVICE_URL === 'mock') {
            console.warn('⚠️ No VECTOR_SERVICE_URL. Using In-Memory Mock Vector Service.');
            this.baseUrl = 'mock';
        }
    }

    /**
     * Generate embedding for text
     */
    async embed(text: string): Promise<number[]> {
        return this.embeddingProvider.embed(text);
    }

    async addVectors(ids: number[], vectors: number[]): Promise<void> {
        if (this.baseUrl === 'mock') {
            // vectors is a flat array, but we need chunks
            // wait, vectors is "number[]" in signature but comment says "flattened".
            // Actually usually addVectors takes separate args or array of arrays. 
            // The signature says `vectors: number[]` (flat) but implementation usually chunks it.
            // Let's assume passed vectors matches ids length * dim ?
            // But generateEmbedding returns number[] (one vector).
            // vector.ts calls `addVectors([longId], embedding)`. So mock assumes 1:1.

            // Just store 1:1 for now as that is how it's called
            this.vectors.set(ids[0], vectors);
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, vectors })
            });

            if (!response.ok) {
                throw new Error(`Vector Service Error: ${response.statusText}`);
            }
        } catch (e) {
            console.error('Vector Service Add Failed:', e);
        }
    }

    async search(vector: number[], k: number = 5): Promise<{ id: number, distance: number }[]> {
        if (this.baseUrl === 'mock') {
            // Brute force cosine similarity for mock
            const results = [];
            for (const [id, storedVec] of this.vectors.entries()) {
                // Cosine sim
                let dot = 0;
                let magA = 0;
                let magB = 0;
                for (let i = 0; i < vector.length; i++) {
                    dot += vector[i] * (storedVec[i] || 0);
                    magA += vector[i] * vector[i];
                    magB += (storedVec[i] || 0) * (storedVec[i] || 0);
                }
                const score = dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
                results.push({ id, distance: 1 - score }); // distance = 1 - sim
            }
            return results.sort((a, b) => a.distance - b.distance).slice(0, k);
        }

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vector, k })
            });

            if (!response.ok) {
                return []; // Fail safe
            }

            return await response.json();
        } catch (e) {
            console.error('Vector Service Search Failed:', e);
            return [];
        }
    }

    async fetch(id: number): Promise<number[]> {
        if (this.baseUrl === 'mock') {
            return this.vectors.get(id) || [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/${id}`);
            if (!response.ok) throw new Error('Not found');

            const data = await response.json();
            return data.vector; // Assumes { id: ..., vector: [...] }
        } catch (e) {
            console.error(`Vector Service Fetch Failed for ${id}:`, e);
            throw e;
        }
    }
}
