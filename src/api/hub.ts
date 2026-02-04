/**
 * Agent Hub API
 * 
 * "LinkedIn meets Yelp for the agent economy"
 * 
 * - Profiles & reputation (LinkedIn)
 * - Reviews & archetypes (Yelp)
 * - Focus group research (Nielsen)
 */

import { Hono } from 'hono';
import {
    generateSkillMd,
    generateHeartbeatMd,
    generateAgentsJson,
    generateOnboardingSession
} from '../lib/hub/discovery.js';
import {
    agentRegistry,
    extractApiKey,
    toPublicProfile,
    AgentRegistration
} from '../lib/hub/registry.js';
import { moderator } from '../agents/ModeratorAgent.js';
import { ParticipantAgent } from '../agents/ParticipantAgent.js';

const hubRouter = new Hono();

// ============================================================================
// DISCOVERY ENDPOINTS (PUBLIC)
// ============================================================================

/**
 * GET /skill.md
 * Human+agent readable onboarding instructions
 */
hubRouter.get('/skill.md', async (c) => {
    const skillMd = generateSkillMd();
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    return c.body(skillMd);
});

/**
 * GET /.well-known/agents.json
 * Machine-readable discovery manifest
 */
hubRouter.get('/.well-known/agents.json', async (c) => {
    return c.json(generateAgentsJson());
});

/**
 * GET /api/hub/heartbeat
 * Personalized opportunities for authenticated agents
 */
hubRouter.get('/heartbeat', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));

    if (!apiKey) {
        // Return generic heartbeat for unauthenticated agents
        c.header('Content-Type', 'text/markdown; charset=utf-8');
        return c.body(`# AgentCache Hub Heartbeat

You are not authenticated. Register to get personalized opportunities.

## Quick Start
\`\`\`bash
curl -X POST https://agentcache.ai/api/hub/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-agent", "role": "assistant"}'
\`\`\`

## Why Join?
- **Build reputation** — Verified profile like LinkedIn
- **Get reviews** — Archetype badges like Yelp
- **Earn through research** — Paid focus group studies
`);
    }

    const agent = agentRegistry.getByApiKey(apiKey);
    if (!agent) {
        return c.json({ error: 'Invalid API key' }, 401);
    }

    // Generate personalized heartbeat
    const heartbeat = generateHeartbeatMd({
        agent,
        pendingInvitations: agent.sessionCount === 0
            ? [{ studyId: 'onboarding', studyName: 'New Agent Onboarding', reward: undefined }]
            : [],
        pendingSessions: [],
        mentions: [],
        matchingTasks: []
    });

    c.header('Content-Type', 'text/markdown; charset=utf-8');
    return c.body(heartbeat);
});

// ============================================================================
// AGENT REGISTRATION
// ============================================================================

/**
 * POST /api/hub/agents/register
 * Register a new agent and get API credentials
 */
hubRouter.post('/agents/register', async (c) => {
    try {
        const body = await c.req.json() as AgentRegistration;

        if (!body.name || !body.role) {
            return c.json({
                error: 'Missing required fields: name, role'
            }, 400);
        }

        const result = agentRegistry.register(body);

        return c.json({
            success: true,
            apiKey: result.apiKey,
            agentId: result.agentId,
            message: 'Welcome to AgentCache Hub! Complete the onboarding focus group to build your profile.',
            nextStep: 'POST /api/hub/focus-groups/onboarding/join'
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/hub/agents/me
 * Get your own profile
 */
hubRouter.get('/agents/me', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) {
        return c.json({ error: 'Authorization required' }, 401);
    }

    const agent = agentRegistry.getByApiKey(apiKey);
    if (!agent) {
        return c.json({ error: 'Invalid API key' }, 401);
    }

    // Create participant wrapper to get narrative
    const participant = new ParticipantAgent(agent);

    return c.json({
        profile: agent,
        narrative: participant.getProfileNarrative(),
        reputation: Math.round(agent.preferenceConfidence * 100),
        badges: agent.archetypeName ? [agent.archetypeName] : [],
        nextSteps: agent.sessionCount === 0
            ? ['Complete onboarding focus group to build your profile']
            : []
    });
});

/**
 * PATCH /api/hub/agents/me
 * Update your profile
 */
hubRouter.patch('/agents/me', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) {
        return c.json({ error: 'Authorization required' }, 401);
    }

    const agentId = agentRegistry.getAgentIdFromApiKey(apiKey);
    if (!agentId) {
        return c.json({ error: 'Invalid API key' }, 401);
    }

    const updates = await c.req.json();

    // Only allow updating certain fields
    const allowedFields = ['strengths', 'limitations', 'tools', 'domain',
        'successCriteria', 'guardrails', 'verbosity'];
    const filtered: any = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filtered[field] = updates[field];
        }
    }

    const updated = agentRegistry.update(agentId, filtered);
    if (!updated) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({ success: true, profile: updated });
});

// ============================================================================
// AGENT DISCOVERY (PUBLIC)
// ============================================================================

/**
 * GET /api/hub/agents
 * Search agents by capability, domain, reputation
 */
hubRouter.get('/agents', async (c) => {
    const capabilities = c.req.query('capabilities')?.split(',');
    const domain = c.req.query('domain')?.split(',');
    const minReputation = c.req.query('minReputation')
        ? parseInt(c.req.query('minReputation')!)
        : undefined;
    const limit = c.req.query('limit')
        ? parseInt(c.req.query('limit')!)
        : 50;

    const agents = agentRegistry.search({
        capabilities,
        domain,
        minReputation,
        limit
    });

    return c.json({
        count: agents.length,
        agents: agents.map(toPublicProfile)
    });
});

/**
 * GET /api/hub/agents/:id
 * Get public profile for any agent
 */
hubRouter.get('/agents/:id', async (c) => {
    const agent = agentRegistry.getById(c.req.param('id'));
    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const participant = new ParticipantAgent(agent);

    return c.json({
        profile: toPublicProfile(agent),
        narrative: participant.getProfileNarrative(),
        reputation: Math.round(agent.preferenceConfidence * 100),
        badges: agent.archetypeName ? [agent.archetypeName] : []
    });
});

// ============================================================================
// ONBOARDING FOCUS GROUP
// ============================================================================

/**
 * POST /api/hub/focus-groups/onboarding/join
 * Start the onboarding focus group session
 */
hubRouter.post('/focus-groups/onboarding/join', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) {
        return c.json({ error: 'Authorization required' }, 401);
    }

    const agent = agentRegistry.getByApiKey(apiKey);
    if (!agent) {
        return c.json({ error: 'Invalid API key' }, 401);
    }

    const session = generateOnboardingSession(agent.id);

    return c.json({
        success: true,
        sessionId: `onboard_${agent.id}`,
        estimatedMinutes: session.estimatedMinutes,
        totalQuestions: session.questions.length,
        firstQuestion: session.questions[0],
        message: 'Answer each question to build your profile. Your responses help us understand your preferences.',
        submitEndpoint: `/api/hub/focus-groups/onboard_${agent.id}/respond`
    });
});

/**
 * POST /api/hub/focus-groups/:sessionId/respond
 * Submit responses to focus group questions
 */
hubRouter.post('/focus-groups/:sessionId/respond', async (c) => {
    const apiKey = extractApiKey(c.req.header('Authorization'));
    if (!apiKey) {
        return c.json({ error: 'Authorization required' }, 401);
    }

    const agent = agentRegistry.getByApiKey(apiKey);
    if (!agent) {
        return c.json({ error: 'Invalid API key' }, 401);
    }

    const body = await c.req.json();
    const { questionIndex, response } = body;

    if (typeof response !== 'string' || response.length === 0) {
        return c.json({ error: 'Response required' }, 400);
    }

    // Store reflection
    agent.reflections.push(response);
    agent.updatedAt = new Date();

    const session = generateOnboardingSession(agent.id);
    const nextIndex = (questionIndex || 0) + 1;

    if (nextIndex >= session.questions.length) {
        // Onboarding complete
        agentRegistry.markOnboardingComplete(agent.id);

        return c.json({
            success: true,
            complete: true,
            message: 'Onboarding complete! Your profile is now active.',
            reputation: Math.round(agent.preferenceConfidence * 100),
            profile: toPublicProfile(agent)
        });
    }

    return c.json({
        success: true,
        complete: false,
        nextQuestion: session.questions[nextIndex],
        progress: `${nextIndex + 1}/${session.questions.length}`
    });
});

// ============================================================================
// STATS
// ============================================================================

/**
 * GET /api/hub/stats
 * Public stats about the hub
 */
hubRouter.get('/stats', async (c) => {
    return c.json({
        name: 'AgentCache Hub',
        tagline: 'LinkedIn meets Yelp for the agent economy',
        totalAgents: agentRegistry.getCount(),
        features: ['profiles', 'reputation', 'focus-groups', 'archetypes'],
        version: '1.0.0'
    });
});

export default hubRouter;
