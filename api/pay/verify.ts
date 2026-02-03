
import { SolanaService } from '../../src/services/SolanaService.js';

export default async function handler(req, res) {
    const { reference, amount } = req.body || req.query;

    if (!reference || !amount) {
        return res.status(400).json({ error: 'Missing reference or amount' });
    }

    try {
        const isVerified = await SolanaService.verifyPayment(reference, parseFloat(amount));

        if (isVerified) {
            return res.status(200).json({ status: 'confirmed', message: 'Payment verified on-chain' });
        } else {
            return res.status(200).json({ status: 'pending', message: 'Payment not found yet' });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Verification failed', details: error.message });
    }
}
