import { db } from '../db/client.js';
import { agents, hubAgents } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { AgentProfile } from '../lib/focus-group/agent-profile.js';

/**
 * AgentOrchestrator: The central brain for agent lifecycle and swarm management.
 * 
 * Responsibilities:
 * 1. Spawning agent actors from hub profiles
 * 2. Managing state transitions (idle -> working -> sleeping)
 * 3. Tracking heartbeats and health in Redis
 * 4. Orchestrating multi-agent swarms for complex tasks
 */
export class AgentOrchestrator {

    /**
     * Spawn an actor instance from a hub profile.
     */
    async spawn(profileId: string, overrides: any = {}): Promise<any> {
        try {
            // 1. Get profile from registry
            const profileRow = await db.select().from(hubAgents).where(eq(hubAgents.id, profileId)).limit(1);
            if (profileRow.length === 0) throw new Error(`Profile ${profileId} not found`);
            const profile = profileRow[0];

            // 2. Create actor in 'agents' table
            const [actor] = await db.insert(agents).values({
                name: overrides.name || profile.name,
                role: profile.role,
                status: 'idle',
                config: {
                    profileId,
                    model: profile.modelBackend,
                    ...overrides.config
                }
            }).returning();

            // 3. Register in Redis for real-time tracking
            await redis.set(`agent:actor:${actor.id}:status`, 'idle');
            await redis.set(`agent:actor:${actor.id}:heartbeat`, Date.now().toString());

            return actor;
        } catch (e: any) {
            console.error('[Orchestrator] Spawn error:', e.message);
            throw e;
        }
    }

    /**
     * Transition an agent to a new state.
     */
    async transition(actorId: string, newState: 'idle' | 'working' | 'sleeping' | 'dead'): Promise<void> {
        await db.update(agents)
            .set({ status: newState, updatedAt: new Date() })
            .where(eq(agents.id, actorId as any));
        
        await redis.set(`agent:actor:${actorId}:status`, newState);
    }

    /**
     * Get all active actors.
     */
    async getActiveActors(): Promise<any[]> {
        return db.select().from(agents).where(sql`status != 'dead'`);
    }

    /**
     * Update agent heartbeat.
     */
    async heartbeat(actorId: string, metadata: any = {}): Promise<void> {
        await redis.set(`agent:actor:${actorId}:heartbeat`, Date.now().toString());
        if (metadata.status) {
            await this.transition(actorId, metadata.status);
        }
        if (metadata.currentTask) {
            await redis.set(`agent:actor:${actorId}:task`, JSON.stringify(metadata.currentTask));
        }
    }

    /**
     * Get real-time status from Redis.
     */
    async getStatus(actorId: string): Promise<any> {
        const [status, heartbeat, task] = await Promise.all([
            redis.get(`agent:actor:${actorId}:status`),
            redis.get(`agent:actor:${actorId}:heartbeat`),
            redis.get(`agent:actor:${actorId}:task`)
        ]);

        const lastSeen = parseInt(heartbeat as string || '0');
        const isOnline = Date.now() - lastSeen < 30000; // 30s threshold

        return {
            id: actorId,
            status: status || 'unknown',
            isOnline,
            lastSeen: new Date(lastSeen).toISOString(),
            currentTask: task ? JSON.parse(task as string) : null
        };
    }
}

export const agentOrchestrator = new AgentOrchestrator();
