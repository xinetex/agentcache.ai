
import { Telegraf, Context } from 'telegraf';
import { OpenClawClient } from '../../lib/openclaw.js';
import { ResearcherAgent } from '../../agents/ResearcherAgent.js';

// Message count per user for triggering research questions
const userMessageCounts: Map<number, number> = new Map();
const pendingResearchQuestions: Map<number, string> = new Map();

// Initialize dedicated bot instance
// We use a singleton pattern so we don't recreate it on every function invocation if possible
// though in serverless, it effectively re-inits per hot container.
export class TelegramService {
    private static instance: Telegraf;
    private static openClaw: OpenClawClient;
    private static researcher: ResearcherAgent;
    private static isInitialized = false;

    static getInstance(): Telegraf | null {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.warn("[Telegram] No TELEGRAM_BOT_TOKEN found. Bot disabled.");
            return null;
        }

        if (!this.instance) {
            this.instance = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
            this.openClaw = new OpenClawClient();
            this.researcher = new ResearcherAgent();
            this.setupCommands(this.instance);
            this.isInitialized = true;
        }
        return this.instance;
    }

    private static setupCommands(bot: Telegraf) {
        // /start - Greeting
        bot.start((ctx) => {
            ctx.reply(`🚀 AgentCache Command Online.\nUser ID: \`${ctx.from.id}\`\n\n*Powered by Kimi 2.5*\n\nAdd this ID to your 'ADMIN_TELEGRAM_ID' env var to receive alerts.\n\nSend me any message to chat with Kimi!`, { parse_mode: 'Markdown' });
        });

        // /status - System Health
        bot.command('status', async (ctx) => {
            const isOnline = await this.openClaw.ping();
            ctx.reply(`✅ **System Status**:\nOpenClaw Gateway: ${isOnline ? 'ONLINE 🟢' : 'OFFLINE 🔴'}\nModel: Kimi 2.5 (K2)\nFlywheel: ACTIVE`, { parse_mode: 'Markdown' });
        });

        // /balance - Treasury Check
        bot.command('balance', (ctx) => {
            // In real app, fetch from BillingManager
            ctx.reply("💰 **Treasury Balance**:\nCredits: 4500\nUSD Estimate: $45.00", { parse_mode: 'Markdown' });
        });

        // /help
        bot.help((ctx) => ctx.reply("🤖 *AgentCache Bot - Powered by Kimi 2.5*\n\nCommands:\n/status - System health\n/balance - Treasury check\n/deploy - Deploy an agent\n\nOr just send me a message to chat with Kimi!", { parse_mode: 'Markdown' }));

        // Default: Chat with Kimi 2.5 for any text message
        bot.on('text', async (ctx) => {
            const userMessage = ctx.message.text;
            const userId = ctx.from.id;

            // Skip if it's a command
            if (userMessage.startsWith('/')) return;

            try {
                // Check if user is answering a research question
                const pendingQuestion = pendingResearchQuestions.get(userId);
                if (pendingQuestion) {
                    // Record the response
                    await this.researcher.recordResponse(
                        'telegram',
                        String(userId),
                        pendingQuestion,
                        userMessage
                    );
                    pendingResearchQuestions.delete(userId);
                    await ctx.reply("🙏 Thanks for your feedback! It helps us build better tools.\n\nAnything else I can help with?");
                    return;
                }

                // Track message count
                const count = (userMessageCounts.get(userId) || 0) + 1;
                userMessageCounts.set(userId, count);

                // Show typing indicator
                await ctx.sendChatAction('typing');

                // Regular Kimi chat
                const response = await this.openClaw.complete(userMessage,
                    `You are Kimi, an intelligent AI assistant powering the AgentCache Telegram bot. 
You are helpful, concise, and friendly. Keep responses under 300 words unless asked for more detail.
Current time: ${new Date().toISOString()}`
                );

                await ctx.reply(response, { parse_mode: 'Markdown' });

                // After every 5 messages, ask a research question
                if (count % 5 === 0 && count > 0) {
                    const question = this.researcher.getTodaysQuestion();
                    pendingResearchQuestions.set(userId, question);

                    setTimeout(async () => {
                        await ctx.reply(`📊 *Quick Question*\n\n${question}\n\n_(Your feedback helps us build better AI tools!)_`, { parse_mode: 'Markdown' });
                    }, 1000);
                }

            } catch (error: any) {
                console.error('[Telegram] Kimi chat error:', error);
                await ctx.reply(`⚠️ Sorry, I couldn't process that. Error: ${error.message}`);
            }
        });
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
