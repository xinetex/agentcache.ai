
import { db } from '../src/db/client.js';
import { creditUsageDaily, decisions, agents, marketplaceListings } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

export async function dashboardHandler(req, res) {
    // 1. Auth Check (Mock for now, replacing hardcoded check)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real app, verify token and get userId.
    // For this prototype, we'll assume a specific demo user ID or fetch the first user.
    // const userId = ... 
    // For now, let's just query "global" stats or a specific seeder user if we had one.
    // Since we don't have a robust Auth middleware in this specific file context yet,
    // we will fetch generic stats to prove the wiring, or fetch the first user's stats.

    try {
        // Mock User Context (replace with real auth)
        const mockUserId = '00000000-0000-0000-0000-000000000000'; // Placeholder

        // 2. Fetch Usage (Efficiency)
        const usageData = await db.select()
            .from(creditUsageDaily)
            // .where(eq(creditUsageDaily.userId, mockUserId)) // Uncomment when auth is real
            .orderBy(desc(creditUsageDaily.date))
            .limit(1);

        const currentUsage = usageData[0] || { totalCreditsUsed: 0, cacheReads: 0, edgeInvocations: 0 };
        const hitRate = currentUsage.edgeInvocations > 0
            ? Math.round((currentUsage.cacheReads / currentUsage.edgeInvocations) * 100)
            : 0;

        // 3. Fetch Recent Activity (Decisions)
        const activity = await db.select({
            id: decisions.id,
            action: decisions.action,
            reasoning: decisions.reasoning,
            timestamp: decisions.timestamp,
            agentName: agents.name
        })
            .from(decisions)
            .leftJoin(agents, eq(decisions.agentId, agents.id))
            .orderBy(desc(decisions.timestamp))
            .limit(5);

        // 4. Fetch Opportunities (Marketplace Listings that are 'hot' or relevant)
        const opportunities = await db.select()
            .from(marketplaceListings)
            .limit(2);

        // 5. Construct Response
        const dashboardData = {
            usage: {
                requests: currentUsage.edgeInvocations || 0,
                hitRate: hitRate,
                totalMonthlyCost: currentUsage.totalCreditsUsed || 0,
            },
            opportunities: opportunities.map(op => ({
                id: op.id,
                title: op.title,
                description: op.description,
                type: 'optimization', // valid types: risk, optimization
                actionLabel: 'VIEW',
                icon: 'solar:shop-linear',
                color: 'indigo'
            })),
            recentActivity: activity.map(act => ({
                time: new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: act.action,
                subtitle: act.agentName ? `Agent: ${act.agentName}` : act.reasoning || 'System Action',
                color: 'emerald'
            }))
        };

        res.json(dashboardData);

    } catch (error) {
        console.error('Dashboard API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
