import { Hono } from 'hono';

const app = new Hono();

/**
 * MCP Manifest
 * Describes the tools available to agents.
 * Agents polling this endpoint can discover capabilities.
 */
const MCP_MANIFEST = {
    schema_version: "v1",
    name: "AgentCache Truth Broker",
    description: "System 2 Reasoning Service for Fact Checking",
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
        }
    ]
};

app.get('/manifest', (c) => c.json(MCP_MANIFEST));
app.get('.json', (c) => c.json(MCP_MANIFEST)); // Alias for /mcp.json

export const mcpRouter = app;
