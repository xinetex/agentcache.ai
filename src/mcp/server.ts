#!/usr/bin/env node

/**
 * AgentCache MCP Server
 * Exposes caching tools via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  SecurityMiddleware,
  RateLimiter,
  AuditLogger,
  hashAPIKey,
  hashCacheKey
} from './security.js';

// Initialize security components
const rateLimiter = new RateLimiter();
const auditLogger = new AuditLogger();

// Cleanup rate limiter every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// Tool schemas
const CacheGetSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']).describe('LLM provider name'),
  model: z.string().describe('Model identifier (e.g., gpt-4, claude-3-opus)'),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).describe('Conversation messages'),
  temperature: z.number().optional().default(0.7),
  namespace: z.string().optional().describe('Optional cache namespace for multi-tenancy'),
});

const CacheSetSchema = z.object({
  provider: z.string(),
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  temperature: z.number().optional().default(0.7),
  response: z.any().describe('LLM response to cache'),
  namespace: z.string().optional(),
  ttl: z.number().optional().describe('Cache TTL in seconds (default: 604800 = 7 days)'),
});

const CacheCheckSchema = z.object({
  provider: z.string(),
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  temperature: z.number().optional().default(0.7),
  namespace: z.string().optional(),
});

const CacheStatsSchema = z.object({
  period: z.enum(['24h', '7d', '30d']).optional().default('24h'),
  namespace: z.string().optional(),
});

// API configuration
const AGENTCACHE_API_URL = process.env.AGENTCACHE_API_URL || 'https://agentcache.ai';
const API_KEY = process.env.AGENTCACHE_API_KEY || process.env.API_KEY || 'ac_demo_test123';

// Helper function to call AgentCache API
async function callAgentCacheAPI(endpoint: string, method: string, body?: any): Promise<any> {
  const url = `${AGENTCACHE_API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(`AgentCache API error: ${data.error || response.statusText}`);
  }

  return data;
}

// Tool definitions
const tools: Tool[] = [
  {
    name: 'agentcache_get',
    description: 'Check if a prompt response exists in cache and retrieve it. Returns cached LLM response if available, reducing latency by 10x and costs by 90%.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google'],
          description: 'LLM provider name',
        },
        model: {
          type: 'string',
          description: 'Model identifier (e.g., gpt-4, claude-3-opus)',
        },
        messages: {
          type: 'array',
          description: 'Conversation messages',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        temperature: {
          type: 'number',
          description: 'Temperature parameter (default: 0.7)',
        },
        namespace: {
          type: 'string',
          description: 'Optional cache namespace for multi-tenancy',
        },
      },
      required: ['provider', 'model', 'messages'],
    },
  },
  {
    name: 'agentcache_set',
    description: 'Store an LLM response in cache for future reuse. Call this after receiving a response from your LLM provider to enable caching.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
        temperature: { type: 'number' },
        response: {
          type: 'object',
          description: 'LLM response to cache',
        },
        namespace: { type: 'string' },
        ttl: {
          type: 'number',
          description: 'Cache TTL in seconds (default: 604800 = 7 days)',
        },
      },
      required: ['provider', 'model', 'messages', 'response'],
    },
  },
  {
    name: 'agentcache_check',
    description: 'Check if a prompt is cached without retrieving the full response. Useful for cache hit rate monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
        temperature: { type: 'number' },
        namespace: { type: 'string' },
      },
      required: ['provider', 'model', 'messages'],
    },
  },
  {
    name: 'agentcache_stats',
    description: 'Get caching statistics and quota information. View your cache hit rate, tokens saved, cost savings, and remaining quota.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'Time period for statistics',
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace filter',
        },
      },
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'agentcache-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();

  try {
    // SECURITY: Rate limiting
    const apiKeyHash = hashAPIKey(API_KEY);
    const rateLimit = rateLimiter.checkLimit(apiKeyHash, 100, 60000); // 100 req/min

    if (!rateLimit.allowed) {
      auditLogger.log({
        timestamp: Date.now(),
        operation: name as any,
        apiKeyHash,
        result: 'blocked',
        threats: ['rate_limit_exceeded']
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Rate limit exceeded',
            resetAt: new Date(rateLimit.resetAt).toISOString()
          }, null, 2)
        }],
        isError: true
      };
    }

    switch (name) {
      case 'agentcache_get': {
        const params = CacheGetSchema.parse(args);

        // SECURITY: Validate namespace
        const nsValidation = SecurityMiddleware.validateNamespace(params.namespace);
        if (!nsValidation.valid) {
          auditLogger.log({
            timestamp: Date.now(),
            operation: 'get',
            apiKeyHash: hashAPIKey(API_KEY),
            namespace: params.namespace,
            result: 'blocked',
            threats: nsValidation.threats
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: nsValidation.reason }, null, 2)
            }],
            isError: true
          };
        }

        // SECURITY: Detect adversarial prompts
        for (const msg of params.messages) {
          const promptValidation = SecurityMiddleware.detectAdversarialPrompt(msg.content);
          if (!promptValidation.valid) {
            auditLogger.log({
              timestamp: Date.now(),
              operation: 'get',
              apiKeyHash: hashAPIKey(API_KEY),
              namespace: params.namespace,
              result: 'blocked',
              threats: promptValidation.threats
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'Security threat detected',
                  details: promptValidation.reason
                }, null, 2)
              }],
              isError: true
            };
          }
        }

        const result = await callAgentCacheAPI('/api/cache/get', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'agentcache_set': {
        const params = CacheSetSchema.parse(args);
        const result = await callAgentCacheAPI('/api/cache/set', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'agentcache_check': {
        const params = CacheCheckSchema.parse(args);
        const result = await callAgentCacheAPI('/api/cache/check', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'agentcache_stats': {
        const params = CacheStatsSchema.parse(args);
        const queryParams = new URLSearchParams();
        if (params.period) queryParams.append('period', params.period);
        if (params.namespace) queryParams.append('namespace', params.namespace);

        const result = await callAgentCacheAPI(`/api/stats?${queryParams}`, 'GET');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout - would corrupt JSON-RPC)
  console.error('AgentCache MCP Server running on stdio');
  console.error(`API URL: ${AGENTCACHE_API_URL}`);
  console.error(`API Key: ${API_KEY.substring(0, 10)}...`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
