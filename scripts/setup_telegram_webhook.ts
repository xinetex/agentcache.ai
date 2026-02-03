
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const domain = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'your-project.vercel.app';
// Note: Vercel doesn't always expose VERCEL_URL in local dev without pulling, 
// so user might need to edit this or pass it as arg.

async function setup() {
    if (!token) {
        console.error("❌ Error: TELEGRAM_BOT_TOKEN is missing from .env");
        process.exit(1);
    }

    const bot = new Telegraf(token);

    // Get current info
    const info = await bot.telegram.getWebhookInfo();
    console.log("Health Check:", info);

    // Get URL from args or prompt
    // For now we assume the user will run this locally and might want to set a specific URL.
    const targetUrl = process.argv[2];

    if (!targetUrl) {
        console.log(`
Usage: npx tsx scripts/setup_telegram_webhook.ts <FULL_HTTPS_URL>

Example:
npx tsx scripts/setup_telegram_webhook.ts https://agentcache-ai.vercel.app/api/telegram/webhook

Current Webhook URL: ${info.url || '(none)'}
Pending Updates: ${info.pending_update_count}
Last Error: ${info.last_error_message || '(none)'}
        `);
        return;
    }

    console.log(`\nSetting webhook to: ${targetUrl}`);
    const result = await bot.telegram.setWebhook(targetUrl);

    if (result) {
        console.log("✅ Webhook successfully set!");
        console.log("Test it by sending /start to your bot.");
    } else {
        console.error("❌ Failed to set webhook.");
    }
}

setup().catch(console.error);
