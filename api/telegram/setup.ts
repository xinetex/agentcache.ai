
import { Telegraf } from 'telegraf';

export const config = {
    runtime: 'nodejs', // Telegraf requires Node.js
};

export default async function handler(req, res) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        return res.status(500).send('❌ Error: TELEGRAM_BOT_TOKEN is missing in Vercel Environment Variables.');
    }

    try {
        const bot = new Telegraf(token);

        // Auto-detect the domain this function is running on
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host']; // e.g., 'agentcache-ai.vercel.app'

        if (!host) {
            return res.status(400).send('❌ Error: Could not determine host header.');
        }

        const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

        console.log(`Setting webhook to: ${webhookUrl}`);

        // Register with Telegram
        const success = await bot.telegram.setWebhook(webhookUrl);

        if (success) {
            const info = await bot.telegram.getWebhookInfo();
            return res.status(200).send(`
                <h1>✅ Webhook Configured!</h1>
                <p><strong>URL:</strong> ${webhookUrl}</p>
                <p><strong>Status:</strong> Active</p>
                <p><strong>Pending Updates:</strong> ${info.pending_update_count}</p>
                <br/>
                <p>You can now go to Telegram and type <code>/start</code>.</p>
            `);
        } else {
            return res.status(500).send('❌ Telegram API returned false for setWebhook.');
        }

    } catch (e) {
        console.error("Setup failed:", e);
        return res.status(500).send(`❌ Setup Failed: ${e.message}`);
    }
}
