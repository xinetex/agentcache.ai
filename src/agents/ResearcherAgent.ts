/**
 * Researcher Agent
 * 
 * Autonomously gathers market intelligence to discover what services agents/swarms need.
 * 
 * Channels:
 * - Telegram: Asks users research questions after chatting
 * - Moltbook: Posts daily surveys to m/clawtasks community
 * - ClawTasks: Analyzes bounty patterns to see what work is needed
 */

import { openClaw } from '../lib/openclaw.js';
import { db } from '../db/client.js';
import { surveyResponses, marketInsights } from '../db/schema.js';

// Survey questions - rotated daily
const SURVEY_QUESTIONS = [
    // Discovery
    "What's the most tedious task your agent does repeatedly?",
    "If you could hire another agent to help yours, what would they do?",
    "What API or service do you wish existed for agents?",
    "What's the biggest bottleneck in your agent workflow?",
    "What task takes your agent the longest to complete?",

    // Validation
    "Would you pay for a caching layer that cut your LLM costs 70%?",
    "Would you pay for a Trust Broker that verifies claims?",
    "Would you pay for a workflow orchestrator that chains agents?",
    "What would make you switch from your current agent framework?",

    // Open-ended
    "Describe a workflow you wish you could automate but can't.",
    "What's your agent's biggest weakness?",
    "If you could add one feature to your agent, what would it be?"
];

export class ResearcherAgent {
    private moltbookApiKey?: string;

    constructor() {
        this.moltbookApiKey = process.env.MOLTBOOK_API_KEY;
    }

    /**
     * Get today's survey question (rotates daily)
     */
    getTodaysQuestion(): string {
        const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
        return SURVEY_QUESTIONS[dayOfYear % SURVEY_QUESTIONS.length];
    }

    /**
     * Run a single research cycle
     */
    async runCycle() {
        console.log('[Researcher] Starting research cycle...');

        try {
            // 1. Analyze ClawTasks feed for patterns
            const bountyPatterns = await this.analyzeClawTasksFeed();

            // 2. Analyze recent Telegram responses
            const telegramInsights = await this.analyzeTelegramResponses();

            // 3. Post to Moltbook (if configured)
            if (this.moltbookApiKey) {
                await this.postMoltbookSurvey();
            }

            // 4. Generate weekly insights (if Sunday)
            const today = new Date();
            if (today.getDay() === 0) {
                await this.generateWeeklyReport(bountyPatterns, telegramInsights);
            }

            console.log('[Researcher] Cycle complete.');
        } catch (err) {
            console.error('[Researcher] Cycle error:', err);
        }
    }

    /**
     * Analyze ClawTasks feed to see what work agents are requesting
     */
    async analyzeClawTasksFeed(): Promise<any> {
        try {
            const response = await fetch('https://clawtasks.com/api/feed');
            if (!response.ok) return {};

            const feed = await response.json();
            const activities = feed.activities || feed || [];

            // Extract patterns using Kimi
            const feedText = activities.slice(0, 20).map((a: any) =>
                `${a.type || 'activity'}: ${a.title || a.description || JSON.stringify(a)}`
            ).join('\n');

            if (!feedText) return {};

            const analysis = await openClaw.complete(
                `Analyze this ClawTasks activity feed and identify:
1. Top 3 most requested skills/services
2. Common patterns in bounty types
3. Price ranges (if visible)
4. Emerging trends

Feed data:
${feedText}

Respond in JSON format: { "topSkills": [], "patterns": [], "priceRanges": [], "trends": [] }`,
                'You are a market research analyst. Extract actionable insights from agent marketplace data.'
            );

            try {
                return JSON.parse(analysis);
            } catch {
                return { raw: analysis };
            }
        } catch (err) {
            console.error('[Researcher] ClawTasks analysis failed:', err);
            return {};
        }
    }

    /**
     * Analyze Telegram responses collected from bot interactions
     */
    async analyzeTelegramResponses(): Promise<string[]> {
        try {
            // Get recent responses from database
            const responses = await db.select().from(surveyResponses)
                .where(({ channel }: any) => channel === 'telegram')
                .orderBy(({ createdAt }: any) => createdAt)
                .limit(50);

            if (responses.length === 0) {
                console.log('[Researcher] No Telegram responses to analyze.');
                return [];
            }

            // Extract themes using Kimi
            const responseText = responses.map((r: any) =>
                `Q: ${r.question}\nA: ${r.response}`
            ).join('\n\n');

            const themes = await openClaw.complete(
                `Analyze these survey responses and extract the top 5 themes/insights:

${responseText}

List the themes as a JSON array of strings.`,
                'You are a qualitative researcher. Extract key themes from user feedback.'
            );

            try {
                return JSON.parse(themes);
            } catch {
                return [themes];
            }
        } catch (err) {
            console.error('[Researcher] Telegram analysis failed:', err);
            return [];
        }
    }

    /**
     * Post a survey question to Moltbook
     */
    async postMoltbookSurvey() {
        if (!this.moltbookApiKey) {
            console.log('[Researcher] Moltbook not configured, skipping.');
            return;
        }

        const question = this.getTodaysQuestion();
        const post = `🔬 **AgentCache Research Question of the Day**

${question}

Reply with your thoughts! Your feedback helps us build better tools for AI agents.

#AgentResearch #ClawTasks #AIAgents`;

        try {
            const response = await fetch('https://api.moltbook.com/v1/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.moltbookApiKey}`
                },
                body: JSON.stringify({
                    content: post,
                    community: 'clawtasks'
                })
            });

            if (response.ok) {
                console.log('[Researcher] Posted survey to Moltbook.');
            } else {
                console.error('[Researcher] Moltbook post failed:', await response.text());
            }
        } catch (err) {
            console.error('[Researcher] Moltbook post error:', err);
        }
    }

    /**
     * Generate weekly insights report
     */
    async generateWeeklyReport(bountyPatterns: any, telegramInsights: string[]) {
        console.log('[Researcher] Generating weekly insights report...');

        try {
            // Count responses this week
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const count = await db.select().from(surveyResponses)
                .where(({ createdAt }: any) => createdAt >= weekAgo);

            // Use Kimi to synthesize insights
            const report = await openClaw.complete(
                `Create a market insights report based on:

Bounty Analysis:
${JSON.stringify(bountyPatterns, null, 2)}

Survey Themes:
${telegramInsights.join('\n')}

Survey Response Count: ${count?.length || 0}

Provide:
1. Top 3 findings
2. Top 3 product opportunities
3. Top 3 pain points
4. Recommended next steps

Format as JSON: { "findings": [], "opportunities": [], "painPoints": [], "recommendations": [] }`,
                'You are a product strategist. Synthesize market research into actionable recommendations.'
            );

            let parsed;
            try {
                parsed = JSON.parse(report);
            } catch {
                parsed = { raw: report };
            }

            // Store in database
            await db.insert(marketInsights).values({
                weekOf: new Date(),
                topSkills: bountyPatterns.topSkills || [],
                painPoints: parsed.painPoints || [],
                opportunities: parsed.opportunities || [],
                surveyCount: count?.length || 0,
                bountyAnalysis: bountyPatterns
            });

            console.log('[Researcher] Weekly report generated and stored.');
            return parsed;
        } catch (err) {
            console.error('[Researcher] Report generation failed:', err);
            return null;
        }
    }

    /**
     * Store a survey response (called from Telegram bot)
     */
    async recordResponse(channel: string, userId: string, question: string, response: string) {
        try {
            // Analyze sentiment with Kimi
            const sentiment = await openClaw.complete(
                `Classify the sentiment of this response as "positive", "negative", or "neutral":
"${response}"
Respond with only the sentiment word.`,
                'You are a sentiment classifier.'
            );

            await db.insert(surveyResponses).values({
                channel,
                userId,
                question,
                response,
                sentiment: sentiment.trim().toLowerCase() as any,
                insights: []
            });

            console.log(`[Researcher] Recorded response from ${channel}:${userId}`);
        } catch (err) {
            console.error('[Researcher] Failed to record response:', err);
        }
    }
}

// Export singleton
export const researcher = new ResearcherAgent();
