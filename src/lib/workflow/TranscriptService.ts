import fs from 'node:fs';
import path from 'node:path';
import { type SharedReceiptEnvelope } from '../../contracts/shared-receipt.js';
import { buildSharedReceipt, attachSharedReceiptSignature } from '../../contracts/shared-receipt.js';

export interface TranscriptEvent {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    stepId?: string;
    metadata?: Record<string, any>;
}

export class TranscriptService {
    private events: TranscriptEvent[] = [];
    private runId: string;
    private logDir = path.join(process.cwd(), 'logs', 'orchestrator');

    constructor(runId?: string) {
        this.runId = runId || `run_${Date.now()}`;
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    log(message: string, level: TranscriptEvent['level'] = 'info', stepId?: string, metadata?: Record<string, any>) {
        const event: TranscriptEvent = {
            timestamp: new Date().toISOString(),
            level,
            message,
            stepId,
            metadata
        };
        this.events.push(event);
        console.log(`[${event.timestamp}] [${level.toUpperCase()}] ${stepId ? `[${stepId}] ` : ''}${message}`);
    }

    async finalize(producerId: string, secret?: string): Promise<string> {
        const transcriptPath = path.join(this.logDir, `${this.runId}.json`);
        const transcript = {
            runId: this.runId,
            events: this.events,
            summary: {
                totalSteps: new Set(this.events.filter(e => e.stepId).map(e => e.stepId)).size,
                successCount: this.events.filter(e => e.level === 'success').length,
                errorCount: this.events.filter(e => e.level === 'error').length,
            }
        };

        fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));

        if (secret) {
            const receipt = buildSharedReceipt({
                receiptId: `rcpt_${this.runId}`,
                issuedAt: new Date().toISOString(),
                producer: { system: 'AGENTCACHE', id: producerId },
                subject: { kind: 'ORCHESTRATOR_RUN', id: this.runId },
                operation: { action: 'orchestrator.run' },
                trust: { verdict: transcript.summary.errorCount > 0 ? 'REVIEW' : 'PASS' },
                payload: { transcriptHash: this.runId }
            });
            const signed = attachSharedReceiptSignature(receipt, secret);
            fs.writeFileSync(path.join(this.logDir, `${this.runId}.receipt.json`), JSON.stringify(signed, null, 2));
        }

        return transcriptPath;
    }
}
