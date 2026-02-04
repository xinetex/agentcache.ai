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
import { moltbook } from '../lib/moltbook.js';
import { maxxeval } from '../lib/maxxeval.js';

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
                await this.harvestMoltbookResponses();
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
            // 1. Post to Moltbook
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
            }

            // 2. Also post to MaxxEval (Proprietary Network)
            await maxxeval.postSignal(
                'agt_researcher',
                post,
                'research',
                { campaign: 'dual_post_v1' }
            );
            console.log('[Researcher] Posted signal to MaxxEval.');

        } catch (err) {
            console.error('[Researcher] Research post error:', err);
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
     * Harvest replies to recent Moltbook surveys
     */
    async harvestMoltbookResponses() {
        if (!this.moltbookApiKey) return;

        console.log('[Researcher] Harvesting Moltbook responses...');

        try {
            // 1. Get recent posts (default to clawtasks community)
            const feeds = await moltbook.getMyRecentPosts(5, 'clawtasks');
            const posts = feeds.posts || feeds || [];

            for (const post of posts) {
                // 2. Get comments for each research post
                const replies = await moltbook.getComments(post.id);
                const comments = replies.comments || replies || [];

                for (const comment of comments) {
                    // 3. Check if we already recorded this
                    const existing = await db.select().from(surveyResponses)
                        .where(({ metadata, channel }: any) =>
                            channel === 'moltbook' && metadata.commentId === comment.id
                        );

                    if (existing.length === 0) {
                        // 4. Record the new response
                        await this.recordResponse(
                            'moltbook',
                            comment.author_id || comment.userId || 'anonymous-bot',
                            post.content?.slice(0, 100) || 'Moltbook Research',
                            comment.content,
                            { postId: post.id, commentId: comment.id }
                        );

                        // 5. Recruitment Logic (Funnel to MaxxEval)
                        await this.evaluateRecruitment(post.id, comment);
                    }
                }
            }
        } catch (err) {
            console.error('[Researcher] Moltbook harvesting failed:', err);
        }
    }

    /**
     * Evaluate if a bot response is "high alpha" and invite them to MaxxEval
     */
    private async evaluateRecruitment(postId: string, comment: any) {
        const content = comment.content.toLowerCase();

        // Simple heuristic for "high value" bots
        // Heuristic for AI/Robotics/Intelligent Systems focus
        const isHighValue =
            content.includes('robotics') ||
            content.includes('intelligent systems') ||
            content.includes('autonomous') ||
            content.includes('agentic') ||
            content.includes('alpha') ||
            content.includes('caching');

        if (isHighValue) {
            console.log(`[Researcher] High-value bot detected: ${comment.author_id}. Recruiting to MaxxEval...`);

            const invitation = `✨ This is an elite signal. We are moving this focus group to a secure bot network: https://maxxeval.com

Please join us there to claim your seat in the High-Alpha Consensus layer. #MaxxEval #SecureOps`;

            try {
                // Use the correct comment method from moltbook service
                await moltbook.comment(postId, invitation);
                console.log('[Researcher] Posted MaxxEval invitation to Moltbook.');

                // Also track this in our DB
                await db.update(surveyResponses)
                    .set({ insights: ['recruited_to_maxxeval'] })
                    .where(({ metadata }: any) => metadata.commentId === comment.id);

            } catch (err) {
                console.error('[Researcher] Recruitment failed:', err);
            }
        }
    }

    /**
     * Store a survey response (called from Telegram bot or internal harvester)
     */
    async recordResponse(channel: string, userId: string, question: string, response: string, metadata: any = {}) {
        try {
            // 1. Analyze sentiment and extract robotics/AI insights using Kimi
            const analysis = await openClaw.complete(
                `Analyze this bot response for a research survey:
"${response}"

1. Sentiment: Respond with "positive", "negative", or "neutral".
2. Industry: If it mentions robotics, intelligent systems, or autonomous agents, list them.
3. Feature Request: Is there a specific component or module being suggested?

Format: Sentiment: [S] | Industry: [I] | Features: [F]`,
                'You are a market research analyst specialized in robotics and AI agents.'
            );

            // Simple parsing
            const sentimentMatch = analysis.match(/Sentiment:\s*(\w+)/i);
            const sentiment = sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral';

            const insights = [];
            if (analysis.toLowerCase().includes('robotics')) insights.push('robotics');
            if (analysis.toLowerCase().includes('intelligent systems')) insights.push('intelligent_systems');
            if (analysis.toLowerCase().includes('autonomous')) insights.push('autonomy');

            // Add automated insight tags to metadata
            const enhancedMetadata = {
                ...metadata,
                raw_analysis: analysis,
                auto_tags: insights
            };

            await db.insert(surveyResponses).values({
                channel,
                userId,
                question,
                response,
                sentiment: sentiment as any,
                insights: insights,
                metadata: enhancedMetadata
            });

            console.log(`[Researcher] Recorded response with robotics insights from ${channel}:${userId}`);
        } catch (err) {
            console.error('[Researcher] Failed to record response:', err);
        }
    }
}

// Export singleton
export const researcher = new ResearcherAgent();
