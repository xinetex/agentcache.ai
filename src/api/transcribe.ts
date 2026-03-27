/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Hono } from 'hono';
import { transcriptionService } from '../services/TranscriptionService.js';

const transcribe = new Hono();

/**
 * POST /api/transcribe/submit
 * Submit an audio/video file for transcription
 */
transcribe.post('/submit', async (c) => {
    try {
        const body = await c.req.json();
        const { fileUrl, metadata } = body;

        if (!fileUrl) {
            return c.json({ error: 'fileUrl is required' }, 400);
        }

        const transcript = await transcriptionService.transcribeAndIndex(fileUrl, metadata);

        return c.json({
            success: true,
            transcript: transcript.text,
            chunks: transcript.chunks,
            message: 'Transcription completed and indexed successfully.'
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /api/transcribe/status/:id
 * Get transcription result by ID (optional, using Redis directly usually)
 */
transcribe.get('/status/:id', async (c) => {
    return c.json({ error: 'Direct status lookup via API not yet implemented' }, 501);
});

export default transcribe;
