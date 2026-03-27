/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { WhisperClient, WhisperTranscript } from '../lib/whisper.js';
import { redis } from '../lib/redis.js';

export class TranscriptionService {
    private whisper: WhisperClient;

    constructor() {
        this.whisper = new WhisperClient();
    }

    /**
     * Submit a file for transcription and store the result in cache/memory
     */
    async transcribeAndIndex(fileUrl: string, metadata: any = {}): Promise<WhisperTranscript> {
        console.log(`[TranscriptionService] Transcribing file: ${fileUrl}`);

        const transcript = await this.whisper.transcribe(fileUrl, {
            flash: true,
            model: 'openai/whisper-large-v3'
        });

        // Store the transcript in Redis for quick retrieval
        const transcriptId = `transcript:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await redis.set(transcriptId, JSON.stringify({
            ...transcript,
            fileUrl,
            metadata,
            created_at: new Date().toISOString()
        }), { ex: 604800 }); // 7 days expiration

        return transcript;
    }

    /**
     * Update Brain analysis with actual transcript text
     */
    async enrichBrainAnalysis(sessionId: string, fileUrl: string) {
        // This could be run as an Inngest background job
        const transcript = await this.transcribeAndIndex(fileUrl);
        // Logical enrichment implementation...
        return transcript;
    }
}

export const transcriptionService = new TranscriptionService();
