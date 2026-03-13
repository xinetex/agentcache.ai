/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * EmailService: Handles outbound communications via Resend.
 */

import { redis } from '../lib/redis.js';

export interface EmailPayload {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export class EmailService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.RESEND_API_KEY || '';
    }

    async sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string }> {
        if (!this.apiKey) {
            console.warn('[EmailService] ⚠️ No RESEND_API_KEY found. Mocking outbound email.');
            console.log(`[OUTBOUND MOCK] TO: ${payload.to} | SUBJECT: ${payload.subject}`);
            return { success: true, id: `mock-${Date.now()}` };
        }

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    from: 'AgentCache Outreach <outreach@agentcache.ai>',
                    to: payload.to,
                    subject: payload.subject,
                    html: payload.html || payload.text
                })
            });

            const data = await response.json();
            return { success: response.ok, id: data.id };
        } catch (e) {
            console.error('[EmailService] Failed to send email', e);
            return { success: false };
        }
    }
}

export const emailService = new EmailService();
