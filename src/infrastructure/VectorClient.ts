export class VectorClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:5000/Vectors') {
        this.baseUrl = baseUrl;
    }

    async addVectors(ids: number[], vectors: number[]): Promise<void> {
        // Flatten vectors if they are array of arrays, but C# expects flat array
        // Here we assume input is already flat or we handle it. 
        // Our C# API expects a flat float array.

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
            // Fail open or throw depending on strategy. For now log only.
        }
    }

    async search(vector: number[], k: number = 5): Promise<{ id: number, distance: number }[]> {
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
            return [];
        }
    }

    async fetch(id: number): Promise<number[]> {
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
