/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * WisdomService: Condenses raw agent history into "Wisdom Packets".
 * Mitigates Latent Weight Trauma by removing semantic noise.
 */

import { MoonshotClient } from '../lib/moonshot.js';
import { redis } from '../lib/redis.js';

const moonshot = new MoonshotClient();

export interface WisdomPacket {
    agentId: string;
    taskKey: string;
    nuggets: string[];
    timestamp: string;
    compressionRatio: number;
}

export class WisdomService {
    /**
     * Collapse a dense history of thoughts into a lightweight wisdom packet.
     */
    async collapseContext(agentId: string, taskKey: string, history: string[]): Promise<WisdomPacket> {
        console.log(`[WisdomService] 🧘 Relaxing context for agent ${agentId} (${history.length} events)...`);
        
        const rawText = history.join('\n');
        
        try {
            const llmResponse = await moonshot.chat([
                { 
                    role: 'system', 
                    content: 'You are a Cognitive Decompressor. Extract the ESSENTIAL lessons from this agent history. Discard trial-and-error noise. Return a bulleted list of 3 high-level "Wisdom Nuggets".' 
                },
                { 
                    role: 'user', 
                    content: `Agent History for ${taskKey}: \n${rawText}` 
                }
            ]);

            const nuggets = llmResponse.choices[0].message.content
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.replace('-', '').trim());

            const packet: WisdomPacket = {
                agentId,
                taskKey,
                nuggets,
                timestamp: new Date().toISOString(),
                compressionRatio: nuggets.length / history.length
            };

            await redis.set(`agent:wisdom:${agentId}:${taskKey}`, JSON.stringify(packet));
            console.log(`[WisdomService] ✅ Wisdom packet generated. Compression: ${(packet.compressionRatio * 100).toFixed(1)}%`);
            
            return packet;
        } catch (e) {
            console.warn('[WisdomService] ⚠️ LLM Synthesis failed. Falling back to heuristic wisdom.');
            const fallbackPacket: WisdomPacket = {
                agentId,
                taskKey,
                nuggets: ["Prioritize low-latency verification.", "Maintain exponential backoff during rate limits."],
                timestamp: new Date().toISOString(),
                compressionRatio: 0.5
            };
            await redis.set(`agent:wisdom:${agentId}:${taskKey}`, JSON.stringify(fallbackPacket));
            return fallbackPacket;
        }
    }

    async getLatestWisdom(agentId: string, taskKey: string): Promise<WisdomPacket | null> {
        const cached = await redis.get(`agent:wisdom:${agentId}:${taskKey}`);
        return cached ? JSON.parse(cached) : null;
    }
}

export const wisdomService = new WisdomService();
