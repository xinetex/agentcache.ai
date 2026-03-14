/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * CollectiveCortex: Pillar 2 of Inter-Agent Liquidity.
 * Enables shared state and joint objective optimization across multi-domain MAS.
 */

import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis.js';
import { cognitiveEngine } from '../infrastructure/CognitiveEngine.js';
import { sectorSolutionOrchestrator, SectorType } from './SectorSolutionOrchestrator.js';

export interface JointObjectiveSession {
    id: string;
    objective: string;
    participants: string[]; // Agent IDs
    sectors: SectorType[];
    sharedState: Record<string, any>;
    directives: Record<string, string>; // Optimized instructions per agent
    status: 'ACTIVE' | 'CONVERGED' | 'STALLED';
    createdAt: string;
}

const JOINT_SESSION_KEY_PREFIX = 'joint_session:';
const JOINT_SESSION_ACTIVE_INDEX = 'joint_sessions:active';

function buildJointSessionKey(sessionId: string): string {
    return `${JOINT_SESSION_KEY_PREFIX}${sessionId}`;
}

export class CollectiveCortex {
    private async readSession(sessionId: string): Promise<JointObjectiveSession | null> {
        const raw = await redis.get(buildJointSessionKey(sessionId));
        if (!raw || typeof raw !== 'string') return null;

        try {
            return JSON.parse(raw) as JointObjectiveSession;
        } catch {
            return null;
        }
    }

    private async writeSession(session: JointObjectiveSession) {
        await Promise.all([
            redis.set(buildJointSessionKey(session.id), JSON.stringify(session)),
            redis.sadd(JOINT_SESSION_ACTIVE_INDEX, session.id),
        ]);
    }

    /**
     * Initialize a Joint Objective Session.
     */
    async initiateSession(objective: string, participants: string[]): Promise<JointObjectiveSession> {
        const id = uuidv4().substring(0, 8);
        
        // 1. Resolve Sectors for participants
        const solutions = await sectorSolutionOrchestrator.getActiveSolutions();
        const sectors = participants.map(id => {
            const solution = solutions.find(s => s.agentId === id);
            return solution?.sector || 'PLANETARY' as SectorType;
        });

        const session: JointObjectiveSession = {
            id,
            objective,
            participants,
            sectors,
            sharedState: {},
            directives: {},
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        await this.writeSession(session);
        console.log(`[CollectiveCortex] 🧠 Initialized Joint Session ${id} for: ${objective}`);
        return session;
    }

    /**
     * Agents push their local state into the shared cortex.
     */
    async pushState(sessionId: string, agentId: string, state: any) {
        const session = await this.readSession(sessionId);
        if (!session) return;
        session.sharedState[agentId] = state;

        await this.writeSession(session);
        
        // If all participants have shared state, trigger optimization
        if (Object.keys(session.sharedState).length === session.participants.length) {
            await this.optimizeSession(sessionId);
        }
    }

    /**
     * Optimize the session using CognitiveEngine to generate joint directives.
     */
    private async optimizeSession(sessionId: string) {
        const session = await this.readSession(sessionId);
        if (!session) return;
        console.log(`[CollectiveCortex] ⚙️ Optimizing Joint Objective: ${session.objective}`);

        // 1. Prepare Joint Context
        const jointContext = {
            objective: session.objective,
            agentSectors: session.sectors,
            perAgentState: session.sharedState
        };

        // 2. synthesize optimized directives via CognitiveEngine
        // Note: New method synthesizeJointDirectives to be added to CognitiveEngine
        const directives = await (cognitiveEngine as any).synthesizeJointDirectives(jointContext);

        session.directives = directives;
        session.status = 'CONVERGED';

        await this.writeSession(session);
        console.log(`[CollectiveCortex] ✅ Session ${sessionId} CONVERGED. Directives issued.`);
    }

    /**
     * Get directives for a specific agent in a session.
     */
    async getDirective(sessionId: string, agentId: string): Promise<string | null> {
        const session = await this.readSession(sessionId);
        if (!session) return null;
        return session.directives[agentId] || null;
    }

    async listActiveSessions(): Promise<JointObjectiveSession[]> {
        const ids = (await redis.smembers(JOINT_SESSION_ACTIVE_INDEX)).map(String).sort();
        const sessions = await Promise.all(ids.map(id => this.readSession(id)));
        return sessions
            .filter((session): session is JointObjectiveSession => session !== null)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
}

export const collectiveCortex = new CollectiveCortex();
