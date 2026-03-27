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
 * Whisper Transcription Client
 * 
 * Interfaces with the insanely-fast-whisper worker API.
 * Supports:
 * - Local/URL audio file transcription
 * - Flash Attention 2 optimizations
 * - Word-level timestamps
 */

export interface WhisperTranscript {
    text: string;
    chunks: {
        text: string;
        timestamp: [number, number | null];
    }[];
}

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8000/transcribe';

export class WhisperClient {
    private apiToken: string;

    constructor(apiToken?: string) {
        this.apiToken = apiToken || process.env.WHISPER_API_TOKEN || '';
    }

    /**
     * Transcribe an audio file from a URL or local path
     */
    async transcribe(fileUrl: string, options?: {
        model?: string;
        language?: string;
        flash?: boolean;
    }): Promise<WhisperTranscript> {
        try {
            const response = await fetch(WHISPER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    file_url: fileUrl,
                    model: options?.model || 'openai/whisper-large-v3',
                    language: options?.language,
                    flash: options?.flash ?? true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Whisper API Error (${response.status}): ${errorText}`);
            }

            return await response.json() as WhisperTranscript;
        } catch (error) {
            console.error('Transcription failed:', error);
            throw error;
        }
    }
}
