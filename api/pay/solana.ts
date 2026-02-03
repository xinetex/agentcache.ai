
import { SolanaService } from '../../src/services/SolanaService.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { amount = 0.1, label = 'AgentCache Store', message = 'Payment for Services' } = req.body;

    try {
        const request = SolanaService.createPaymentRequest(amount, label, message);

        return res.status(200).json({
            status: 'pending',
            ...request
        });
    } catch (error) {
        console.error('Solana Pay Error:', error);
        return res.status(500).json({ error: 'Failed to generate payment request' });
    }
}
