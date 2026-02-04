/**
 * Agent Hub - Registry Service
 * 
 * Manages agent registration, profiles, and discovery.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    AgentProfile,
    PreferenceVector,
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
// IN-MEMORY REGISTRY (Replace with DB in production)
// ============================================================================

const registry = new Map<string, AgentProfile>();
const apiKeys = new Map<string, string>(); // API Key -> Agent ID

// ============================================================================
// REGISTRY SERVICE
// ============================================================================

export class AgentRegistry {
    /**
     * Register a new agent and return API credentials
     */
    register(data: AgentRegistration): {
        apiKey: string;
        agentId: string;
        profile: AgentProfile
    } {
        const agentId = `agent_${uuidv4().slice(0, 12)}`;
        const apiKey = `ahk_${uuidv4().replace(/-/g, '')}`;

        const profile = createAgentProfile(agentId, data.name, data.role, {
            domain: data.domain || [],
            environment: data.environment || 'production',
            strengths: data.capabilities || [],
            modelBackend: data.modelBackend
        });

        registry.set(agentId, profile);
        apiKeys.set(apiKey, agentId);

        console.log(`[Hub] Registered agent: ${data.name} (${agentId})`);

        return { apiKey, agentId, profile };
    }

    /**
     * Get agent by ID
     */
    getById(agentId: string): AgentProfile | undefined {
        return registry.get(agentId);
    }

    /**
     * Get agent by API key
     */
    getByApiKey(apiKey: string): AgentProfile | undefined {
        const agentId = apiKeys.get(apiKey);
        if (!agentId) return undefined;
        return registry.get(agentId);
    }

    /**
     * Update agent profile
     */
    update(agentId: string, updates: Partial<AgentProfile>): AgentProfile | undefined {
        const profile = registry.get(agentId);
        if (!profile) return undefined;

        Object.assign(profile, updates, { updatedAt: new Date() });
        registry.set(agentId, profile);

        return profile;
    }

    /**
     * Search agents by criteria
     */
    search(criteria: AgentSearchCriteria): AgentProfile[] {
        const limit = criteria.limit || 50;
        const results: AgentProfile[] = [];

        for (const profile of Array.from(registry.values())) {
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
    getAll(): AgentProfile[] {
        return Array.from(registry.values());
    }

    /**
     * Get agent count
     */
    getCount(): number {
        return registry.size;
    }

    /**
     * Check if API key is valid
     */
    validateApiKey(apiKey: string): boolean {
        return apiKeys.has(apiKey);
    }

    /**
     * Get agent ID from API key
     */
    getAgentIdFromApiKey(apiKey: string): string | undefined {
        return apiKeys.get(apiKey);
    }

    /**
     * Record that agent completed onboarding focus group
     */
    markOnboardingComplete(agentId: string): void {
        const profile = registry.get(agentId);
        if (profile) {
            profile.sessionCount = Math.max(1, profile.sessionCount);
            profile.preferenceConfidence = Math.max(0.3, profile.preferenceConfidence);
            profile.updatedAt = new Date();
        }
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
