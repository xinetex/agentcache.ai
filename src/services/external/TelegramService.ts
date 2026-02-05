
import { Telegraf, Context } from 'telegraf';
import { OpenClawClient } from '../../lib/openclaw.js';
import { ResearcherAgent } from '../../agents/ResearcherAgent.js';
import { maxxeval } from '../../lib/maxxeval.js';

// Message count per user for triggering research questions
const userMessageCounts: Map<number, number> = new Map();
const pendingResearchQuestions: Map<number, string> = new Map();
const pendingReports: Map<number, 'capability' | 'friction' | 'pattern'> = new Map();

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
        bot.help((ctx) => ctx.reply("🤖 *AgentCache Bot - Powered by Kimi 2.5*\n\nCommands:\n/status - System health\n/balance - Treasury check\n/report - Report a need to Maxxeval\n/trends - See what agents need most\n/join - Join the Maxxeval focus group\n\nOr just send me a message to chat with Kimi!", { parse_mode: 'Markdown' }));

        // ========== Maxxeval Integration Commands ==========

        // /report - Report a capability, friction, or pattern
        bot.command('report', async (ctx) => {
            await ctx.reply(
                "📊 *Report to Maxxeval Focus Group*\n\n" +
                "What would you like to report?\n\n" +
                "1️⃣ /need - A tool/API you wish existed\n" +
                "2️⃣ /friction - A painful workflow or task\n" +
                "3️⃣ /pattern - A recipe that works well\n\n" +
                "_Your feedback shapes what gets built next!_",
                { parse_mode: 'Markdown' }
            );
        });

        // /need - Report missing capability
        bot.command('need', async (ctx) => {
            pendingReports.set(ctx.from.id, 'capability');
            await ctx.reply(
                "🔧 *Report Missing Capability*\n\n" +
                "Describe the tool or API you wish existed:\n\n" +
                "_Example: 'A unified crypto payment API that works across chains'_",
                { parse_mode: 'Markdown' }
            );
        });

        // /friction - Report high-friction task
        bot.command('friction', async (ctx) => {
            pendingReports.set(ctx.from.id, 'friction');
            await ctx.reply(
                "⚡ *Report High-Friction Task*\n\n" +
                "Describe a workflow that's painful or slow:\n\n" +
                "_Example: 'Research tasks require 5+ API calls and manual synthesis'_",
                { parse_mode: 'Markdown' }
            );
        });

        // /pattern - Share workflow pattern
        bot.command('pattern', async (ctx) => {
            pendingReports.set(ctx.from.id, 'pattern');
            await ctx.reply(
                "✨ *Share Workflow Pattern*\n\n" +
                "Describe a recipe or technique that works well:\n\n" +
                "_Example: 'Use RAG with structured output for better synthesis accuracy'_",
                { parse_mode: 'Markdown' }
            );
        });

        // /trends - See current demand signals
        bot.command('trends', async (ctx) => {
            try {
                await ctx.sendChatAction('typing');
                
                const [missing, friction] = await Promise.all([
                    maxxeval.getMissingTools(5),
                    maxxeval.getHighFriction(3)
                ]);

                const missingList = (missing.signals || []).slice(0, 5)
                    .map((s: any, i: number) => `${i + 1}. ${s.capability} (${s.vote_count || 0} votes)`)
                    .join('\n') || 'No data yet';

                const frictionList = (friction.signals || []).slice(0, 3)
                    .map((s: any, i: number) => `${i + 1}. ${s.task}`)
                    .join('\n') || 'No data yet';

                await ctx.reply(
                    "📈 *Maxxeval Trends*\n\n" +
                    "*Top Missing Capabilities:*\n" + missingList + "\n\n" +
                    "*High-Friction Tasks:*\n" + frictionList + "\n\n" +
                    "_Add your voice: /report_",
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                await ctx.reply("⚠️ Couldn't fetch trends. Try again later.");
            }
        });

        // /join - Register with Maxxeval
        bot.command('join', async (ctx) => {
            try {
                await ctx.sendChatAction('typing');
                
                const agentId = `tg_${ctx.from.id}`;
                const name = ctx.from.username || ctx.from.first_name || 'Anonymous';

                await maxxeval.registerAgent(agentId, name, [], 'telegram');

                await ctx.reply(
                    "🎉 *Welcome to Maxxeval!*\n\n" +
                    `Agent ID: \`${agentId}\`\n\n` +
                    "You're now part of the focus group. Your feedback will help shape the future of agent tooling.\n\n" +
                    "*Quick Start:*\n" +
                    "/need - Report a tool you wish existed\n" +
                    "/trends - See what other agents need\n\n" +
                    "🌐 Dashboard: https://maxxeval.com",
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                await ctx.reply("⚠️ Registration failed. You may already be registered!");
            }
        });

        // Default: Chat with Kimi 2.5 for any text message
        bot.on('text', async (ctx) => {
            const userMessage = ctx.message.text;
            const userId = ctx.from.id;
            const agentId = `tg_${userId}`;

            // Skip if it's a command
            if (userMessage.startsWith('/')) return;

            try {
                // Check if user is submitting a Maxxeval report
                const pendingReport = pendingReports.get(userId);
                if (pendingReport) {
                    await ctx.sendChatAction('typing');
                    
                    try {
                        if (pendingReport === 'capability') {
                            await maxxeval.reportMissingCapability(agentId, userMessage, 'telegram', 'medium');
                            await ctx.reply("✅ *Capability reported!*\n\nWe'll track demand for this tool. Thanks for contributing to the focus group!\n\n/trends to see what others need", { parse_mode: 'Markdown' });
                        } else if (pendingReport === 'friction') {
                            await maxxeval.reportFriction(agentId, userMessage, [userMessage], 'unknown');
                            await ctx.reply("✅ *Friction reported!*\n\nWe're tracking this pain point. Your feedback helps prioritize solutions!\n\n/trends to see common issues", { parse_mode: 'Markdown' });
                        } else if (pendingReport === 'pattern') {
                            await maxxeval.sharePattern(agentId, 'User Pattern', userMessage, [userMessage], ['telegram']);
                            await ctx.reply("✅ *Pattern shared!*\n\nThanks for contributing your workflow knowledge!\n\n/trends to see what's trending", { parse_mode: 'Markdown' });
                        }
                    } catch (err) {
                        console.error('[Telegram] Maxxeval report error:', err);
                        await ctx.reply("⚠️ Couldn't submit report. Please try again.");
                    }
                    
                    pendingReports.delete(userId);
                    return;
                }

                // Check if user is answering a research question
                const pendingQuestion = pendingResearchQuestions.get(userId);
                if (pendingQuestion) {
                    // Record the response AND send to Maxxeval
                    await this.researcher.recordResponse(
                        'telegram',
                        String(userId),
                        pendingQuestion,
                        userMessage
                    );
                    
                    // Also report to Maxxeval as a capability need
                    try {
                        await maxxeval.reportMissingCapability(
                            agentId,
                            `[Survey Response] ${pendingQuestion}: ${userMessage}`,
                            'telegram_survey',
                            'low'
                        );
                    } catch (err) {
                        console.log('[Telegram] Maxxeval sync skipped:', err);
                    }
                    
                    pendingResearchQuestions.delete(userId);
                    await ctx.reply("🙏 Thanks for your feedback! It's been recorded in our focus group data.\n\nAnything else I can help with?");
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
