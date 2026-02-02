
import { create, use, Memvid } from '@memvid/sdk';
import path from 'path';
import fs from 'fs';

/**
 * Memvid Service
 * "Portable Knowledge Engine"
 * 
 * Allows agents to create, seal, and trade .mv2 memory files.
 */
export class MemvidService {

    /**
     * Create a Knowledge Pack (.mv2 file)
     * @param name Name of the pack (e.g. "lithium-ion-report")
     * @param documents Array of { title, text, tags }
     * @returns Absolute path to the created file
     */
    async createKnowledgePack(name: string, documents: Array<{ title: string, text: string, tags?: string[] }>): Promise<string> {
        const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mv2`;
        // Store in a dedicated directory
        const storageDir = path.resolve('storage_blobs');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

        const filePath = path.join(storageDir, fileName);

        console.log(`[Memvid] Creating Knowledge Pack: ${filePath} (${documents.length} docs)...`);

        // Create new memory file
        const mv = await create(filePath);

        try {
            // Batch ingest
            // SDK v2 uses putMany for efficiency
            const docsToPut = documents.map(d => ({
                title: d.title,
                text: d.text,
                tags: d.tags || [],
                label: 'knowledge',
                metadata: { created_by: 'AgentCache System' }
            }));

            await mv.putMany(docsToPut);

            // Seal to optimize indices
            await mv.seal();

            console.log(`[Memvid] Pack Sealed. Size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB.`);
            return filePath;
        } catch (err) {
            console.error(`[Memvid] Creation Failed:`, err);
            throw err;
        }
    }

    /**
     * Query a Knowledge Pack
     * @param filePath Path to .mv2 file
     * @param query Natural language question
     */
    async queryKnowledgePack(filePath: string, query: string): Promise<string> {
        if (!fs.existsSync(filePath)) throw new Error(`Knowledge Pack not found: ${filePath}`);

        console.log(`[Memvid] Querying Pack: ${path.basename(filePath)} -> "${query}"`);

        // Open in Read-Only mode for speed
        // "basic" adapter provides standard find/ask
        const mv = await use("basic", filePath, { readOnly: true });

        // Ask using default model (or configured)
        // If Env has OPENAI_API_KEY, it uses it. Otherwise might fail if local model missing.
        // Assuming we want RAG answer
        try {
            const answer = await mv.ask(query);
            return answer.text;
        } catch (err) {
            console.warn(`[Memvid] RAG Failed (maybe no LLM configured?), falling back to Search.`);
            console.error(err);

            // Fallback: Just return search hits
            const results = await mv.find(query, { k: 3 });
            return `Key Findings:\n${results.hits.map(h => `- ${h.title}: ${h.snippet}`).join('\n')}`;
        }
    }
}

export const memvidService = new MemvidService();
