/**
 * Brain Memory API - AgentCache unified memory endpoints
 * 
 * Provides REST API for AutoMem memory operations using Edge handler pattern.
 */

import automem from '../../lib/automem-client.js';

// Validate API key from request
function getApiKey(request) {
    return request.headers.get('x-api-key') ||
        request.headers.get('authorization')?.replace('Bearer ', '');
}

// Parse the operation from URL path
function parseOperation(url) {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    // Path: /api/brain/memory/{operation}
    return {
        operation: segments[3] || 'health',
        params: segments.slice(4)
    };
}

/**
 * Main handler for /api/brain/memory/* endpoints
 */
export default async function handler(request, context = {}) {
    const apiKey = getApiKey(request);

    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'API key required' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const url = request.url || `http://localhost${request.originalUrl || '/api/brain/memory/health'}`;
    const { operation, params } = parseOperation(url);
    const method = request.method;

    try {
        let result;

        // Route based on operation and method
        switch (operation) {
            case 'health':
                result = await automem.checkHealth();
                break;

            case 'store':
                if (method !== 'POST') {
                    return new Response(
                        JSON.stringify({ error: 'Method not allowed' }),
                        { status: 405, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                const storeBody = await request.json();
                if (!storeBody.content) {
                    return new Response(
                        JSON.stringify({ error: 'content is required' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                result = await automem.storeMemory({
                    content: storeBody.content,
                    type: storeBody.type,
                    tags: storeBody.tags || [],
                    importance: storeBody.importance ?? 0.5,
                    confidence: storeBody.confidence ?? 0.8,
                    metadata: {
                        ...storeBody.metadata,
                        source: 'agentcache'
                    }
                });
                return new Response(
                    JSON.stringify(result),
                    { status: 201, headers: { 'Content-Type': 'application/json' } }
                );

            case 'recall':
                if (method !== 'POST') {
                    return new Response(
                        JSON.stringify({ error: 'Method not allowed' }),
                        { status: 405, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                const recallBody = await request.json();
                if (!recallBody.query && (!recallBody.tags || recallBody.tags.length === 0)) {
                    return new Response(
                        JSON.stringify({ error: 'Either query or tags is required' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                result = await automem.recallMemories({
                    query: recallBody.query,
                    tags: recallBody.tags || [],
                    tagMatch: recallBody.tagMatch || 'prefix',
                    timeQuery: recallBody.timeQuery,
                    limit: recallBody.limit || 10
                });
                break;

            case 'associate':
                if (method !== 'POST') {
                    return new Response(
                        JSON.stringify({ error: 'Method not allowed' }),
                        { status: 405, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                const assocBody = await request.json();
                if (!assocBody.memory1Id || !assocBody.memory2Id || !assocBody.type) {
                    return new Response(
                        JSON.stringify({ error: 'memory1Id, memory2Id, and type are required' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                result = await automem.associateMemories({
                    memory1Id: assocBody.memory1Id,
                    memory2Id: assocBody.memory2Id,
                    type: assocBody.type,
                    strength: assocBody.strength ?? 0.8
                });
                break;

            case 'enrichment':
                // GET /api/brain/memory/enrichment/status
                if (params[0] === 'status') {
                    result = await automem.getEnrichmentStatus();
                } else {
                    return new Response(
                        JSON.stringify({ error: 'Not found' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                break;

            default:
                // Handle memory ID operations: GET/PATCH/DELETE /:id, GET /:id/graph
                const memoryId = operation;

                if (params[0] === 'graph') {
                    // GET /api/brain/memory/:id/graph
                    const searchParams = new URL(url).searchParams;
                    const depth = Math.min(3, Math.max(1, parseInt(searchParams.get('depth')) || 1));
                    result = await automem.getMemoryGraph(memoryId, depth);
                } else if (method === 'GET') {
                    result = await automem.getMemory(memoryId);
                    if (!result) {
                        return new Response(
                            JSON.stringify({ error: 'Memory not found' }),
                            { status: 404, headers: { 'Content-Type': 'application/json' } }
                        );
                    }
                } else if (method === 'PATCH') {
                    const updateBody = await request.json();
                    result = await automem.updateMemory(memoryId, updateBody);
                } else if (method === 'DELETE') {
                    await automem.deleteMemory(memoryId);
                    result = { success: true };
                } else {
                    return new Response(
                        JSON.stringify({ error: 'Method not allowed' }),
                        { status: 405, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                break;
        }

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[Brain Memory] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
