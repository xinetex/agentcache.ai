
/**
 * Sentry Connector: Parse and normalize Sentry webhook payloads
 */

export interface SentryIssue {
    id: string;
    title: string;
    culprit: string;
    shortId: string;
    project: {
        id: string;
        name: string;
        slug: string;
    };
    level: 'error' | 'warning' | 'info' | 'debug';
    firstSeen: string;
    lastSeen: string;
    count: number;
    metadata: {
        type?: string;
        value?: string;
        filename?: string;
        function?: string;
    };
}

export interface SentryWebhookPayload {
    action: 'created' | 'resolved' | 'assigned' | 'archived' | 'unresolved';
    data: {
        issue: SentryIssue;
        event?: {
            eventID: string;
            message?: string;
            platform?: string;
            environment?: string;
            release?: string;
            tags?: Array<{ key: string; value: string }>;
            exception?: {
                values?: Array<{
                    type: string;
                    value: string;
                    stacktrace?: {
                        frames?: Array<{
                            filename: string;
                            function: string;
                            lineno: number;
                            colno: number;
                            context_line?: string;
                        }>;
                    };
                }>;
            };
        };
    };
    installation?: {
        uuid: string;
    };
}

export class SentryConnector {
    /**
     * Normalize Sentry webhook payload into IncidentJobPayload
     */
    static normalizePayload(payload: SentryWebhookPayload) {
        const issue = payload.data.issue;
        const event = payload.data.event;

        // Build stack trace from exception frames
        let stackTrace = '';
        if (event?.exception?.values?.[0]?.stacktrace?.frames) {
            const frames = event.exception.values[0].stacktrace.frames.slice(-10); // Last 10 frames
            stackTrace = frames
                .reverse()
                .map(f => `  at ${f.function || 'anonymous'} (${f.filename}:${f.lineno})`)
                .join('\n');
        }

        // Extract tags as record
        const tags: Record<string, string> = {};
        if (event?.tags) {
            event.tags.forEach(t => tags[t.key] = t.value);
        }

        return {
            source: 'sentry' as const,
            alertId: issue.shortId,
            title: issue.title,
            message: issue.metadata?.value || issue.culprit || issue.title,
            level: issue.level as 'error' | 'warning' | 'info',
            timestamp: issue.lastSeen,
            metadata: {
                projectSlug: issue.project.slug,
                environment: event?.environment || 'production',
                release: event?.release,
                stackTrace: stackTrace || undefined,
                tags
            }
        };
    }

    /**
     * Verify Sentry webhook signature
     */
    static verifySignature(payload: string, signature: string, secret: string): boolean {
        // Sentry uses HMAC-SHA256
        // Format: "sha256=<hex-digest>"
        const crypto = require('crypto');
        const expected = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        return `sha256=${expected}` === signature;
    }
}
