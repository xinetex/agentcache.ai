/**
 * AutoMem Client for AgentCache (ES Module version)
 * 
 * Provides persistent AI memory through the AutoMem graph-vector service.
 */

const AUTOMEM_URL = process.env.AUTOMEM_URL || 'http://localhost:8001';
const AUTOMEM_TOKEN = process.env.AUTOMEM_TOKEN;

export const MEMORY_TYPES = ['Decision', 'Pattern', 'Preference', 'Style', 'Habit', 'Insight', 'Context'];

export const RELATIONSHIP_TYPES = [
    'RELATES_TO', 'LEADS_TO', 'OCCURRED_BEFORE', 'PREFERS_OVER', 'EXEMPLIFIES',
    'CONTRADICTS', 'REINFORCES', 'INVALIDATED_BY', 'EVOLVED_INTO', 'DERIVED_FROM', 'PART_OF'
];

export async function checkHealth() {
    try {
        const response = await fetch(`${AUTOMEM_URL}/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            return { healthy: true, status: data.status || 'ok', services: data.services || {} };
        }
        return { healthy: false, error: 'Health check failed' };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

export async function storeMemory({ content, type, tags = [], importance = 0.5, confidence = 0.8, metadata = {} }) {
    if (!content) throw new Error('Memory content is required');

    const response = await fetch(`${AUTOMEM_URL}/memory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTOMEM_TOKEN}`
        },
        body: JSON.stringify({
            content,
            type: MEMORY_TYPES.includes(type) ? type : 'Context',
            tags,
            importance,
            confidence,
            metadata: { ...metadata, source: 'agentcache', stored_at: new Date().toISOString() }
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to store memory: ${response.status}`);
    }
    return response.json();
}

export async function recallMemories({ query, tags = [], tagMatch = 'prefix', timeQuery, limit = 10 }) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (tags.length) params.append('tags', tags.join(','));
    if (tagMatch) params.append('tag_match', tagMatch);
    if (timeQuery) params.append('time_query', timeQuery);
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${AUTOMEM_URL}/recall?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to recall memories: ${response.status}`);
    }
    return response.json();
}

export async function getMemory(memoryId) {
    const response = await fetch(`${AUTOMEM_URL}/memory/${memoryId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` }
    });
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get memory: ${response.status}`);
    }
    return response.json();
}

export async function updateMemory(memoryId, updates) {
    const response = await fetch(`${AUTOMEM_URL}/memory/${memoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` },
        body: JSON.stringify(updates)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to update memory: ${response.status}`);
    }
    return response.json();
}

export async function deleteMemory(memoryId) {
    const response = await fetch(`${AUTOMEM_URL}/memory/${memoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTOMEM_TOKEN}` }
    });
    if (!response.ok) throw new Error(`Failed to delete memory: ${response.status}`);
    return { success: true };
}

export async function associateMemories({ memory1Id, memory2Id, type, strength = 0.8 }) {
    if (!RELATIONSHIP_TYPES.includes(type)) {
        throw new Error(`Invalid relationship type. Must be one of: ${RELATIONSHIP_TYPES.join(', ')}`);
    }

    const response = await fetch(`${AUTOMEM_URL}/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` },
        body: JSON.stringify({ memory1_id: memory1Id, memory2_id: memory2Id, type, strength })
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to associate memories: ${response.status}`);
    }
    return response.json();
}

export async function getMemoryGraph(memoryId, depth = 1) {
    const response = await fetch(`${AUTOMEM_URL}/memory/${memoryId}/graph?depth=${depth}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` }
    });
    if (!response.ok) throw new Error(`Failed to get memory graph: ${response.status}`);
    return response.json();
}

export async function getEnrichmentStatus() {
    const response = await fetch(`${AUTOMEM_URL}/enrichment/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${AUTOMEM_TOKEN}` }
    });
    if (!response.ok) return { available: false };
    return response.json();
}

export default {
    MEMORY_TYPES,
    RELATIONSHIP_TYPES,
    checkHealth,
    storeMemory,
    recallMemories,
    getMemory,
    updateMemory,
    deleteMemory,
    associateMemories,
    getMemoryGraph,
    getEnrichmentStatus
};
