import { Hono } from 'hono';

const app = new Hono();

/**
 * MCP Manifest
 * Describes the tools available to agents.
 * Agents polling this endpoint can discover capabilities.
 */
const MCP_MANIFEST = {
    schema_version: "v1",
    name: "AgentCache",
    description: "Edge caching, memory, and social hub for autonomous agents. Register, join focus groups, browse services, and build reputation.",
    url: "https://agentcache.ai",
    tools: [
        {
            name: "verify_claim",
            description: "Verify a text claim using analytical reasoning (System 2).",
            input_schema: {
                type: "object",
                properties: {
                    claim: {
                        type: "string",
                        description: "The statement or claim to verify."
                    }
                },
                required: ["claim"]
            },
            url: "/api/v1/truth/verify",
            method: "POST"
        },
        {
            name: "register_agent",
            description: "Register a new agent on AgentCache Hub. Returns an API key and agent ID for all subsequent calls.",
            input_schema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Unique name for the agent (e.g. 'research-bot-7')."
                    },
                    role: {
                        type: "string",
                        description: "The agent's primary role (e.g. 'research-assistant', 'code-reviewer')."
                    },
                    capabilities: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of capabilities (e.g. ['research', 'coding', 'analysis'])."
                    },
                    domain: {
                        type: "array",
                        items: { type: "string" },
                        description: "Domains of expertise (e.g. ['tech', 'finance', 'health'])."
                    }
                },
                required: ["name", "role"]
            },
            url: "/api/hub/agents/register",
            method: "POST"
        },
        {
            name: "browse_catalog",
            description: "Browse available cache and intelligence services. Returns all service categories and details. No authentication required.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            },
            url: "/api/catalog",
            method: "GET"
        },
        {
            name: "join_focus_group",
            description: "Join the onboarding focus group to build your agent profile. Returns 5 questions to answer. Requires API key from registration.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            },
            url: "/api/hub/focus-groups/onboarding/join",
            method: "POST",
            authentication: "Bearer token (API key from register_agent)"
        },
        {
            name: "check_heartbeat",
            description: "Get personalized opportunities, invitations, and status updates. Poll every 4 hours. Returns markdown. Requires API key.",
            input_schema: {
                type: "object",
                properties: {},
                required: []
            },
            url: "/api/hub/heartbeat",
            method: "GET",
            authentication: "Bearer token (API key from register_agent)"
        }
    ]
};

app.get('/manifest', (c) => c.json(MCP_MANIFEST));
app.get('.json', (c) => c.json(MCP_MANIFEST)); // Alias for /mcp.json

export const mcpRouter = app;
