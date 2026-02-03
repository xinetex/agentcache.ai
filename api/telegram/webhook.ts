
import { TelegramService } from '../../src/services/external/TelegramService.js';

export const config = {
    runtime: 'nodejs', // Telegraf requires Node.js APIs (http/https/crypto)
};

// Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('AgentCache Telegram Bot is Active.');
    }

    try {
        await TelegramService.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (e) {
        console.error("Telegram Webhook Error:", e);
        res.status(500).send('Error');
    }
}
