/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

/**
 * MiniMax AI Client Library
 * 
 * Handles interactions with MiniMax API for:
 * - Chat completions (v2)
 * - M2.7 model support
 * - OpenClaw ecosystem compatibility
 */

export interface MiniMaxMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface MiniMaxResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: MiniMaxMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

const MINIMAX_ENDPOINT = process.env.MINIMAX_ENDPOINT || 'https://api.minimax.io/v1/chat/completions';

export class MiniMaxClient {
    private apiKey: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.MINIMAX_API_KEY || '';

        if (!this.apiKey) {
            console.warn('MiniMaxClient initialized without API key');
        }
    }

    /**
     * Generate a chat completion using MiniMax V2 API
     */
    async chat(
        messages: MiniMaxMessage[],
        model: string = 'MiniMax-M2.7',
        temperature?: number
    ): Promise<MiniMaxResponse> {
        if (!this.apiKey) {
            throw new Error('MiniMax API key is missing');
        }

        try {
            const response = await fetch(MINIMAX_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: temperature ?? 0.7,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`MiniMax API Error (${response.status}): ${errorText}`);
            }

            return await response.json() as MiniMaxResponse;
        } catch (error) {
            console.error('MiniMax chat failed:', error);
            throw error;
        }
    }
}
