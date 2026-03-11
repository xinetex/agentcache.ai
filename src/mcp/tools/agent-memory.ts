/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * MCP Tools for Agent Memory
 * 
 * Exposes the 4-layer memory system to any MCP-compatible agent:
 * - Claude, Cursor, AutoGPT, LangChain, etc.
 * 
 * Tools:
 *   memory_store - Store data with semantic indexing
 *   memory_recall - Semantic search and retrieval
 *   memory_forget - Remove with policy checks
 *   memory_share - Cross-agent memory sharing
 *   memory_link - Create knowledge graph relationships
 *   memory_related - Find related memories via graph
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getMemory, MemoryOptions, RecallOptions } from '../../lib/agent-memory/index.js';

// Default agent ID for MCP sessions
const MCP_AGENT_PREFIX = 'mcp_agent';

function getAgentId(sessionId?: string): string {
  return sessionId ? `${MCP_AGENT_PREFIX}:${sessionId}` : MCP_AGENT_PREFIX;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const memoryTools: Tool[] = [
  {
    name: 'memory_store',
    description: `Store data in agent memory with automatic semantic indexing.
    
The memory system has 4 layers:
- Semantic (vector): For similarity search
- Structured (relational): For configs/policies
- Blob (object): For large files
- Context (KV): For fast access

Data is automatically routed to appropriate layers based on size and type.`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Unique identifier for the memory (e.g., "conversation:123", "config:api")',
        },
        value: {
          description: 'The data to store (string, object, or any JSON-serializable value)',
        },
        options: {
          type: 'object',
          properties: {
            semantic: {
              type: 'boolean',
              description: 'Enable semantic indexing for similarity search (default: true)',
            },
            ttl: {
              type: 'number',
              description: 'Time-to-live in seconds (optional)',
            },
            tier: {
              type: 'string',
              enum: ['hot', 'warm', 'cold'],
              description: 'Storage tier hint: hot (fast), warm (balanced), cold (archive)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for filtering and organization',
            },
          },
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'memory_recall',
    description: `Recall memories using semantic search or exact key lookup.
    
Search methods:
- Semantic: "Find memories about database optimization"
- Key lookup: "config:database" (exact key)
- Tag-based: Filter by tags

Returns similar memories ranked by relevance score (0-1).`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (semantic) or exact key',
        },
        options: {
          type: 'object',
          properties: {
            semantic: {
              type: 'boolean',
              description: 'Use semantic search (default: true)',
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 10)',
            },
            threshold: {
              type: 'number',
              description: 'Minimum similarity score 0-1 (default: 0.7)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include full metadata in results',
            },
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_forget',
    description: `Remove a memory from all storage layers.
    
Respects policies:
- System namespaces are protected
- Agent isolation is enforced

Use cascade=true to also remove related memories in the knowledge graph.`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key of the memory to forget',
        },
        cascade: {
          type: 'boolean',
          description: 'Also remove related memories (default: false)',
        },
        force: {
          type: 'boolean',
          description: 'Override policy checks (use with caution)',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'memory_share',
    description: `Share a memory with another agent.
    
Creates a share link that the target agent can use to access the memory.
Permissions: read, write, or admin.`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key of the memory to share',
        },
        targetAgentId: {
          type: 'string',
          description: 'ID of the agent to share with',
        },
        permissions: {
          type: 'string',
          enum: ['read', 'write', 'admin'],
          description: 'Access level for the target agent',
        },
        notify: {
          type: 'boolean',
          description: 'Notify the target agent (default: false)',
        },
      },
      required: ['key', 'targetAgentId'],
    },
  },
  {
    name: 'memory_link',
    description: `Create a relationship between two memories in the knowledge graph.
    
Relations help discover related information during recall.
Examples: "depends_on", "references", "supersedes", "related_to"`,
    inputSchema: {
      type: 'object',
      properties: {
        sourceKey: {
          type: 'string',
          description: 'Source memory key',
        },
        targetKey: {
          type: 'string',
          description: 'Target memory key',
        },
        relation: {
          type: 'string',
          description: 'Relationship type (e.g., "depends_on", "references")',
        },
        properties: {
          type: 'object',
          description: 'Additional properties for the relationship',
        },
      },
      required: ['sourceKey', 'targetKey', 'relation'],
    },
  },
  {
    name: 'memory_related',
    description: `Find memories related to a given key via the knowledge graph.
    
Traverses relationships to discover connected information.
Useful for building context around a topic.`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key to find related memories for',
        },
        relation: {
          type: 'string',
          description: 'Filter by relationship type (optional)',
        },
        depth: {
          type: 'number',
          description: 'How many hops to traverse (default: 1, max: 3)',
        },
      },
      required: ['key'],
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

export async function handleMemoryTool(
  toolName: string,
  args: Record<string, any>,
  sessionId?: string
): Promise<any> {
  const agentId = getAgentId(sessionId);
  const memory = getMemory(agentId);

  switch (toolName) {
    case 'memory_store': {
      const { key, value, options = {} } = args;
      const result = await memory.store(key, value, options as MemoryOptions);
      return {
        success: true,
        key: result.key,
        tier: result.metadata.tier,
        size: result.metadata.size,
        hasEmbedding: !!result.embedding,
        message: `Stored "${key}" in ${result.metadata.tier} tier (${result.metadata.size} bytes)`,
      };
    }

    case 'memory_recall': {
      const { query, options = {} } = args;
      const results = await memory.recall(query, options as RecallOptions);
      return {
        success: true,
        count: results.length,
        results: results.map(r => ({
          key: r.key,
          value: r.value,
          score: r.score,
          metadata: r.metadata,
        })),
      };
    }

    case 'memory_forget': {
      const { key, cascade = false, force = false } = args;
      await memory.forget(key, { cascade, force });
      return {
        success: true,
        message: `Forgot "${key}"${cascade ? ' and related memories' : ''}`,
      };
    }

    case 'memory_share': {
      const { key, targetAgentId, permissions = 'read', notify = false } = args;
      const result = await memory.share(targetAgentId, key, { permissions, notify });
      return {
        success: true,
        shareId: result.shareId,
        accessUrl: result.accessUrl,
        message: `Shared "${key}" with ${targetAgentId} (${permissions})`,
      };
    }

    case 'memory_link': {
      const { sourceKey, targetKey, relation, properties } = args;
      await memory.link(sourceKey, targetKey, relation, properties);
      return {
        success: true,
        message: `Linked "${sourceKey}" --[${relation}]--> "${targetKey}"`,
      };
    }

    case 'memory_related': {
      const { key, relation, depth = 1 } = args;
      const results = await memory.findRelated(key, relation, Math.min(depth, 3));
      return {
        success: true,
        count: results.length,
        results: results.map(r => ({
          key: r.key,
          value: r.value,
          score: r.score,
        })),
      };
    }

    default:
      throw new Error(`Unknown memory tool: ${toolName}`);
  }
}

export default { memoryTools, handleMemoryTool };
