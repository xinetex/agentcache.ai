import { appendToSession, getSessionHistory } from '../lib/redis.js';
import { upsertMemory, queryMemory, vectorIndex } from '../lib/vector.js';
import { v4 as uuidv4 } from 'uuid';
import { CognitiveEngine } from './CognitiveEngine.js';

export interface Message {
    role: string;
    content: string;
    timestamp?: number;
    id?: string;
}

export interface ContextResponse {
    messages: Message[];
    source: 'L1' | 'L2' | 'L3' | 'HYBRID';
}

export interface ChatOptions {
    freshness?: 'default' | 'absolute'; // 'absolute' ignores L2/L3
}

export class ContextManager {
    private cognitiveEngine: CognitiveEngine;

    constructor() {
        this.cognitiveEngine = new CognitiveEngine();
    }

    /**
     * Retrieve the best context for a given query and session.
     * Implements "Tiered Memory", "Episodic Decay", and "Cognitive Conflict Resolution".
     */
    async getContext(sessionId: string, query: string, options: ChatOptions = {}): Promise<ContextResponse> {
        // Anti-Cache: Freshness Injection
        if (options.freshness === 'absolute') {
            return {
                messages: [],
                source: 'L1'
            };
        }

        // 1. Fetch L2 (Warm) Context - Recent History
        const recentHistory = await getSessionHistory(sessionId);

        // 2. Fetch L3 (Cold) Context - Vector Search with Episodic Decay
        let longTermMemories: Message[] = [];
        if (query) {
            // Fetch more candidates than we need (Top 10) so we can re-rank them
            const results = await queryMemory(query, 10);

            const now = Date.now();
            const DECAY_RATE = 1000 * 60 * 60 * 24 * 7; // 7 Days half-life (configurable)

            const scoredMemories = results.map(r => {
                const timestamp = r.metadata?.timestamp as number || now;
                const age = now - timestamp;

                // Algorithm: Episodic Decay
                // Combine Vector Similarity (Relevance) with Time Decay (Recency)
                // Score = Similarity * (1 / (1 + Age/HalfLife))
                const timeFactor = 1 / (1 + (age / DECAY_RATE));
                const finalScore = r.score * timeFactor;

                return { ...r, finalScore };
            });

            // Re-rank and take Top 5 (increased for conflict resolution)
            scoredMemories.sort((a, b) => b.finalScore - a.finalScore);
            const topMemories = scoredMemories.slice(0, 5);

            const rawMemories = topMemories.map(r => ({
                role: 'system',
                content: `[Memory]: ${r.data}`,
                timestamp: r.metadata?.timestamp as number,
                id: String(r.id)
            }));

            // Cognitive Layer: Conflict Resolution
            longTermMemories = await this.cognitiveEngine.resolveConflicts(rawMemories);

            // Limit to Top 3 after resolution
            longTermMemories = longTermMemories.slice(0, 3);
        }

        // 3. Merge Contexts
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
     * Implements "Cognitive Validation" (Hallucination Prevention).
     */
    async saveInteraction(sessionId: string, userMessage: string, assistantMessage: string) {
        const timestamp = Date.now();

        const userMsg: Message = { role: 'user', content: userMessage, timestamp };
        const assistantMsg: Message = { role: 'assistant', content: assistantMessage, timestamp };

        // Write to L2 (Warm Tier) - Always save to recent history
        await appendToSession(sessionId, userMsg);
        await appendToSession(sessionId, assistantMsg);

        // Cognitive Layer: Validation
        // Only save to L3 (Long Term) if it passes validation
        const validation = await this.cognitiveEngine.validateMemory(assistantMessage);

        if (validation.valid) {
            // Write to L3 (Cold Tier)
            const memoryId = uuidv4();
            await upsertMemory(memoryId, `User: ${userMessage}\nAssistant: ${assistantMessage}`, {
                sessionId,
                timestamp,
                validationScore: validation.score // Store the score for future weighting
            });
        } else {
            console.warn(`[CognitiveEngine] Memory rejected (Score: ${validation.score}): ${validation.reason}`);
        }
    }

    /**
     * Anti-Cache: Pruning (Flash Neuralyzer)
     * Delete a specific memory from L3.
     */
    async deleteMemory(memoryId: string) {
        if (vectorIndex) {
            await vectorIndex.delete(memoryId);
        }
    }
}
