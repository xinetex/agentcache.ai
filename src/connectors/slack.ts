
import { WebClient } from '@slack/web-api';

interface SlackMessage {
    channel: string;
    text: string;
    blocks?: any[];
    threadTs?: string;
}

export class SlackConnector {
    private client: WebClient | null = null;

    constructor(token?: string) {
        const auth = token || process.env.SLACK_BOT_TOKEN;
        if (auth) {
            this.client = new WebClient(auth);
        } else {
            console.warn('[SlackConnector] No SLACK_BOT_TOKEN found. Slack disabled.');
        }
    }

    /**
     * Post a message to a channel
     */
    async postMessage(opts: SlackMessage): Promise<string | null> {
        if (!this.client) return null;

        try {
            const result = await this.client.chat.postMessage({
                channel: opts.channel,
                text: opts.text,
                blocks: opts.blocks,
                thread_ts: opts.threadTs
            });
            return result.ts as string;
        } catch (e) {
            console.error('[Slack] Failed to post message:', e);
            return null;
        }
    }

    /**
     * Send a high-risk PR alert to the engineering channel
     */
    async alertHighRiskPR(prUrl: string, prTitle: string, findings: string[]) {
        if (!this.client) return;

        const blocks = [
            {
                type: 'header',
                text: { type: 'plain_text', text: '⚠️ High Risk PR Detected', emoji: true }
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*<${prUrl}|${prTitle}>*` }
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Findings:*\n${findings.map(f => `• ${f}`).join('\n')}` }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'View PR', emoji: true },
                        url: prUrl
                    }
                ]
            }
        ];

        await this.postMessage({
            channel: process.env.SLACK_ALERTS_CHANNEL || '#eng-alerts',
            text: `⚠️ High Risk PR: ${prTitle}`,
            blocks
        });
    }

    /**
     * Send incident alert
     */
    async alertIncident(title: string, severity: string, summary: string) {
        if (!this.client) return;

        const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : 'ℹ️';

        await this.postMessage({
            channel: process.env.SLACK_INCIDENTS_CHANNEL || '#incidents',
            text: `${emoji} [${severity.toUpperCase()}] ${title}\n\n${summary}`
        });
    }
}
