
import { db } from '../db/client.js';
import { agentAlerts } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

export class NotificationService {

    /**
     * Send an internal system alert
     */
    async sendAlert(agentName: string, severity: 'low' | 'medium' | 'critical', message: string, context: any = {}) {
        console.log(`[Notification] 🔔 ${severity.toUpperCase()}: ${agentName} - ${message}`);

        try {
            await db.insert(agentAlerts).values({
                id: uuidv4(),
                agentName,
                severity,
                message,
                context,
                status: 'open'
            }).returning();
        } catch (err) {
            console.error(`[Notification] Failed to persist alert:`, err.message);
        }
    }

    /**
     * Check thresholds and notify
     */
    async checkBalanceThreshold(agentId: string, balance: number, threshold: number) {
        if (balance < threshold) {
            await this.sendAlert(
                agentId,
                'medium',
                `Low Balance Warning: $${balance.toFixed(2)} < $${threshold.toFixed(2)}`,
                { type: 'finance', balance, threshold }
            );
        }
    }
}

export const notifier = new NotificationService();
