/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { db } from '../db/client.js';
import { jobTranscripts } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { redis } from '../lib/redis.js';

export interface LogEvent {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata?: any;
}

/**
 * PipelineService: Monitors data flow through sector processors and agent reasoning.
 */
export class PipelineService {

    /**
     * Start a new job transcript.
     */
    async startJob(jobId: string, lane: string, agent: string): Promise<string> {
        const [row] = await db.insert(jobTranscripts).values({
            jobId,
            lane,
            agent,
            logs: [],
            status: 'running',
            startTime: new Date()
        }).returning();
        
        await redis.set(`pipeline:job:${jobId}:status`, 'running');
        return row.id;
    }

    /**
     * Log an event to a specific transcript.
     */
    async log(jobId: string, event: LogEvent): Promise<void> {
        const rows = await db.select().from(jobTranscripts).where(eq(jobTranscripts.jobId, jobId)).limit(1);
        if (rows.length === 0) return;

        const transcript = rows[0];
        const updatedLogs = [...(transcript.logs as any[]), event];

        await db.update(jobTranscripts)
            .set({ logs: updatedLogs, updatedAt: new Date() } as any)
            .where(eq(jobTranscripts.id, transcript.id));
        
        // Also push to a volatile Redis stream for real-time dashboard tailing
        await redis.xadd(`pipeline:job:${jobId}:stream`, '*', 'event', JSON.stringify(event));
    }

    /**
     * Mark job as finished.
     */
    async finishJob(jobId: string, status: 'completed' | 'failed' = 'completed'): Promise<void> {
        await db.update(jobTranscripts)
            .set({ 
                status, 
                endTime: new Date() 
            })
            .where(eq(jobTranscripts.jobId, jobId));
        
        await redis.set(`pipeline:job:${jobId}:status`, status);
    }

    /**
     * Get recent jobs for the dashboard.
     */
    async getRecentJobs(limit: number = 10): Promise<any[]> {
        return db.select()
            .from(jobTranscripts)
            .orderBy(desc(jobTranscripts.startTime))
            .limit(limit);
    }
}

export const pipelineService = new PipelineService();
