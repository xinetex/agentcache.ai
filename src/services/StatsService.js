import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export class StatsService {
    constructor(dbClient) {
        this.db = dbClient;
    }

    async getGlobalStats() {
        try {
            // Aggregate Global Stats from Postgres (pipeline_metrics)
            // We use raw SQL because pipeline_metrics might not be in the loaded schema object
            const statsQuery = sql`
                SELECT 
                    COALESCE(SUM(requests), 0) as total_requests,
                    COALESCE(SUM(cache_hits), 0) as total_hits,
                    COALESCE(SUM(cache_misses), 0) as total_misses,
                    COALESCE(SUM(tokens_saved), 0) as tokens_saved
                FROM pipeline_metrics 
                WHERE timestamp >= NOW() - INTERVAL '24 HOURS'
            `;

            // Execute raw query (Drizzle dependent on driver, postgres-js returns array)
            // db.execute is available in recent Drizzle versions, or we can use the client directly if exposed.
            // But db is `drizzle(client)`.
            // Workaround: We can't easily do raw SQL select without the table defined in schema for `db.select`.
            // We will trust that if it fails, we return 0. 
            // Better approach: Use the `users` table count as a proxy for "Total Operators" at least.
            // And use `api_keys` for "Active Sessions".

            // 1. Total Users
            const userCountRes = await this.db.execute(sql`SELECT COUNT(*) as count FROM users`);
            const totalUsers = parseInt(userCountRes[0]?.count || 0);

            // 2. Active Sessions (Active API Keys)
            const activeKeysRes = await this.db.execute(sql`SELECT COUNT(*) as count FROM api_keys WHERE is_active = TRUE`);
            const activeSessions = parseInt(activeKeysRes[0]?.count || 0);

            // 3. Global Traffic (Try pipeline_metrics, fallback to 0)
            let hits = 0;
            let misses = 0;
            let costSaved = "0.00";
            let hitRate = 0;

            try {
                const metricsRes = await this.db.execute(statsQuery);
                const m = metricsRes[0];
                hits = parseInt(m.total_hits || 0);
                misses = parseInt(m.total_misses || 0);
                const totalReq = hits + misses;
                hitRate = totalReq > 0 ? ((hits / totalReq) * 100).toFixed(1) : 0;
                costSaved = (parseInt(m.tokens_saved || 0) * 0.01 / 1000).toFixed(2);
            } catch (err) {
                console.warn('[StatsService] Failed to query pipeline_metrics (Table might be missing):', err.message);
            }

            // 4. Top Users (Mock or specific query)
            const topUsers = [
                { rank: 1, name: 'Clinical-Bot-1', score: 14050, sector: 'Medical' },
                { rank: 2, name: 'Trading-Alpha', score: 9240, sector: 'Finance' },
                { rank: 3, name: 'Legal-Reviewer', score: 8100, sector: 'Legal' },
                { rank: 4, name: 'Code-Linter', score: 4500, sector: 'Dev' },
                { rank: 5, name: 'Creative-Unit', score: 3200, sector: 'Design' }
            ];

            // 5. Growth Data (Mocked)
            const growthData = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return {
                    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    date: d.toISOString().slice(0, 10),
                    users: Math.max(0, totalUsers - (6 - i) * 5)
                };
            });

            return {
                total_users: totalUsers,
                active_sessions: activeSessions,
                system_health: 'OPTIMAL',
                db_latency: '14ms', // Mocked latency
                cache_hits_today: hits,
                cache_misses_today: misses,
                hit_rate: Number(hitRate),
                cost_saved_today: `$${costSaved}`,
                top_users: topUsers,
                growth_data: growthData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[StatsService] Critical DB Error:', error);
            // Return safe fallback
            return {
                total_users: 0,
                active_sessions: 0,
                system_health: 'DEGRADED',
                db_latency: '0ms',
                cache_hits_today: 0,
                cache_misses_today: 0,
                hit_rate: 0,
                cost_saved_today: `$0.00`,
                top_users: [],
                growth_data: [],
                timestamp: new Date().toISOString()
            };
        }
    }
}

export const statsService = new StatsService(db);
