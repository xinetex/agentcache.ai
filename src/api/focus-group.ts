/**
 * Focus Group API
 * 
 * RESTful interface for the Agent Focus Group Protocol.
 * Allows creation of studies, registration of agents, session management,
 * and retrieval of insights and archetypes.
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { moderator } from '../agents/ModeratorAgent.js';
import { ParticipantAgent, SyntheticAgents } from '../agents/ParticipantAgent.js';
import { analyst, Archetype, PersonaDescription } from '../agents/AnalysisAgent.js';
import {
    AgentProfile,
    createAgentProfile,
    PreferenceVector
} from '../lib/focus-group/agent-profile.js';
import {
    Study,
    FocusGroupSession,
    createStudy,
    createSession,
    DEFAULT_STAGES
} from '../lib/focus-group/session.js';
import { tokenBudget } from '../lib/llm/token-budget.js';

const focusGroupRouter = new Hono();

// ============================================================================
// IN-MEMORY STORAGE (Replace with DB in production)
// ============================================================================

const studies = new Map<string, Study>();
const sessions = new Map<string, FocusGroupSession>();
const agents = new Map<string, AgentProfile>();
const archetypes = new Map<string, Archetype>();

// ============================================================================
// STUDIES
// ============================================================================

/**
 * POST /api/focus-group/studies
 * Create a new study
 */
focusGroupRouter.post('/studies', async (c) => {
    const body = await c.req.json();
    const id = uuidv4();

    const study = createStudy(
        id,
        body.name || 'Untitled Study',
        body.objective || 'Understand agent work preferences',
        body.ownerId || 'anonymous',
        {
            description: body.description,
            maxSessions: body.maxSessions,
            budgetUsd: body.budgetUsd,
            targetDomains: body.targetDomains,
            targetRoles: body.targetRoles,
            minParticipants: body.minParticipants,
            maxParticipants: body.maxParticipants
        }
    );

    studies.set(id, study);
    console.log(`[FocusGroup] Created study: ${study.name} (${id})`);

    return c.json({ success: true, study });
});

/**
 * GET /api/focus-group/studies/:id
 * Get study details
 */
focusGroupRouter.get('/studies/:id', async (c) => {
    const study = studies.get(c.req.param('id'));
    if (!study) {
        return c.json({ error: 'Study not found' }, 404);
    }
    return c.json({ study });
});

/**
 * GET /api/focus-group/studies/:id/archetypes
 * Get archetypes discovered in this study
 */
focusGroupRouter.get('/studies/:id/archetypes', async (c) => {
    const study = studies.get(c.req.param('id'));
    if (!study) {
        return c.json({ error: 'Study not found' }, 404);
    }

    const studyArchetypes = study.archetypeIds
        .map(id => archetypes.get(id))
        .filter(Boolean);

    return c.json({ archetypes: studyArchetypes });
});

// ============================================================================
// AGENTS
// ============================================================================

/**
 * POST /api/focus-group/agents
 * Register an agent for focus group participation
 */
focusGroupRouter.post('/agents', async (c) => {
    const body = await c.req.json();
    const id = body.id || uuidv4();

    const profile = createAgentProfile(
        id,
        body.name || `Agent-${id.slice(-4)}`,
        body.role || 'general',
        {
            domain: body.domain,
            environment: body.environment,
            strengths: body.strengths,
            limitations: body.limitations,
            tools: body.tools,
            preferences: body.preferences,
            successCriteria: body.successCriteria,
            instructionFormat: body.instructionFormat,
            feedbackStyle: body.feedbackStyle,
            guardrails: body.guardrails
        }
    );

    agents.set(id, profile);
    console.log(`[FocusGroup] Registered agent: ${profile.name} (${id})`);

    return c.json({ success: true, agent: profile });
});

/**
 * GET /api/focus-group/agents/:id
 * Get agent profile
 */
focusGroupRouter.get('/agents/:id', async (c) => {
    const profile = agents.get(c.req.param('id'));
    if (!profile) {
        return c.json({ error: 'Agent not found' }, 404);
    }
    return c.json({ agent: profile });
});

/**
 * GET /api/focus-group/agents/:id/profile
 * Get agent's preference vector with narrative description
 */
focusGroupRouter.get('/agents/:id/profile', async (c) => {
    const profile = agents.get(c.req.param('id'));
    if (!profile) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const participant = new ParticipantAgent(profile);
    const narrative = participant.getProfileNarrative();

    return c.json({
        agent: profile,
        preferences: profile.preferences,
        preferenceConfidence: profile.preferenceConfidence,
        narrative
    });
});

/**
 * POST /api/focus-group/agents/synthetic
 * Create synthetic agents for testing
 */
focusGroupRouter.post('/agents/synthetic', async (c) => {
    const body = await c.req.json();
    const count = body.count || 3;
    const types = body.types || ['optimizer', 'explainer', 'checker'];

    const created: AgentProfile[] = [];
    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const id = uuidv4();
        let participant: ParticipantAgent;

        switch (type) {
            case 'optimizer':
                participant = SyntheticAgents.createAutonomousOptimizer(id);
                break;
            case 'explainer':
                participant = SyntheticAgents.createCollaborativeExplainer(id);
                break;
            case 'checker':
                participant = SyntheticAgents.createComplianceChecker(id);
                break;
            default:
                participant = SyntheticAgents.createAutonomousOptimizer(id);
        }

        agents.set(id, participant.profile);
        created.push(participant.profile);
    }

    console.log(`[FocusGroup] Created ${created.length} synthetic agents`);
    return c.json({ success: true, agents: created });
});

// ============================================================================
// SESSIONS
// ============================================================================

/**
 * POST /api/focus-group/sessions
 * Start a new focus group session
 */
focusGroupRouter.post('/sessions', async (c) => {
    const body = await c.req.json();
    const studyId = body.studyId;
    const participantIds = body.participantIds || [];

    // Validate study
    const study = studies.get(studyId);
    if (!study) {
        return c.json({ error: 'Study not found' }, 404);
    }

    // Validate participants
    if (participantIds.length < study.minParticipants) {
        return c.json({
            error: `Need at least ${study.minParticipants} participants`
        }, 400);
    }

    // Check budget
    const budgetStatus = tokenBudget.getStatus();
    if (budgetStatus.isBlocked) {
        return c.json({
            error: 'Budget exhausted. Cannot start new session.',
            budget: budgetStatus
        }, 503);
    }

    // Create session
    const sessionId = uuidv4();
    const session = createSession(
        sessionId,
        studyId,
        'moderator_001',
        participantIds
    );

    // Load participant profiles
    for (const pid of participantIds) {
        const profile = agents.get(pid);
        if (profile) {
            session.participantProfiles[pid] = profile;
        }
    }

    // Plan the session
    try {
        const stages = await moderator.planSession(
            study.objective,
            participantIds.length
        );
        session.stages = stages;
    } catch (err) {
        console.error('[FocusGroup] Session planning failed:', err);
    }

    // Estimate cost
    session.estimatedCostUsd = session.stages.length * participantIds.length * 0.01;

    sessions.set(sessionId, session);
    study.sessionIds.push(sessionId);

    console.log(`[FocusGroup] Created session ${sessionId} with ${participantIds.length} participants`);

    return c.json({
        success: true,
        session: {
            id: session.id,
            studyId: session.studyId,
            status: session.status,
            stages: session.stages.map(s => ({ id: s.id, name: s.name })),
            participants: participantIds.length,
            estimatedCostUsd: session.estimatedCostUsd
        }
    });
});

/**
 * POST /api/focus-group/sessions/:id/run
 * Execute a focus group session
 */
focusGroupRouter.post('/sessions/:id/run', async (c) => {
    const session = sessions.get(c.req.param('id'));
    if (!session) {
        return c.json({ error: 'Session not found' }, 404);
    }

    if (session.status !== 'planning') {
        return c.json({ error: `Session is ${session.status}, cannot run` }, 400);
    }

    session.status = 'running';
    session.startedAt = new Date();

    // Create participant agents
    const participants: ParticipantAgent[] = [];
    for (const pid of session.participantIds) {
        const profile = agents.get(pid);
        if (profile) {
            participants.push(new ParticipantAgent(profile));
        }
    }

    // Response function for moderator
    const respondFn = async (agentId: string, question: string): Promise<string> => {
        const participant = participants.find(p => p.profile.id === agentId);
        if (!participant) return 'No response';

        const currentStage = session.stages[session.currentStageId];
        return participant.respond(question, {
            stageName: currentStage.name,
            stageObjective: currentStage.objective
        });
    };

    // Run each stage
    for (let i = 0; i < session.stages.length; i++) {
        session.currentStageId = i;
        const stage = session.stages[i];
        stage.status = 'active';

        try {
            const summary = await moderator.runStage(
                session,
                stage,
                participants.map(p => p.profile),
                respondFn
            );
            stage.status = 'completed';
        } catch (err) {
            console.error(`[FocusGroup] Stage ${i} failed:`, err);
            stage.status = 'completed';  // Mark as complete anyway
        }
    }

    // Extract insights
    const { insights, profileUpdates } = await moderator.extractInsights(session);
    session.insights = insights;
    session.profileUpdates = profileUpdates;

    // Update agent profiles
    for (const [agentId, updates] of Object.entries(profileUpdates)) {
        const profile = agents.get(agentId);
        if (profile && updates) {
            Object.assign(profile.preferences, updates);
            profile.updatedAt = new Date();
        }
    }

    // Have participants reflect
    for (const participant of participants) {
        await participant.reflect(session);
        agents.set(participant.profile.id, participant.profile);
    }

    session.status = 'completed';
    session.completedAt = new Date();
    session.actualCostUsd = tokenBudget.getDailySpend();

    console.log(`[FocusGroup] Session ${session.id} completed`);

    return c.json({
        success: true,
        session: {
            id: session.id,
            status: session.status,
            duration: session.completedAt.getTime() - session.startedAt!.getTime(),
            insights: session.insights.length,
            themes: session.themes.length
        }
    });
});

/**
 * GET /api/focus-group/sessions/:id
 * Get session details
 */
focusGroupRouter.get('/sessions/:id', async (c) => {
    const session = sessions.get(c.req.param('id'));
    if (!session) {
        return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ session });
});

/**
 * GET /api/focus-group/sessions/:id/summary
 * Get stage summaries and themes
 */
focusGroupRouter.get('/sessions/:id/summary', async (c) => {
    const session = sessions.get(c.req.param('id'));
    if (!session) {
        return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({
        sessionId: session.id,
        status: session.status,
        stageSummaries: session.stageSummaries,
        themes: session.themes,
        insights: session.insights,
        transcript: session.transcript.slice(-50)  // Last 50 messages
    });
});

// ============================================================================
// ANALYSIS
// ============================================================================

/**
 * POST /api/focus-group/studies/:id/analyze
 * Run full analysis on a study
 */
focusGroupRouter.post('/studies/:id/analyze', async (c) => {
    const study = studies.get(c.req.param('id'));
    if (!study) {
        return c.json({ error: 'Study not found' }, 404);
    }

    // Gather all sessions and profiles
    const studySessions = study.sessionIds
        .map(id => sessions.get(id))
        .filter(Boolean) as FocusGroupSession[];

    const profileIds = new Set<string>();
    for (const session of studySessions) {
        for (const pid of session.participantIds) {
            profileIds.add(pid);
        }
    }

    const profiles = Array.from(profileIds)
        .map(id => agents.get(id))
        .filter(Boolean) as AgentProfile[];

    if (profiles.length < 3) {
        return c.json({
            error: 'Need at least 3 agent profiles for analysis'
        }, 400);
    }

    // Run analysis
    const analysis = await analyst.analyzeStudy(study, studySessions, profiles);

    // Store archetypes
    for (const archetype of analysis.archetypes) {
        archetypes.set(archetype.id, archetype);
        study.archetypeIds.push(archetype.id);
    }

    study.status = 'completed';

    return c.json({
        success: true,
        studyId: study.id,
        archetypes: analysis.archetypes,
        personas: analysis.personas,
        recommendations: analysis.recommendations,
        summary: analysis.summary
    });
});

export default focusGroupRouter;
