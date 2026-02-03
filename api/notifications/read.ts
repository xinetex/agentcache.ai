import { notifier } from '../../src/services/NotificationService.js';

export async function POST(req) {
    const body = await req.json();
    const { notificationId, userId } = body;

    if (!notificationId || !userId) {
        return new Response(JSON.stringify({ error: 'Missing notificationId or userId' }), { status: 400 });
    }

    try {
        if (notificationId === 'all') {
            await notifier.markAllRead(userId);
        } else {
            await notifier.markRead(notificationId, userId);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
