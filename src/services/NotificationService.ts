import { db } from '../db/client.js';
import { agentAlerts, notifications } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc, and } from 'drizzle-orm';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export class NotificationService {

    // --- User Notifications (The Bell) ---

    /**
     * Send a notification to a specific user.
     */
    async send(userId: string, type: NotificationType, title: string, message: string, link?: string, metadata?: any) {
        try {
            await db.insert(notifications).values({
                userId,
                type,
                title,
                message,
                link,
                metadata
            });
            console.log(`[Notification] Sent to ${userId}: ${title}`);

            // 3. Forward to Telegram (if critical or info)
            if (type !== 'success') {
                try {
                    // Lazy load to avoid circular deps
                    const { TelegramService } = await import('./external/TelegramService.js');
                    await TelegramService.notifyAdmin(`*${title}*\n${message}`);
                } catch (e) {
                    console.warn('[Notification] Failed to forward to Telegram:', e);
                }
            }
        } catch (err) {
            console.error('[Notification] Failed to send:', err);
        }
    }

    /**
     * Get unread notifications for a user.
     */
    async getUnread(userId: string) {
        return await db.select()
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
            .orderBy(desc(notifications.createdAt))
            .limit(50);
    }

    /**
    * Get all recent notifications for a user.
    */
    async getRecent(userId: string, limit = 20) {
        return await db.select()
            .from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt))
            .limit(limit);
    }

    /**
     * Mark a notification as read.
     */
    async markRead(notificationId: string, userId: string) {
        await db.update(notifications)
            .set({ isRead: true })
            .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
    }

    /**
     * Mark all notifications as read for a user.
     */
    async markAllRead(userId: string) {
        await db.update(notifications)
            .set({ isRead: true })
            .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    }

    // --- System Alerts (The Agents) ---

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
