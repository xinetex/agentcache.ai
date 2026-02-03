
import { Telegraf, Context } from 'telegraf';

// Initialize dedicated bot instance
// We use a singleton pattern so we don't recreate it on every function invocation if possible
// though in serverless, it effectively re-inits per hot container.
export class TelegramService {
    private static instance: Telegraf;
    private static isInitialized = false;

    static getInstance(): Telegraf | null {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.warn("[Telegram] No TELEGRAM_BOT_TOKEN found. Bot disabled.");
            return null;
        }

        if (!this.instance) {
            this.instance = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
            this.setupCommands(this.instance);
            this.isInitialized = true;
        }
        return this.instance;
    }

    private static setupCommands(bot: Telegraf) {
        // /start - Greeting
        bot.start((ctx) => {
            ctx.reply(`🚀 AgentCache Command Online.\nUser ID: \`${ctx.from.id}\`\n\nAdd this ID to your 'ADMIN_TELEGRAM_ID' env var to receive alerts.`);
        });

        // /status - System Health
        bot.command('status', (ctx) => {
            ctx.reply("✅ **System Status**:\nAll Systems Nominal.\nFlywheel: ACTIVE");
        });

        // /balance - Treasury Check
        bot.command('balance', (ctx) => {
            // In real app, fetch from BillingManager
            ctx.reply("💰 **Treasury Balance**:\nCredits: 4500\nUSD Estimate: $45.00");
        });

        // /help
        bot.help((ctx) => ctx.reply("Available commands: /status, /balance, /deploy"));
    }

    /**
     * Broadcast a message to the Admin
     */
    static async notifyAdmin(message: string) {
        const bot = this.getInstance();
        const adminId = process.env.ADMIN_TELEGRAM_ID;

        if (bot && adminId) {
            try {
                await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
                return true;
            } catch (e) {
                console.error("[Telegram] Failed to send notification:", e);
                return false;
            }
        }
        return false;
    }

    /**
     * Vercel Webhook Handler
     * Pass the incoming HTTP request body to Telegraf
     */
    static async handleUpdate(body: any) {
        const bot = this.getInstance();
        if (bot) {
            await bot.handleUpdate(body);
        }
    }
}
