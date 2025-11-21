import { appendToSession, getSessionHistory } from '../lib/redis.js';
import { upsertMemory, queryMemory } from '../lib/vector.js';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
    role: string;
    content: string;
    timestamp?: number;
}

export interface ContextResponse {
    messages: Message[];
    source: 'L1' | 'L2' | 'L3' | 'HYBRID';
}

export class ContextManager {
    /**
     * Retrieve the best context for a given query and session.
     * This implements the "Tiered Memory" logic.
     */
    async getContext(sessionId: string, query: string): Promise<ContextResponse> {
        // 1. Fetch L2 (Warm) Context - Recent History
        const recentHistory = await getSessionHistory(sessionId);

        // 2. Fetch L3 (Cold) Context - Vector Search
        // We only query L3 if we have a query string
        let longTermMemories: Message[] = [];
        if (query) {
            const results = await queryMemory(query, 3);
            longTermMemories = results.map(r => ({
                role: 'system', // Inject as system context
                content: `[Memory]: ${r.data}`,
                timestamp: r.metadata?.timestamp as number
            }));
        }

        // 3. Merge Contexts (Orchestration)
        // Strategy: System Prompt + L3 Memories + L2 Recent History
        const messages = [
            ...longTermMemories,
            ...recentHistory
        ];

        return {
            messages,
            source: longTermMemories.length > 0 ? 'HYBRID' : 'L2'
        };
    }

    /**
     * Save a new interaction.
     * Writes to L2 (Redis) immediately.
     * Async process could move to L3 (Vector) later (Eviction).
     */
    async saveInteraction(sessionId: string, userMessage: string, assistantMessage: string) {
        const timestamp = Date.now();

        const userMsg: Message = { role: 'user', content: userMessage, timestamp };
        const assistantMsg: Message = { role: 'assistant', content: assistantMessage, timestamp };

        // Write to L2 (Warm Tier)
        await appendToSession(sessionId, userMsg);
        await appendToSession(sessionId, assistantMsg);

        // Write to L3 (Cold Tier) - "Write-Through" Strategy for now
        // In a real HPC system, this would be an async "Eviction" process
        const memoryId = uuidv4();
        await upsertMemory(memoryId, `User: ${userMessage}\nAssistant: ${assistantMessage}`, {
            sessionId,
            timestamp
        });
    }
}
