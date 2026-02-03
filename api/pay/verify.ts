import { SolanaService } from '../../src/services/SolanaService.js';
import { notifier } from '../../src/services/NotificationService.js';

export async function GET(req) {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    const amount = url.searchParams.get('amount');
    const userId = url.searchParams.get('userId');

    if (!reference || !amount) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    try {
        const isConfirmed = await SolanaService.verifyPayment(reference, parseFloat(amount));

        if (isConfirmed && userId) {
            // Send Notification
            await notifier.send(
                userId,
                'success',
                'Payment Received',
                `Successfully received ${amount} SOL. Credits have been added to your account.`,
                '/billing'
            );
        }

        return new Response(JSON.stringify({
            status: isConfirmed ? 'confirmed' : 'pending'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
