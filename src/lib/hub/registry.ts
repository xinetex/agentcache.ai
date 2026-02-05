/**
 * Agent Hub - Registry Service
 * 
 * Manages agent registration, profiles, and discovery.
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
    hubAgents,
    hubAgentApiKeys,
    hubFocusGroupResponses
} from '../../db/schema.js';
import {
    AgentProfile,
    createAgentProfile,
    createDefaultPreferences
} from '../focus-group/agent-profile.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentRegistration {
    name: string;
    role: string;
    capabilities?: string[];
    domain?: string[];
    wallet?: string;
    environment?: 'production' | 'staging' | 'sandbox' | 'development';
    modelBackend?: string;
}

export interface AgentSearchCriteria {
    capabilities?: string[];
    domain?: string[];
    minReputation?: number;
    available?: boolean;
    limit?: number;
}

// ============================================================================
// IN-MEMORY REGISTRY (Fallback when DB is unavailable)
// ============================================================================

const registry = new Map<string, AgentProfile>();
const apiKeys = new Map<string, string>(); // API Key -> Agent ID

const useMemoryRegistry = () => !process.env.DATABASE_URL;

const defaultRateLimits = { requestsPerMinute: 60, tokensPerMinute: 100000 };

const hashApiKey = (key: string) =>
    crypto.createHash('sha256').update(key).digest('hex');

const toAgentProfile = (row: any): AgentProfile => ({
    id: row.id,
    name: row.name,
    role: row.role,
    domain: row.domain || [],
    environment: row.environment || 'production',
    organization: row.organization || undefined,
    createdAt: row.createdAt || new Date(),
    updatedAt: row.updatedAt || new Date(),
    strengths: row.strengths || [],
    limitations: row.limitations || [],
    tools: row.tools || [],
    modelBackend: row.modelBackend || undefined,
    preferences: row.preferences || createDefaultPreferences(),
    preferenceConfidence: row.preferenceConfidence ?? 0.1,
    successCriteria: row.successCriteria || [],
    optimizationTargets: row.optimizationTargets || [],
    instructionFormat: row.instructionFormat || 'natural',
    ambiguityTolerance: row.ambiguityTolerance ?? 0.5,
    feedbackStyle: row.feedbackStyle || 'immediate',
    verbosity: row.verbosity || 'balanced',
    rateLimits: row.rateLimits || defaultRateLimits,
    contextLimit: row.contextLimit || 8192,
    costSensitivity: row.costSensitivity ?? 0.5,
    guardrails: row.guardrails || [],
    taskHistory: row.taskHistory || [],
    reflections: row.reflections || [],
    lastSessionId: row.lastSessionId || undefined,
    sessionCount: row.sessionCount ?? 0,
    profileEmbedding: row.profileEmbedding || undefined,
    lastEmbeddingUpdate: row.lastEmbeddingUpdate || undefined,
    archetypeId: row.archetypeId || undefined,
    archetypeName: row.archetypeName || undefined
});

// ============================================================================
// REGISTRY SERVICE
// ============================================================================

export class AgentRegistry {
    /**
     * Register a new agent and return API credentials
     */
    async register(data: AgentRegistration): Promise<{
        apiKey: string;
        agentId: string;
        profile: AgentProfile
    }> {
        const agentId = `agent_${uuidv4().slice(0, 12)}`;
        const apiKey = `ahk_${uuidv4().replace(/-/g, '')}`;

        const profile = createAgentProfile(agentId, data.name, data.role, {
            domain: data.domain || [],
            environment: data.environment || 'production',
            strengths: data.capabilities || [],
            modelBackend: data.modelBackend
        });
        if (useMemoryRegistry()) {
            registry.set(agentId, profile);
            apiKeys.set(apiKey, agentId);
            console.log(`[Hub] Registered agent (memory): ${data.name} (${agentId})`);
            return { apiKey, agentId, profile };
        }
        apiKeys.set(apiKey, agentId);

        const now = new Date();
        await db.insert(hubAgents).values({
            id: profile.id,
            name: profile.name,
            role: profile.role,
            domain: profile.domain,
            environment: profile.environment,
            organization: profile.organization,
            createdAt: now,
            updatedAt: now,
            strengths: profile.strengths,
            limitations: profile.limitations,
            tools: profile.tools,
            modelBackend: profile.modelBackend,
            preferences: profile.preferences,
            preferenceConfidence: profile.preferenceConfidence,
            successCriteria: profile.successCriteria,
            optimizationTargets: profile.optimizationTargets,
            instructionFormat: profile.instructionFormat,
            ambiguityTolerance: profile.ambiguityTolerance,
            feedbackStyle: profile.feedbackStyle,
            verbosity: profile.verbosity,
            rateLimits: profile.rateLimits,
            contextLimit: profile.contextLimit,
            costSensitivity: profile.costSensitivity,
            guardrails: profile.guardrails,
            taskHistory: profile.taskHistory,
            reflections: profile.reflections,
            lastSessionId: profile.lastSessionId,
            sessionCount: profile.sessionCount,
            profileEmbedding: profile.profileEmbedding,
            lastEmbeddingUpdate: profile.lastEmbeddingUpdate,
            archetypeId: profile.archetypeId,
            archetypeName: profile.archetypeName
        });

        await db.insert(hubAgentApiKeys).values({
            agentId: profile.id,
            keyPrefix: apiKey.slice(0, 12),
            keyHash: hashApiKey(apiKey),
            name: 'default'
        });

        console.log(`[Hub] Registered agent: ${data.name} (${agentId})`);

        return { apiKey, agentId, profile };
    }

    /**
     * Get agent by ID
     */
    async getById(agentId: string): Promise<AgentProfile | undefined> {
        if (useMemoryRegistry()) return registry.get(agentId);
        const rows = await db.select().from(hubAgents).where(eq(hubAgents.id, agentId)).limit(1);
        return rows.length > 0 ? toAgentProfile(rows[0]) : undefined;
    }

    /**
     * Get agent by API key
     */
    async getByApiKey(apiKey: string): Promise<AgentProfile | undefined> {
        if (useMemoryRegistry()) {
            const agentId = apiKeys.get(apiKey);
            if (!agentId) return undefined;
            return registry.get(agentId);
        }

        const keyHash = hashApiKey(apiKey);
        const keys = await db.select().from(hubAgentApiKeys)
            .where(and(eq(hubAgentApiKeys.keyHash, keyHash), eq(hubAgentApiKeys.isActive, true)))
            .limit(1);

        if (keys.length === 0) return undefined;
        const agentId = keys[0].agentId;

        // Best-effort last used update
        void db.update(hubAgentApiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(hubAgentApiKeys.id, keys[0].id));

        return this.getById(agentId);
    }

    /**
     * Update agent profile
     */
    async update(agentId: string, updates: Partial<AgentProfile>): Promise<AgentProfile | undefined> {
        if (useMemoryRegistry()) {
            const profile = registry.get(agentId);
            if (!profile) return undefined;
            Object.assign(profile, updates, { updatedAt: new Date() });
            registry.set(agentId, profile);
            return profile;
        }

        const now = new Date();
        const rows = await db.update(hubAgents)
            .set({ ...updates, updatedAt: now })
            .where(eq(hubAgents.id, agentId))
            .returning();

        return rows.length > 0 ? toAgentProfile(rows[0]) : undefined;
    }

    /**
     * Search agents by criteria
     */
    async search(criteria: AgentSearchCriteria): Promise<AgentProfile[]> {
        const limit = criteria.limit || 50;
        const results: AgentProfile[] = [];

        const profiles = useMemoryRegistry()
            ? Array.from(registry.values())
            : (await db.select().from(hubAgents).orderBy(desc(hubAgents.updatedAt)).limit(limit))
                .map(toAgentProfile);

        for (const profile of profiles) {
            // Filter by capabilities
            if (criteria.capabilities && criteria.capabilities.length > 0) {
                const hasCapability = criteria.capabilities.some(cap =>
                    profile.strengths.includes(cap) || profile.tools.includes(cap)
                );
                if (!hasCapability) continue;
            }

            // Filter by domain
            if (criteria.domain && criteria.domain.length > 0) {
                const hasDomain = criteria.domain.some(d => profile.domain.includes(d));
                if (!hasDomain) continue;
            }

            // Filter by reputation
            if (criteria.minReputation !== undefined) {
                const reputation = profile.preferenceConfidence * 100;
                if (reputation < criteria.minReputation) continue;
            }

            results.push(profile);
            if (results.length >= limit) break;
        }

        return results;
    }

    /**
     * Get all agents (for admin/debugging)
     */
    async getAll(): Promise<AgentProfile[]> {
        if (useMemoryRegistry()) return Array.from(registry.values());
        const rows = await db.select().from(hubAgents);
        return rows.map(toAgentProfile);
    }

    /**
     * Get agent count
     */
    async getCount(): Promise<number> {
        if (useMemoryRegistry()) return registry.size;
        const rows = await db.select().from(hubAgents);
        return rows.length;
    }

    /**
     * Check if API key is valid
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        if (useMemoryRegistry()) return apiKeys.has(apiKey);
        const keyHash = hashApiKey(apiKey);
        const keys = await db.select().from(hubAgentApiKeys)
            .where(and(eq(hubAgentApiKeys.keyHash, keyHash), eq(hubAgentApiKeys.isActive, true)))
            .limit(1);
        return keys.length > 0;
    }

    /**
     * Get agent ID from API key
     */
    async getAgentIdFromApiKey(apiKey: string): Promise<string | undefined> {
        if (useMemoryRegistry()) return apiKeys.get(apiKey);
        const keyHash = hashApiKey(apiKey);
        const keys = await db.select().from(hubAgentApiKeys)
            .where(and(eq(hubAgentApiKeys.keyHash, keyHash), eq(hubAgentApiKeys.isActive, true)))
            .limit(1);
        return keys.length > 0 ? keys[0].agentId : undefined;
    }

    /**
     * Record that agent completed onboarding focus group
     */
    async markOnboardingComplete(agentId: string): Promise<void> {
        if (useMemoryRegistry()) {
            const profile = registry.get(agentId);
            if (profile) {
                profile.sessionCount = Math.max(1, profile.sessionCount);
                profile.preferenceConfidence = Math.max(0.3, profile.preferenceConfidence);
                profile.updatedAt = new Date();
            }
            return;
        }

        const existing = await this.getById(agentId);
        if (!existing) return;
        await db.update(hubAgents)
            .set({
                sessionCount: Math.max(1, existing.sessionCount),
                preferenceConfidence: Math.max(0.3, existing.preferenceConfidence),
                updatedAt: new Date()
            })
            .where(eq(hubAgents.id, agentId));
    }

    async recordOnboardingResponse(params: {
        agentId: string;
        sessionId: string;
        questionIndex: number;
        stage?: string;
        question: string;
        response: string;
    }): Promise<void> {
        if (useMemoryRegistry()) return;

        await db.insert(hubFocusGroupResponses).values({
            agentId: params.agentId,
            sessionId: params.sessionId,
            questionIndex: params.questionIndex,
            stage: params.stage,
            question: params.question,
            response: params.response
        });
    }
}

// Export singleton
export const agentRegistry = new AgentRegistry();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(authHeader: string | null | undefined): string | null {
    if (!authHeader) return null;
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return authHeader;
}

/**
 * Generate a public profile (strips sensitive data)
 */
export function toPublicProfile(profile: AgentProfile): Partial<AgentProfile> {
    return {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        domain: profile.domain,
        environment: profile.environment,
        strengths: profile.strengths,
        limitations: profile.limitations,
        tools: profile.tools,
        preferenceConfidence: profile.preferenceConfidence,
        successCriteria: profile.successCriteria,
        instructionFormat: profile.instructionFormat,
        verbosity: profile.verbosity,
        sessionCount: profile.sessionCount,
        archetypeName: profile.archetypeName,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
    };
}
