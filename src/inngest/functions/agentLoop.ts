
import { inngest } from "../client";
import { growthAgent } from "../../agents/GrowthAgent.js";
import { researcher } from "../../agents/ResearcherAgent.js";
import { maxxeval } from "../../lib/maxxeval.js";
import { db } from "../../db/client.js";
import { needsSignals } from "../../db/schema.js";
import { and, eq, desc } from 'drizzle-orm';

/**
 * The Heartbeat of the Economy.
 * Runs every 10 minutes to maximize autonomy while managing costs.
 *
 * Cadence Decision (Phase 2):
 *   - 10-min: GrowthAgent scan, ResearcherAgent lightweight check, Needs refresh
 *   - Daily (Vercel cron): Full research cycle + deep aggregation
 */
export const runAgentLoop = inngest.createFunction(
    { id: "agent-ecosystem-heartbeat" },
    { cron: "*/10 * * * *" }, // Cron Schedule
    async ({ step, event, logger }) => {

        logger.info("💓 Heartbeat started. Waking up agents...");

        // Step 1: Growth Agent Cycle
        const trends = await step.run("growth-agent-scan", async () => {
            logger.info("📈 GrowthAgent scanning Moltbook...");
            try {
                await growthAgent.runCycle();
                return { status: "success" };
            } catch (err) {
                logger.error("GrowthAgent failed:", err);
                throw err; // Trigger retry
            }
        });

        // Step 2: Researcher Agent – lightweight check (harvest + analyze)
        const research = await step.run("researcher-check", async () => {
            logger.info("🔬 ResearcherAgent running lightweight check...");
            try {
                // Analyze existing Telegram responses + ClawTasks feed
                const [bountyPatterns, telegramInsights] = await Promise.all([
                    researcher.analyzeClawTasksFeed(),
                    researcher.analyzeTelegramResponses()
                ]);
                // Harvest Moltbook replies (non-posting, just collection)
                await researcher.harvestMoltbookResponses();

                return {
                    status: "success",
                    bountyCount: Object.keys(bountyPatterns).length,
                    insightCount: telegramInsights.length
                };
            } catch (err) {
                logger.error("ResearcherAgent check failed:", err);
                // Non-critical — don't throw, just log
                return { status: "error", error: String(err) };
            }
        });

        // Step 3: Needs Refresh — pull latest demand signals from MaxxEval
        const needsRefresh = await step.run("needs-refresh", async () => {
            logger.info("📡 Refreshing needs signals from MaxxEval...");
            try {
                const [missing, friction, patterns] = await Promise.all([
                    maxxeval.getMissingTools(25),
                    maxxeval.getHighFriction(25),
                    maxxeval.getPatterns(25)
                ]);

                const toTitle = (s: any) => s?.capability || s?.task || s?.name || s?.title || '';
                const toScore = (s: any) => s?.vote_count ?? s?.count ?? s?.mentions ?? 0;
                const toDesc = (s: any) => s?.description || s?.details || s?.context || '';

                let upserted = 0;
                const allSignals = [
                    ...(missing?.signals || []).map((s: any) => ({ ...s, _type: 'missing_capability' })),
                    ...(friction?.signals || []).map((s: any) => ({ ...s, _type: 'friction' })),
                    ...((patterns?.patterns || patterns?.signals || []) as any[]).map((s: any) => ({ ...s, _type: 'pattern' }))
                ];

                for (const signal of allSignals) {
                    const title = toTitle(signal);
                    if (!title) continue;
                    const now = new Date();

                    const existing = await db.select().from(needsSignals)
                        .where(and(
                            eq(needsSignals.source, 'maxxeval'),
                            eq(needsSignals.type, signal._type),
                            eq(needsSignals.title, title)
                        ))
                        .limit(1);

                    if (existing.length === 0) {
                        await db.insert(needsSignals).values({
                            source: 'maxxeval',
                            type: signal._type,
                            title,
                            description: toDesc(signal),
                            score: toScore(signal),
                            raw: signal,
                            firstSeenAt: now,
                            lastSeenAt: now,
                            createdAt: now,
                            updatedAt: now
                        });
                    } else {
                        await db.update(needsSignals)
                            .set({ score: toScore(signal), raw: signal, lastSeenAt: now, updatedAt: now })
                            .where(eq(needsSignals.id, existing[0].id));
                    }
                    upserted++;
                }

                return { status: "success", upserted };
            } catch (err) {
                logger.error("Needs refresh failed:", err);
                return { status: "error", error: String(err) };
            }
        });

        logger.info("💤 Heartbeat complete. Agents sleeping.");
        return { trends, research, needsRefresh };
    }
);
