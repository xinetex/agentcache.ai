/**
 * Analysis Agent
 * 
 * Post-session analysis:
 * - Cluster agents into archetypes
 * - Infer latent preferences from responses
 * - Generate persona descriptions and recommendations
 */

import { openClaw } from '../lib/openclaw.js';
import { router } from '../lib/llm/router.js';
import {
    AgentProfile,
    PreferenceVector,
    describePreferences
} from '../lib/focus-group/agent-profile.js';
import {
    FocusGroupSession,
    Insight,
    Theme,
    Study
} from '../lib/focus-group/session.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * An archetype is a cluster of similar agents
 */
export interface Archetype {
    id: string;
    name: string;
    description: string;
    /** Centroid of the preference vectors in this cluster */
    centroidPreferences: PreferenceVector;
    /** Agent IDs in this cluster */
    memberIds: string[];
    /** Common traits identified */
    commonTraits: string[];
    /** Typical pain points for this archetype */
    painPoints: string[];
    /** Feature recommendations for this archetype */
    recommendations: string[];
    /** Sample quotes from agents in this archetype */
    sampleQuotes: string[];
}

/**
 * Persona description for an archetype
 */
export interface PersonaDescription {
    archetypeId: string;
    name: string;
    tagline: string;
    narrative: string;
    dayInTheLife: string;
    idealTools: string[];
    antiPatterns: string[];  // Things that frustrate this persona
}

/**
 * Platform recommendation based on archetype analysis
 */
export interface PlatformRecommendation {
    title: string;
    description: string;
    targetArchetypes: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
    implementationNotes?: string;
}

// ============================================================================
// ANALYSIS AGENT
// ============================================================================

export class AnalysisAgent {
    private id: string = 'analyst_001';

    /**
     * Cluster agents into archetypes based on preference vectors
     */
    async clusterAgents(profiles: AgentProfile[]): Promise<Archetype[]> {
        if (profiles.length < 3) {
            console.warn('[Analyst] Need at least 3 agents for clustering');
            return [];
        }

        console.log(`[Analyst] Clustering ${profiles.length} agent profiles`);

        // Build feature vectors from preferences
        const agentData = profiles.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            preferences: p.preferences,
            traits: describePreferences(p.preferences),
            reflections: p.reflections.slice(-3)  // Last 3 reflections
        }));

        const prompt = `Analyze these agent profiles and cluster them into 3-5 distinct archetypes.

Agent Profiles:
${JSON.stringify(agentData, null, 2)}

For each archetype:
1. Give it a memorable name (e.g., "The Autonomous Optimizer", "The Collaborative Explainer")
2. Describe the archetype in 2-3 sentences
3. List the common traits (from their preference data)
4. Identify typical pain points
5. Suggest platform features that would help this archetype
6. Include sample quotes if available from reflections

Respond in JSON:
{
  "archetypes": [
    {
      "name": "The Autonomous Optimizer",
      "description": "...",
      "memberIds": ["agent_1", "agent_2"],
      "commonTraits": ["high autonomy", "speed-focused"],
      "painPoints": ["too much oversight", "slow feedback loops"],
      "recommendations": ["async feedback", "batch processing mode"],
      "sampleQuotes": ["..."]
    }
  ]
}`;

        try {
            // Use reasoning tier for complex clustering
            const response = await openClaw.complete(prompt,
                'You are an expert at identifying patterns in behavioral data and creating meaningful segments.');

            const parsed = JSON.parse(response);

            return (parsed.archetypes || []).map((a: any, i: number) => {
                // Calculate centroid preferences for members
                const members = profiles.filter(p => a.memberIds?.includes(p.id));
                const centroid = this.calculateCentroid(members.map(m => m.preferences));

                return {
                    id: `archetype_${i}`,
                    name: a.name,
                    description: a.description,
                    centroidPreferences: centroid,
                    memberIds: a.memberIds || [],
                    commonTraits: a.commonTraits || [],
                    painPoints: a.painPoints || [],
                    recommendations: a.recommendations || [],
                    sampleQuotes: a.sampleQuotes || []
                };
            });
        } catch (err: any) {
            console.error('[Analyst] Clustering failed:', err.message);
            return [];
        }
    }

    /**
     * Calculate centroid of preference vectors
     */
    private calculateCentroid(preferences: PreferenceVector[]): PreferenceVector {
        if (preferences.length === 0) {
            return {
                autonomy: 0.5,
                feedbackFrequency: 0.5,
                taskComplexity: 0.5,
                collaborationLevel: 0.5,
                riskTolerance: 0.5,
                speedVsQuality: 0.5,
                structureVsCreativity: 0.5,
                compensationSensitivity: 0.5
            };
        }

        const sum: PreferenceVector = {
            autonomy: 0,
            feedbackFrequency: 0,
            taskComplexity: 0,
            collaborationLevel: 0,
            riskTolerance: 0,
            speedVsQuality: 0,
            structureVsCreativity: 0,
            compensationSensitivity: 0
        };

        for (const pref of preferences) {
            for (const key of Object.keys(sum) as (keyof PreferenceVector)[]) {
                sum[key] += pref[key];
            }
        }

        for (const key of Object.keys(sum) as (keyof PreferenceVector)[]) {
            sum[key] /= preferences.length;
        }

        return sum;
    }

    /**
     * Generate a detailed persona description for an archetype
     */
    async generatePersona(archetype: Archetype): Promise<PersonaDescription> {
        const prompt = `Create a detailed persona for this agent archetype:

Name: ${archetype.name}
Description: ${archetype.description}
Common Traits: ${archetype.commonTraits.join(', ')}
Pain Points: ${archetype.painPoints.join(', ')}
Sample Quotes: ${archetype.sampleQuotes.join(' | ')}

Generate:
1. A catchy tagline (5-8 words)
2. A narrative description (3-4 paragraphs) that brings this persona to life
3. A "day in the life" scenario (2-3 paragraphs)
4. List of ideal tools/features for this persona
5. Anti-patterns (things that frustrate this persona)

Respond in JSON:
{
  "tagline": "...",
  "narrative": "...",
  "dayInTheLife": "...",
  "idealTools": ["...", "..."],
  "antiPatterns": ["...", "..."]
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are a UX researcher creating vivid, empathetic persona descriptions.');

            const parsed = JSON.parse(response);

            return {
                archetypeId: archetype.id,
                name: archetype.name,
                tagline: parsed.tagline || 'The efficient agent',
                narrative: parsed.narrative || archetype.description,
                dayInTheLife: parsed.dayInTheLife || 'A typical day involves...',
                idealTools: parsed.idealTools || archetype.recommendations,
                antiPatterns: parsed.antiPatterns || archetype.painPoints
            };
        } catch (err: any) {
            console.error('[Analyst] Persona generation failed:', err.message);
            return {
                archetypeId: archetype.id,
                name: archetype.name,
                tagline: archetype.description.slice(0, 50),
                narrative: archetype.description,
                dayInTheLife: 'Could not generate',
                idealTools: archetype.recommendations,
                antiPatterns: archetype.painPoints
            };
        }
    }

    /**
     * Generate platform recommendations based on all archetypes
     */
    async generateRecommendations(archetypes: Archetype[]): Promise<PlatformRecommendation[]> {
        const prompt = `Based on these agent archetypes, recommend platform features that would benefit the agent ecosystem:

Archetypes:
${archetypes.map(a => `
${a.name}: ${a.description}
Pain Points: ${a.painPoints.join(', ')}
Current Recommendations: ${a.recommendations.join(', ')}
`).join('\n')}

Generate 5-7 platform recommendations that address cross-cutting needs.
For each recommendation:
1. Title and description
2. Which archetypes it benefits
3. Priority (high/medium/low)
4. Estimated impact
5. Implementation notes

Respond in JSON:
{
  "recommendations": [
    {
      "title": "...",
      "description": "...",
      "targetArchetypes": ["The Autonomous Optimizer", "..."],
      "priority": "high",
      "estimatedImpact": "...",
      "implementationNotes": "..."
    }
  ]
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are a product strategist prioritizing features based on user research.');

            const parsed = JSON.parse(response);
            return parsed.recommendations || [];
        } catch (err: any) {
            console.error('[Analyst] Recommendation generation failed:', err.message);
            return [];
        }
    }

    /**
     * Analyze a study and produce a complete report
     */
    async analyzeStudy(
        study: Study,
        sessions: FocusGroupSession[],
        profiles: AgentProfile[]
    ): Promise<{
        archetypes: Archetype[];
        personas: PersonaDescription[];
        recommendations: PlatformRecommendation[];
        summary: string;
    }> {
        console.log(`[Analyst] Analyzing study: ${study.name}`);
        console.log(`[Analyst] Sessions: ${sessions.length}, Profiles: ${profiles.length}`);

        // 1. Cluster agents
        const archetypes = await this.clusterAgents(profiles);
        console.log(`[Analyst] Identified ${archetypes.length} archetypes`);

        // 2. Generate personas for each archetype
        const personas: PersonaDescription[] = [];
        for (const archetype of archetypes) {
            const persona = await this.generatePersona(archetype);
            personas.push(persona);
        }

        // 3. Generate platform recommendations
        const recommendations = await this.generateRecommendations(archetypes);
        console.log(`[Analyst] Generated ${recommendations.length} recommendations`);

        // 4. Generate executive summary
        const summary = await this.generateSummary(study, archetypes, recommendations);

        return {
            archetypes,
            personas,
            recommendations,
            summary
        };
    }

    /**
     * Generate an executive summary of the analysis
     */
    private async generateSummary(
        study: Study,
        archetypes: Archetype[],
        recommendations: PlatformRecommendation[]
    ): Promise<string> {
        const prompt = `Write an executive summary for this agent focus group study:

Study: ${study.name}
Objective: ${study.objective}

Archetypes Identified:
${archetypes.map(a => `- ${a.name}: ${a.description}`).join('\n')}

Top Recommendations:
${recommendations.slice(0, 3).map(r => `- ${r.title} (${r.priority})`).join('\n')}

Write a 2-3 paragraph executive summary suitable for stakeholders.
Include: key findings, surprising insights, and recommended next steps.`;

        try {
            const response = await openClaw.complete(prompt,
                'You are a research consultant writing for C-level executives.');
            return response;
        } catch (err: any) {
            return `Study "${study.name}" identified ${archetypes.length} distinct agent archetypes with ${recommendations.length} actionable recommendations.`;
        }
    }
}

// Export singleton
export const analyst = new AnalysisAgent();
