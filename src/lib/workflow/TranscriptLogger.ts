
import { db } from '../../db/client.js';
import { jobTranscripts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

interface LogEvent {
    ts: number;
    level: 'info' | 'warn' | 'error';
    event: string;
    data?: any;
}

export class TranscriptLogger {
    private jobId: string;
    private lane: string;
    private agent: string;
    private buffer: LogEvent[] = [];

    constructor(jobId: string, lane: string, agent: string) {
        this.jobId = jobId;
        this.lane = lane;
        this.agent = agent;
    }

    async init() {
        await db.insert(jobTranscripts).values({
            jobId: this.jobId,
            lane: this.lane,
            agent: this.agent,
            logs: [],
            status: 'running'
        });
    }

    info(event: string, data?: any) {
        this.buffer.push({ ts: Date.now(), level: 'info', event, data });
    }

    warn(event: string, data?: any) {
        this.buffer.push({ ts: Date.now(), level: 'warn', event, data });
    }

    error(event: string, data?: any) {
        this.buffer.push({ ts: Date.now(), level: 'error', event, data });
    }

    /**
     * Flush logs to DB and mark status
     */
    async flush(status: 'completed' | 'failed' = 'completed') {
        // In highly active logs, we might append. Here we just update the blob.
        // Note: Race conditions possible if parallel writes, but single runner is safe.
        await db.update(jobTranscripts)
            .set({
                logs: this.buffer,
                endTime: new Date(),
                status
            })
            .where(eq(jobTranscripts.jobId, this.jobId));
    }
}
