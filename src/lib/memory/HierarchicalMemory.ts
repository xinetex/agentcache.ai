
import { upsertMemory, queryMemory } from '../vector.js';
import { redis } from '../redis.js';

/**
 * Hierarchical Working Memory
 * 
 * Implements the "Persistent Note-taking" system from Confucius Agent.
 * 
 * Levels:
 * 1. Working Memory (RAM): Immediate context, small, ephemeral.
 * 2. Episodic Memory (Redis/Vector): Structured "Notes" from previous sessions.
 * 3. Semantic Memory (Vector): Raw knowledge base.
 */

export interface MemoryNote {
    id: string;
    sessionId: string;
    content: string;
    tags: string[];
    timestamp: number;
    importance: number; // 0.0 - 1.0 (Meta-Cognitive Assessment)
}

export class HierarchicalMemory {
    private sessionId: string;
    private workingMemory: string[] = []; // Simple log of recent thoughts
    private readonly MAX_WORKING_MEMORY = 10;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    /**
     * Add a thought to Working Memory.
     * Triggers "Consolidation" if memory is full.
     */
    public async addThought(thought: string, importance: number = 0.5) {
        this.workingMemory.push(thought);

        // If high importance, persist immediately as a Note
        if (importance > 0.8) {
            await this.createPersistentNote(thought, ['important']);
        }

        // FIFO Eviction
        if (this.workingMemory.length > this.MAX_WORKING_MEMORY) {
            this.workingMemory.shift();
        }
    }

    /**
     * Consolidate Working Memory into Episodic Memory (Note).
     * This corresponds to the Confucius "Note-Taking" action.
     */
    public async consolidate(summary: string) {
        await this.createPersistentNote(summary, ['consolidation', `session:${this.sessionId}`]);
        this.workingMemory = []; // Clear working memory
    }

    /**
     * Create a structured Note in the Persistent Store
     */
    private async createPersistentNote(content: string, tags: string[]) {
        const id = crypto.randomUUID();
        const note: MemoryNote = {
            id,
            sessionId: this.sessionId,
            content,
            tags,
            timestamp: Date.now(),
            importance: 1.0
        };

        // 1. Store Metadata in Redis (Structured retrieval)
        const key = `memory:note:${id}`;
        await redis.set(key, JSON.stringify(note));
        await redis.expire(key, 60 * 60 * 24 * 30); // 30 Day Retention for Notes

        // 2. Index in Vector Store (Semantic retrieval)
        await upsertMemory(id, content, { type: 'note', tags, sessionId: this.sessionId });

        console.log(`[HierarchicalMemory] Created Note: ${id}`);
    }

    /**
     * Retrieve relevant notes using Semantic Search (Vector)
     */
    public async recall(query: string): Promise<MemoryNote[]> {
        // 1. Semantic Search
        const results = await queryMemory(query, 5); // Top 5

        // 2. Hydrate Notes
        const notes: MemoryNote[] = [];
        for (const res of results) {
            if (res.metadata?.type === 'note') {
                const noteStr = await redis.get(`memory:note:${res.id}`);
                if (noteStr) {
                    notes.push(JSON.parse(noteStr));
                }
            }
        }

        return notes;
    }

    /**
     * Get recent context (Working Memory + Recent Notes)
     */
    public async getContext(): Promise<string> {
        return `
[Working Memory]
${this.workingMemory.join('\n')}

[Recent Notes]
(Use 'recall' tool to fetch more)
        `.trim();
    }
}
