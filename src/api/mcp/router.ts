/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
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
    description: "AgentCache caching, memory, and governed execution. Execution actions apply policy checks and preserve reviewable run history.",
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
            name: "recommend_tool_shed",
            description: "Get a scoped tool bundle from AgentCache Tool Shed so agents load only the services needed for a workload.",
            input_schema: {
                type: "object",
                properties: {
                    profile: {
                        type: "string",
                        description: "Workload profile (general, chat-assistant, retrieval-rag, workflow-automation, secure-enterprise, edge-media)."
                    },
                    tier: {
                        type: "string",
                        description: "Optional tier filter (free, pro, enterprise)."
                    },
                    includeBeta: {
                        type: "boolean",
                        description: "Include beta services in recommendations."
                    }
                },
                required: []
            },
            url: "/api/catalog/tool-shed",
            method: "GET"
        },
        {
            name: "execution_tools",
            description: "Discover AgentCache governed workflow actions. Discovery does not grant permission to execute an action.",
            input_schema: { type: "object", properties: {}, required: [] },
            url: "/api/execution/tools",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_list_connections",
            description: "List provider connection metadata owned by this workspace. Credential values are never returned.",
            input_schema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, required: [] },
            url: "/api/execution/connections",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_create_connection",
            description: "Save credentials for a provider account you own. Requires a user or organization AgentCache API key; agent registration keys cannot manage provider connections. Credentials are encrypted before storage, and requested scopes remain unverified until an adapter checks them.",
            input_schema: {
                type: "object",
                properties: {
                    provider: { type: "string" },
                    displayName: { type: "string" },
                    scopes: { type: "array", items: { type: "string" } },
                    credentials: { type: "object" }
                },
                required: ["provider", "credentials"]
            },
            url: "/api/execution/connections",
            method: "POST",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_revoke_connection",
            description: "Disconnect a provider account owned by this user or organization API key and remove its encrypted credential material.",
            input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
            url: "/api/execution/connections/{id}",
            method: "DELETE",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_list_context_packs",
            description: "List context packs available to the authenticated principal.",
            input_schema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, required: [] },
            url: "/api/execution/context-packs",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_create_context_pack",
            description: "Create a workflow context pack owned by the authenticated principal.",
            input_schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    objective: { type: "string" },
                    methodology: { type: "string" },
                    conventions: { type: "array", items: { type: "string" } },
                    tools: { type: "array", items: { type: "string" } },
                    outputContract: { type: "object" },
                    policyProfile: { type: "object" },
                    metadata: { type: "object" },
                    sectorHint: { type: "string" },
                    workflowTemplate: { type: "string", enum: ["generic", "policy_review", "regulated_release", "research_brief"] },
                    workflowPhases: { type: "array", items: { type: "string" } },
                    reviewerRoles: { type: "array", items: { type: "string" } }
                },
                required: ["name", "objective"]
            },
            url: "/api/execution/context-packs",
            method: "POST",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_list_runs",
            description: "List execution runs owned by the authenticated principal.",
            input_schema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, required: [] },
            url: "/api/execution/runs",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_start_run",
            description: "Start a policy-checked workflow run from an owned context pack. High-impact actions may wait for human approval. This records a governed workflow; it does not invoke an external provider tool.",
            input_schema: {
                type: "object",
                properties: {
                    contextPackId: { type: "string" },
                    contextPackVersionId: { type: "string" },
                    inputPayload: { type: "object" },
                    trigger: { type: "string" },
                    finalAction: { type: "string", enum: ["publish", "send", "pay", "delete", "external_store", "manual"] },
                    requireHumanGate: { type: "boolean" }
                },
                required: ["contextPackId"]
            },
            url: "/api/execution/runs",
            method: "POST",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_invoke_jetty_summary",
            description: "Invoke the policy-checked JettyThunder aggregate storage summary for an owned execution run. This fixed read-only adapter returns no file names or identifiers. Reuse the same optional idempotencyKey when retrying; without one, the run/account action is single-shot.",
            input_schema: { type: "object", properties: { id: { type: "string" }, connectionId: { type: "string" }, idempotencyKey: { type: "string", minLength: 16, maxLength: 128 } }, required: ["id", "connectionId"] },
            url: "/api/execution/runs/{id}/invoke",
            method: "POST",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_invocation_history",
            description: "Read recent durable, redacted invocation evidence owned by this API key.",
            input_schema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, required: [] },
            url: "/api/execution/invocations",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_decision_history",
            description: "Read durable run, reviewer verdict, phase, and approval metadata owned by this API key. Workflow payloads and review rationale are excluded.",
            input_schema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } }, required: [] },
            url: "/api/execution/decision-events",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_run_invocations",
            description: "Read durable invocation evidence for a single owned run.",
            input_schema: { type: "object", properties: { id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } }, required: ["id"] },
            url: "/api/execution/runs/{id}/invocations",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_usage",
            description: "Read governed-action counts for the current month; only completed calls are counted as potential billable actions, and this endpoint does not charge.",
            input_schema: { type: "object", properties: {}, required: [] },
            url: "/api/execution/usage",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_get_run",
            description: "Read the run, approval gate, reviews, and receipt for a run owned by the authenticated principal.",
            input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
            url: "/api/execution/runs/{id}",
            method: "GET",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_advance_phase",
            description: "Advance an owned run to a configured workflow phase. This endpoint can submit the run to its gate but cannot decide it. A different owner or admin member of the same organization must approve or reject through the gate API.",
            input_schema: { type: "object", properties: { id: { type: "string" }, phase: { type: "string" } }, required: ["id", "phase"] },
            url: "/api/execution/runs/{id}/phase",
            method: "POST",
            authentication: "Bearer AgentCache API key"
        },
        {
            name: "execution_evaluate_run",
            description: "Evaluate an owned execution run for drift in shadow mode; the evaluation is recorded.",
            input_schema: { type: "object", properties: { id: { type: "string" }, mode: { type: "string", enum: ["shadow"] } }, required: ["id"] },
            url: "/api/execution/runs/{id}/evaluate",
            method: "POST",
            authentication: "Bearer AgentCache API key"
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
