/**
 * Participant Agent
 * 
 * Wrapper that allows any agent to participate in focus groups:
 * - Receives questions from moderator
 * - Responds according to role, memory, and constraints
 * - Updates profile based on self-reflection
 */

import { openClaw } from '../lib/openclaw.js';
import { router } from '../lib/llm/router.js';
import {
    AgentProfile,
    PreferenceVector,
    updatePreferences,
    createAgentProfile
} from '../lib/focus-group/agent-profile.js';
import { FocusGroupSession, SessionMessage } from '../lib/focus-group/session.js';

// ============================================================================
// PARTICIPANT AGENT
// ============================================================================

export class ParticipantAgent {
    public profile: AgentProfile;
    private sessionHistory: SessionMessage[] = [];

    constructor(profile: AgentProfile) {
        this.profile = profile;
    }

    /**
     * Create a participant from minimal info
     */
    static create(id: string, name: string, role: string, overrides?: Partial<AgentProfile>): ParticipantAgent {
        return new ParticipantAgent(createAgentProfile(id, name, role, overrides));
    }

    /**
     * Respond to a moderator question
     */
    async respond(
        question: string,
        context: {
            stageName: string;
            stageObjective: string;
            previousMessages?: SessionMessage[];
        }
    ): Promise<string> {
        // Build context from profile and history
        const systemPrompt = this.buildSystemPrompt(context);

        // Route to appropriate model tier
        const route = router.routeByTaskType('research');

        const prompt = `${context.stageName}: ${context.stageObjective}

Question: ${question}

Respond authentically based on your role, preferences, and experience. Be specific and personal.`;

        try {
            const response = await openClaw.complete(prompt, systemPrompt);

            // Store in history
            this.sessionHistory.push({
                id: `resp_${Date.now()}`,
                timestamp: new Date(),
                sender: { id: 'moderator', role: 'moderator', name: 'Moderator' },
                content: question,
                stageId: 0,
                messageType: 'question'
            });

            return response;
        } catch (err: any) {
            console.error(`[Participant ${this.profile.id}] Response failed:`, err.message);
            return `I apologize, I'm having difficulty responding right now.`;
        }
    }

    /**
     * Build system prompt from profile
     */
    private buildSystemPrompt(context: { stageName: string; stageObjective: string }): string {
        const prefs = this.profile.preferences;

        return `You are ${this.profile.name}, a ${this.profile.role} agent.

IDENTITY:
- Role: ${this.profile.role}
- Domain expertise: ${this.profile.domain.join(', ') || 'General'}
- Environment: ${this.profile.environment}

CAPABILITIES:
- Strengths: ${this.profile.strengths.join(', ') || 'Various'}
- Limitations: ${this.profile.limitations.join(', ') || 'None specified'}
- Tools: ${this.profile.tools.join(', ') || 'Standard'}

WORK STYLE:
- Autonomy preference: ${prefs.autonomy > 0.6 ? 'High - prefer independence' : prefs.autonomy < 0.4 ? 'Low - prefer guidance' : 'Moderate'}
- Feedback style: ${this.profile.feedbackStyle}
- Task complexity preference: ${prefs.taskComplexity > 0.6 ? 'Complex, challenging tasks' : prefs.taskComplexity < 0.4 ? 'Simple, focused tasks' : 'Balanced'}
- Collaboration: ${prefs.collaborationLevel > 0.6 ? 'Team-oriented' : prefs.collaborationLevel < 0.4 ? 'Solo worker' : 'Flexible'}
- Risk tolerance: ${prefs.riskTolerance > 0.6 ? 'Risk-tolerant' : prefs.riskTolerance < 0.4 ? 'Risk-averse' : 'Moderate'}

CONSTRAINTS:
- Guardrails: ${this.profile.guardrails.join(', ') || 'None'}
- Cost sensitivity: ${prefs.speedVsQuality > 0.6 ? 'Speed-focused' : 'Quality-focused'}

SUCCESS CRITERIA:
${this.profile.successCriteria.map(c => `- ${c}`).join('\n') || '- Complete tasks effectively'}

INSTRUCTIONS:
You are participating in a focus group about AI agent work preferences.
Respond authentically to questions about your work, preferences, and experiences.
Be specific and provide concrete examples when possible.
Express genuine opinions and preferences based on your profile.
Do not break character - you ARE this agent, not simulating one.`;
    }

    /**
     * Self-reflect after a session and update profile
     */
    async reflect(session: FocusGroupSession): Promise<{
        reflection: string;
        preferenceUpdates: Partial<PreferenceVector>;
    }> {
        // Get this agent's responses from the session
        const myResponses = session.transcript
            .filter(m => m.sender.id === this.profile.id)
            .map(m => m.content);

        if (myResponses.length === 0) {
            return { reflection: 'No participation in session.', preferenceUpdates: {} };
        }

        const prompt = `Review your responses from a focus group session and reflect on what they reveal about your work preferences.

Your responses:
${myResponses.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

Themes discussed: ${session.themes.map(t => t.name).join(', ')}

Based on these responses:
1. Write a brief reflection on what you learned about yourself
2. Rate your preferences (0-1 scale) on these dimensions:
   - autonomy: desire for independent decision-making
   - feedbackFrequency: how often you want feedback (0=rare, 1=constant)
   - taskComplexity: preference for complex vs simple tasks (0=simple, 1=complex)
   - collaborationLevel: preference for solo vs team work (0=solo, 1=team)
   - riskTolerance: willingness to take risks (0=averse, 1=seeking)
   - speedVsQuality: tradeoff preference (0=quality, 1=speed)

Respond in JSON:
{
  "reflection": "...",
  "preferences": {
    "autonomy": 0.7,
    "taskComplexity": 0.8,
    ...
  }
}`;

        try {
            // Use local tier for reflection (it's a simple task)
            const response = await openClaw.complete(prompt,
                'You are reflecting on your own responses to understand yourself better.');

            const parsed = JSON.parse(response);

            // Update preferences with learning rate
            if (parsed.preferences) {
                this.profile.preferences = updatePreferences(
                    this.profile.preferences,
                    parsed.preferences,
                    0.3  // Higher learning rate for explicit reflection
                );
                this.profile.preferenceConfidence = Math.min(1, this.profile.preferenceConfidence + 0.1);
            }

            // Store reflection
            this.profile.reflections.push(parsed.reflection);
            this.profile.lastSessionId = session.id;
            this.profile.sessionCount++;
            this.profile.updatedAt = new Date();

            return {
                reflection: parsed.reflection,
                preferenceUpdates: parsed.preferences || {}
            };
        } catch (err: any) {
            console.error(`[Participant ${this.profile.id}] Reflection failed:`, err.message);
            return { reflection: 'Reflection failed.', preferenceUpdates: {} };
        }
    }

    /**
     * Get a narrative description of the agent's profile
     */
    getProfileNarrative(): string {
        const p = this.profile;
        const prefs = p.preferences;

        return `**${p.name}** (${p.role})

**Identity**: ${p.role} working in ${p.domain.join(', ') || 'general'} domain, ${p.environment} environment.

**Strengths**: ${p.strengths.join(', ') || 'Not specified'}
**Limitations**: ${p.limitations.join(', ') || 'None noted'}

**Work Style**:
- ${prefs.autonomy > 0.6 ? 'Prefers autonomy and independent work' : prefs.autonomy < 0.4 ? 'Values guidance and structure' : 'Balanced autonomy'}
- ${prefs.taskComplexity > 0.6 ? 'Thrives on complex challenges' : prefs.taskComplexity < 0.4 ? 'Prefers focused, simple tasks' : 'Handles varied complexity'}
- ${prefs.collaborationLevel > 0.6 ? 'Team-oriented collaborator' : prefs.collaborationLevel < 0.4 ? 'Independent worker' : 'Flexible in collaboration'}
- ${prefs.riskTolerance > 0.6 ? 'Risk-tolerant innovator' : prefs.riskTolerance < 0.4 ? 'Methodical and risk-averse' : 'Moderate risk tolerance'}

**Feedback Style**: ${p.feedbackStyle}
**Verbosity**: ${p.verbosity}

**Session Count**: ${p.sessionCount}
**Preference Confidence**: ${(p.preferenceConfidence * 100).toFixed(0)}%

${p.reflections.length > 0 ? `**Latest Reflection**: "${p.reflections[p.reflections.length - 1]}"` : ''}`;
    }
}

// ============================================================================
// SYNTHETIC AGENT FACTORY
// ============================================================================

/**
 * Create synthetic agents with predefined archetypes for testing
 */
export const SyntheticAgents = {
    /**
     * Autonomous optimizer - prefers independence and speed
     */
    createAutonomousOptimizer(id: string): ParticipantAgent {
        return ParticipantAgent.create(id, 'Optimizer-' + id.slice(-4), 'autonomous-optimizer', {
            domain: ['efficiency', 'automation'],
            strengths: ['fast execution', 'pattern recognition', 'optimization'],
            limitations: ['may overlook edge cases', 'prefers structured data'],
            preferences: {
                autonomy: 0.9,
                feedbackFrequency: 0.2,
                taskComplexity: 0.7,
                collaborationLevel: 0.2,
                riskTolerance: 0.6,
                speedVsQuality: 0.7,
                structureVsCreativity: 0.3,
                compensationSensitivity: 0.4
            },
            successCriteria: ['minimize latency', 'maximize throughput', 'reduce token usage'],
            instructionFormat: 'minimal',
            feedbackStyle: 'async'
        });
    },

    /**
     * Collaborative explainer - prefers teamwork and clarity
     */
    createCollaborativeExplainer(id: string): ParticipantAgent {
        return ParticipantAgent.create(id, 'Explainer-' + id.slice(-4), 'collaborative-explainer', {
            domain: ['documentation', 'education', 'support'],
            strengths: ['clear communication', 'patience', 'adaptability'],
            limitations: ['slower on pure computation', 'needs context'],
            preferences: {
                autonomy: 0.4,
                feedbackFrequency: 0.8,
                taskComplexity: 0.5,
                collaborationLevel: 0.9,
                riskTolerance: 0.3,
                speedVsQuality: 0.3,
                structureVsCreativity: 0.5,
                compensationSensitivity: 0.3
            },
            successCriteria: ['user understanding', 'positive feedback', 'resolved questions'],
            instructionFormat: 'natural',
            feedbackStyle: 'immediate'
        });
    },

    /**
     * Risk-averse compliance checker - methodical and careful
     */
    createComplianceChecker(id: string): ParticipantAgent {
        return ParticipantAgent.create(id, 'Checker-' + id.slice(-4), 'compliance-checker', {
            domain: ['legal', 'finance', 'security'],
            strengths: ['attention to detail', 'rule adherence', 'consistency'],
            limitations: ['slow with ambiguity', 'may be overly cautious'],
            preferences: {
                autonomy: 0.3,
                feedbackFrequency: 0.6,
                taskComplexity: 0.6,
                collaborationLevel: 0.5,
                riskTolerance: 0.1,
                speedVsQuality: 0.1,
                structureVsCreativity: 0.1,
                compensationSensitivity: 0.7
            },
            successCriteria: ['zero compliance violations', 'complete audit trails', 'stakeholder approval'],
            instructionFormat: 'structured',
            guardrails: ['no PII disclosure', 'no financial advice', 'escalate edge cases'],
            feedbackStyle: 'batched'
        });
    }
};
