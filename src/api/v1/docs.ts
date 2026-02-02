import { Hono } from 'hono';

const docs = new Hono();

const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'AgentCache Public API',
        version: '1.0.0',
        description: 'Public API for AgentCache Services including Trust Broker.',
    },
    servers: [
        {
            url: 'https://agentcache.ai/api/v1',
            description: 'Production Server',
        },
    ],
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
            },
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
            },
        },
    },
    security: [
        { ApiKeyAuth: [] },
        { BearerAuth: [] },
    ],
    paths: {
        '/truth/verify': {
            post: {
                summary: 'Verify a claim',
                description: 'Verifies a text claim using System 2 reasoning.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    claim: {
                                        type: 'string',
                                        example: 'The earth is flat due to horizon perspective.',
                                    },
                                },
                                required: ['claim'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Verification Result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        meta: {
                                            type: 'object',
                                            properties: {
                                                credits_deducted: { type: 'number' },
                                                model: { type: 'string' },
                                            },
                                        },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                verdict: { type: 'string', enum: ['TRUE', 'FALSE', 'UNCERTAIN'] },
                                                confidence: { type: 'number' },
                                                reasoning: { type: 'string' },
                                                sources: { type: 'array', items: { type: 'string' } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

docs.get('/openapi.json', (c) => c.json(openApiSpec));

export const docsRouter = docs;
