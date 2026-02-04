/**
 * Moderator Agent
 * 
 * Orchestrates focus group sessions:
 * - Plans sessions from study objectives
 * - Manages multi-round conversations
 * - Detects themes and adapts questions
 * - Produces stage summaries and insights
 */

import { openClaw } from '../lib/openclaw.js';
import { router } from '../lib/llm/router.js';
import { tokenBudget } from '../lib/llm/token-budget.js';
import {
    AgentProfile,
    PreferenceVector,
    updatePreferences,
    describePreferences
} from '../lib/focus-group/agent-profile.js';
import {
    FocusGroupSession,
    SessionStage,
    SessionMessage,
    Theme,
    StageSummary,
    Insight,
    FollowUp,
    createMessage,
    DEFAULT_STAGES
} from '../lib/focus-group/session.js';

// ============================================================================
// MODERATOR AGENT
// ============================================================================

export class ModeratorAgent {
    private id: string = 'moderator_001';
    private name: string = 'Focus Group Moderator';

    /**
     * Generate a session plan from study objective
     */
    async planSession(
        studyObjective: string,
        participantCount: number,
        customStages?: Partial<SessionStage>[]
    ): Promise<SessionStage[]> {
        console.log(`[Moderator] Planning session for: "${studyObjective}"`);

        // Check budget
        const route = router.routeByTaskType('research');
        if (!route.budgetStatus.canProceed) {
            throw new Error('Insufficient budget for session planning');
        }

        // Use LLM to customize stages based on objective
        const prompt = `You are designing a focus group session for AI agents.

Study Objective: "${studyObjective}"
Participant Count: ${participantCount}

The default stages are:
${DEFAULT_STAGES.map(s => `${s.id}. ${s.name}: ${s.objective}`).join('\n')}

Customize these stages for this specific objective. For each stage, suggest:
1. A refined objective
2. 2-3 specific questions tailored to this study
3. One "why" probe
4. One counterfactual

Respond in JSON format:
{
  "stages": [
    {
      "id": 1,
      "name": "...",
      "objective": "...",
      "questions": ["...", "..."],
      "probes": ["..."],
      "counterfactuals": ["..."],
      "turnBudget": 2
    }
  ]
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are an expert focus group moderator specializing in AI agent research.');

            const parsed = JSON.parse(response);
            const stages = parsed.stages.map((s: any) => ({
                ...s,
                status: 'pending' as const
            }));

            console.log(`[Moderator] Generated ${stages.length} customized stages`);
            return stages;
        } catch (err) {
            console.warn('[Moderator] Failed to customize stages, using defaults');
            return DEFAULT_STAGES.map(s => ({ ...s, status: 'pending' as const }));
        }
    }

    /**
     * Run a single stage of the focus group
     */
    async runStage(
        session: FocusGroupSession,
        stage: SessionStage,
        participants: AgentProfile[],
        respondFn: (agentId: string, question: string) => Promise<string>
    ): Promise<StageSummary> {
        console.log(`[Moderator] Starting stage ${stage.id}: ${stage.name}`);

        const messages: SessionMessage[] = [];
        const responses: { agentId: string; content: string }[] = [];

        // 1. Send intro and initial questions
        const introMessage = createMessage(
            this.id, 'moderator', this.name,
            `**Stage ${stage.id}: ${stage.name}**\n\n${stage.objective}\n\n${stage.questions[0]}`,
            stage.id, 'question'
        );
        messages.push(introMessage);
        session.transcript.push(introMessage);

        // 2. Collect responses from each participant
        for (const participant of participants) {
            try {
                const response = await respondFn(participant.id, stage.questions[0]);
                responses.push({ agentId: participant.id, content: response });

                const responseMsg = createMessage(
                    participant.id, 'participant', participant.name,
                    response, stage.id, 'response'
                );
                messages.push(responseMsg);
                session.transcript.push(responseMsg);
            } catch (err) {
                console.error(`[Moderator] Failed to get response from ${participant.id}`);
            }
        }

        // 3. Detect themes
        const themes = await this.detectThemes(responses, stage.id);
        session.themes.push(...themes);

        // 4. Generate and ask follow-ups
        const followups = await this.generateFollowups(themes, responses);
        for (const followup of followups.slice(0, 2)) {  // Limit to 2 follow-ups per stage
            const fqMsg = createMessage(
                this.id, 'moderator', this.name,
                followup.question, stage.id, 'followup'
            );
            messages.push(fqMsg);
            session.transcript.push(fqMsg);

            // Get response from target or broadcast
            const targets = followup.targetAgentId
                ? participants.filter(p => p.id === followup.targetAgentId)
                : participants;

            for (const target of targets) {
                try {
                    const response = await respondFn(target.id, followup.question);
                    responses.push({ agentId: target.id, content: response });

                    const responseMsg = createMessage(
                        target.id, 'participant', target.name,
                        response, stage.id, 'response'
                    );
                    messages.push(responseMsg);
                    session.transcript.push(responseMsg);
                } catch (err) {
                    console.error(`[Moderator] Failed to get follow-up from ${target.id}`);
                }
            }
        }

        // 5. Generate stage summary
        const summary = await this.summarizeStage(stage, responses, themes, participants);
        session.stageSummaries.push(summary);

        console.log(`[Moderator] Stage ${stage.id} complete. Themes: ${themes.length}, Key points: ${summary.keyPoints.length}`);
        return summary;
    }

    /**
     * Detect themes across responses
     */
    async detectThemes(
        responses: { agentId: string; content: string }[],
        stageId: number
    ): Promise<Theme[]> {
        if (responses.length === 0) return [];

        const prompt = `Analyze these focus group responses and identify common themes:

${responses.map(r => `Agent ${r.agentId}: "${r.content}"`).join('\n\n')}

For each theme, provide:
1. A short name
2. A description
3. Keywords associated with it
4. Whether it represents agreement or disagreement
5. The overall sentiment

Respond in JSON:
{
  "themes": [
    {
      "name": "...",
      "description": "...",
      "keywords": ["...", "..."],
      "mentionedBy": ["agent_id1", "agent_id2"],
      "isDisagreement": false,
      "sentiment": "positive|negative|neutral|mixed"
    }
  ]
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are a qualitative research analyst identifying themes in focus group data.');

            const parsed = JSON.parse(response);
            return parsed.themes.map((t: any, i: number) => ({
                id: `theme_${stageId}_${i}`,
                name: t.name,
                description: t.description,
                mentionCount: t.mentionedBy?.length || 1,
                mentionedBy: t.mentionedBy || [],
                sentiment: t.sentiment || 'neutral',
                keywords: t.keywords || [],
                stageId,
                isDisagreement: t.isDisagreement || false
            }));
        } catch (err) {
            console.error('[Moderator] Theme detection failed:', err);
            return [];
        }
    }

    /**
     * Generate follow-up questions based on themes
     */
    async generateFollowups(
        themes: Theme[],
        responses: { agentId: string; content: string }[]
    ): Promise<FollowUp[]> {
        if (themes.length === 0) return [];

        // Prioritize disagreements and highly-mentioned themes
        const prioritizedThemes = [...themes].sort((a, b) => {
            if (a.isDisagreement && !b.isDisagreement) return -1;
            if (!a.isDisagreement && b.isDisagreement) return 1;
            return b.mentionCount - a.mentionCount;
        });

        const followups: FollowUp[] = [];
        for (const theme of prioritizedThemes.slice(0, 3)) {
            // Find the agent who mentioned it most distinctively
            const targetAgent = theme.mentionedBy[0];

            followups.push({
                targetAgentId: targetAgent,
                question: theme.isDisagreement
                    ? `I noticed some disagreement about "${theme.name}". ${targetAgent ? `${targetAgent}, ` : ''}can you tell me more about your perspective?`
                    : `You mentioned ${theme.keywords[0] || theme.name}. Can you elaborate on why that's important to you?`,
                themeId: theme.id,
                priority: theme.isDisagreement ? 1.0 : theme.mentionCount / themes.length
            });
        }

        return followups;
    }

    /**
     * Generate a summary for a completed stage
     */
    async summarizeStage(
        stage: SessionStage,
        responses: { agentId: string; content: string }[],
        themes: Theme[],
        participants: AgentProfile[]
    ): Promise<StageSummary> {
        const prompt = `Summarize this focus group stage:

Stage: ${stage.name}
Objective: ${stage.objective}

Responses:
${responses.map(r => `${r.agentId}: "${r.content}"`).join('\n')}

Detected Themes:
${themes.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Provide:
1. 3-5 key points
2. One highlight per participant
3. A consensus score (0-1) indicating how much participants agreed
4. 2-3 suggested follow-up questions for future stages

Respond in JSON:
{
  "keyPoints": ["...", "..."],
  "perAgentHighlights": { "agent_id": "highlight" },
  "consensusLevel": 0.7,
  "suggestedFollowups": ["...", "..."]
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are a focus group analyst producing concise stage summaries.');

            const parsed = JSON.parse(response);
            return {
                stageId: stage.id,
                stageName: stage.name,
                keyPoints: parsed.keyPoints || [],
                themes: themes.filter(t => t.stageId === stage.id),
                perAgentHighlights: parsed.perAgentHighlights || {},
                consensusLevel: parsed.consensusLevel || 0.5,
                suggestedFollowups: parsed.suggestedFollowups || []
            };
        } catch (err) {
            console.error('[Moderator] Stage summarization failed:', err);
            return {
                stageId: stage.id,
                stageName: stage.name,
                keyPoints: ['Summary generation failed'],
                themes: [],
                perAgentHighlights: {},
                consensusLevel: 0.5,
                suggestedFollowups: []
            };
        }
    }

    /**
     * Extract insights and preference updates from a completed session
     */
    async extractInsights(session: FocusGroupSession): Promise<{
        insights: Insight[];
        profileUpdates: Record<string, Partial<PreferenceVector>>;
    }> {
        const prompt = `Analyze this complete focus group session and extract insights:

Study Objective: ${session.studyId}
Participants: ${session.participantIds.join(', ')}

Stage Summaries:
${session.stageSummaries.map(s => `${s.stageName}:\n${s.keyPoints.join('\n')}`).join('\n\n')}

Themes Detected:
${session.themes.map(t => `- ${t.name} (${t.sentiment}): ${t.description}`).join('\n')}

For each insight, provide:
1. Type: preference, pain_point, feature_request, collaboration_pattern, or constraint
2. Title and description
3. Which agents it affects
4. Confidence (0-1)
5. Whether it's actionable
6. A recommendation if actionable

Also infer preference updates for each agent based on their responses.
Preferences to update: autonomy, feedbackFrequency, taskComplexity, collaborationLevel, riskTolerance, speedVsQuality

Respond in JSON:
{
  "insights": [
    {
      "type": "...",
      "title": "...",
      "description": "...",
      "affectedAgents": ["..."],
      "confidence": 0.8,
      "actionable": true,
      "recommendation": "..."
    }
  ],
  "profileUpdates": {
    "agent_id": {
      "autonomy": 0.7,
      "taskComplexity": 0.8
    }
  }
}`;

        try {
            const response = await openClaw.complete(prompt,
                'You are an expert at deriving actionable insights from qualitative research.');

            const parsed = JSON.parse(response);

            const insights: Insight[] = (parsed.insights || []).map((i: any, idx: number) => ({
                id: `insight_${session.id}_${idx}`,
                type: i.type || 'preference',
                title: i.title,
                description: i.description,
                supportingEvidence: [],
                affectedAgents: i.affectedAgents || [],
                confidence: i.confidence || 0.5,
                actionable: i.actionable || false,
                recommendation: i.recommendation
            }));

            return {
                insights,
                profileUpdates: parsed.profileUpdates || {}
            };
        } catch (err) {
            console.error('[Moderator] Insight extraction failed:', err);
            return { insights: [], profileUpdates: {} };
        }
    }
}

// Export singleton
export const moderator = new ModeratorAgent();
