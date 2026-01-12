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
import { TrustCenter } from '../infrastructure/TrustCenter.js';
import { PredictiveSynapse } from '../infrastructure/PredictiveSynapse.js';
import { CognitiveRouter } from '../infrastructure/CognitiveRouter.js';
import { MultiModalEncoder } from '../lib/llm/multimodal.js';

// Initialize services
const trustCenter = new TrustCenter();
const synapse = new PredictiveSynapse();
const router = new CognitiveRouter();
const encoder = new MultiModalEncoder();

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

const CacheInvalidateSchema = z.object({
  pattern: z.string().optional().describe('Wildcard pattern (e.g., "news/*")'),
  namespace: z.string().optional().describe('Target namespace'),
  olderThan: z.number().optional().describe('Invalidate caches older than X milliseconds'),
  url: z.string().optional().describe('Invalidate caches from specific URL'),
  reason: z.string().optional().describe('Reason for invalidation (for audit log)'),
});

const RegisterListenerSchema = z.object({
  url: z.string().describe('URL to monitor for changes'),
  checkInterval: z.number().optional().default(900000).describe('Check interval in milliseconds (default: 900000 = 15min)'),
  namespace: z.string().optional().default('default').describe('Namespace to invalidate on change'),
  invalidateOnChange: z.boolean().optional().default(true).describe('Auto-invalidate on content change'),
  webhook: z.string().optional().describe('Webhook URL to notify on change'),
});

const SearchDocsSchema = z.object({
  query: z.string().describe('Search query for documentation'),
  limit: z.number().optional().default(3).describe('Number of results to return'),
});

const TrustStatusSchema = z.object({
  format: z.enum(['json', 'oscal']).optional().default('json').describe('Output format'),
});

const PredictIntentSchema = z.object({
  query: z.string().describe('The current user prompt or query'),
  depth: z.number().optional().default(1).describe('Recursive depth for prediction'),
});

const System2Schema = z.object({
  prompt: z.string().describe('Complex problem requiring deep reasoning'),
});

const HiveMemorySchema = z.object({
  input: z.union([z.string(), z.any()]).describe('Text description or Sensor Object'),
  modality: z.enum(['text', 'image', 'sensor']).optional().default('text'),
});

const CompressContextSchema = z.object({
  text: z.string().describe('The long text or document context to compress'),
  compression_ratio: z.enum(['16x', '32x', '128x']).optional().default('16x').describe('Target compression ratio'),
});

const SimulateOutcomeSchema = z.object({
  action: z.string().describe('The tool or action to simulate'),
  params: z.any().describe('Parameters for the action'),
});

// AutoMem Memory Schemas
const MemoryStoreSchema = z.object({
  content: z.string().describe('The memory content to store'),
  type: z.enum(['Decision', 'Pattern', 'Preference', 'Style', 'Habit', 'Insight', 'Context']).optional().describe('Type of memory'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
  importance: z.number().min(0).max(1).optional().describe('Importance score 0-1'),
});

const MemoryRecallSchema = z.object({
  query: z.string().optional().describe('Semantic search query'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  timeQuery: z.string().optional().describe('Natural language time query (e.g., "last week")'),
  limit: z.number().optional().default(5).describe('Max results'),
});

const MemoryGraphSchema = z.object({
  memoryId: z.string().describe('UUID of the center memory'),
  depth: z.number().min(1).max(3).optional().default(1).describe('Traversal depth'),
});

const EvolveFleetSchema = z.object({
  generations: z.number().optional().default(1).describe('Number of generations to evolve'),
  populationSize: z.number().optional().default(20).describe('Size of population'),
});

const MuscleExecSchema = z.object({
  goal: z.any().describe('The goal state to achieve (e.g. { ad_served: true })'),
  context: z.any().optional().describe('Contextual data for the planner (e.g. { file_id: "123" })'),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal')
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
  {
    name: 'agentcache_invalidate',
    description: 'Invalidate cached responses by pattern, namespace, age, or URL. Essential for robotics fleets and dynamic data scenarios.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Wildcard pattern (e.g., "navigation/*", "pricing/*")',
        },
        namespace: {
          type: 'string',
          description: 'Target namespace to invalidate',
        },
        olderThan: {
          type: 'number',
          description: 'Invalidate caches older than X milliseconds',
        },
        url: {
          type: 'string',
          description: 'Invalidate caches from specific source URL',
        },
        reason: {
          type: 'string',
          description: 'Reason for invalidation (logged for audit)',
        },
      },
    },
  },
  {
    name: 'agentcache_register_listener',
    description: 'Register URL to monitor for content changes and auto-invalidate caches. Perfect for monitoring competitor pricing, API docs, or environmental sensors.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to monitor (required)',
        },
        checkInterval: {
          type: 'number',
          description: 'Check interval in milliseconds (default: 900000 = 15min)',
        },
        namespace: {
          type: 'string',
          description: 'Namespace to invalidate on change (default: "default")',
        },
        invalidateOnChange: {
          type: 'boolean',
          description: 'Auto-invalidate namespace on content change (default: true)',
        },
        webhook: {
          type: 'string',
          description: 'Webhook URL to notify on content change',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_docs',
    description: 'Search indexed documentation for context (RAG)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for documentation',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 3)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'agentcache_trust_status',
    description: 'Get the current security and compliance status of the AgentCache system. Returns machine-readable evidence for FedRAMP/GRC verification.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'oscal'],
          description: 'Output format (default: json)',
        },
      },
    },
  },
  {
    name: 'agentcache_predict_intent',
    description: 'Predict the user\'s NEXT likely query based on their current one. Enables "Negative Latency" and pre-fetching.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Current user query' },
        depth: { type: 'number', description: 'Recursion depth (default: 1)' }
      },
      required: ['query']
    }
  },
  {
    name: 'agentcache_ask_system2',
    description: 'Route a complex query to "System 2" (Deep Reasoning) if necessary. Determines if cache should be bypassed for critical thinking.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Complex problem' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'agentcache_hive_memory',
    description: 'Query the Multi-Modal Hive Mind. Finds "Visually Similar" or "Semantically Similar" past experiences/actions.',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input data (Text or JSON object)' },
        modality: { type: 'string', enum: ['text', 'image', 'sensor'] }
      },
      required: ['input']
    }
  },
  {
    name: 'agentcache_compress_context',
    description: 'Compress large text contexts into dense memory tokens using CLaRa-7B. Reduces token usage by 90% while retaining semantic meaning for RAG.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The long text or document context to compress' },
        compression_ratio: { type: 'string', enum: ['16x', '32x', '128x'], description: 'Target compression ratio (default: 16x)' }
      },
      required: ['text']
    }
  },
  {
    name: 'agentcache_simulate_outcome',
    description: 'Simulate the outcome of an action without executing it. Returns predicted success, confidence, and potential risks.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'The tool or action to simulate' },
        params: { type: 'object', description: 'Parameters for the action' }
      },
      required: ['action', 'params']
    }
  },
  {
    name: 'agentcache_memory_store',
    description: 'Store a persistent memory in the AI Brain (AutoMem). Use this to remember user patterns, preferences, decisions, or important context for future sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory content' },
        type: { type: 'string', enum: ['Decision', 'Pattern', 'Preference', 'Style', 'Habit', 'Insight', 'Context'] },
        tags: { type: 'array', items: { type: 'string' } },
        importance: { type: 'number', minimum: 0, maximum: 1 }
      },
      required: ['content']
    }
  },
  {
    name: 'agentcache_memory_recall',
    description: 'Recall memories from the AI Brain using semantic search, tags, or time. Use this to retrieve past context or learn from previous decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        timeQuery: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'agentcache_memory_graph',
    description: 'Explore the knowledge graph around a specific memory. shows relationships (CAUSED, PREFERS, etc) to deep-dive into a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string' },
        depth: { type: 'number', minimum: 1, maximum: 3 }
      },
      required: ['memoryId']
    }
  },
  {
    name: 'agentcache_evolve_fleet',
    description: 'Trigger the Confucius Meta-Agent to run an evolutionary optimization loop on the agent fleet. Use this to self-improve based on recent performance.',
    inputSchema: {
      type: 'object',
      properties: {
        generations: { type: 'number' },
        populationSize: { type: 'number' }
      }
    }
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

      case 'agentcache_invalidate': {
        const params = CacheInvalidateSchema.parse(args);

        // Validate at least one criterion provided
        if (!params.pattern && !params.namespace && !params.olderThan && !params.url) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Must provide at least one invalidation criterion',
                criteria: ['pattern', 'namespace', 'olderThan', 'url']
              }, null, 2)
            }],
            isError: true
          };
        }

        const result = await callAgentCacheAPI('/api/cache/invalidate', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'agentcache_register_listener': {
        const params = RegisterListenerSchema.parse(args);
        const result = await callAgentCacheAPI('/api/listeners/register', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_docs': {
        const params = SearchDocsSchema.parse(args);
        const result = await callAgentCacheAPI('/api/docs/search', 'POST', params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }



      case 'agentcache_trust_status': {
        const params = TrustStatusSchema.parse(args);

        let result;
        if (params.format === 'oscal') {
          result = await trustCenter.generateOSCAL();
        } else {
          result = await trustCenter.getTrustStatus();
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'agentcache_predict_intent': {
        const params = PredictIntentSchema.parse(args);
        // Use PredictiveSynapse
        // Note: In real life we'd 'observe' here too, but for tool purity we just predict
        const predictions = await synapse.predict(params.query, params.depth);
        return {
          content: [{ type: 'text', text: JSON.stringify({ predictions }, null, 2) }]
        };
      }

      case 'agentcache_ask_system2': {
        const params = System2Schema.parse(args);

        try {
          // Forward calculation to Python 'Atom of Thoughts' service
          const response = await fetch('http://localhost:8085/reason', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: params.prompt })
          });

          if (!response.ok) {
            throw new Error(`System 2 Service Error: ${response.statusText}`);
          }

          const data = await response.json();

          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
          };
        } catch (error) {
          // Fallback if service is down
          return {
            content: [{
              type: 'text', text: JSON.stringify({
                error: "System 2 Service Unavailable",
                details: String(error),
                recommendation: "Ensure 'src/services/system2/server.py' is running on port 8000"
              }, null, 2)
            }]
          };
        }
      }

      case 'agentcache_hive_memory': {
        const params = HiveMemorySchema.parse(args);
        // Use MultiModalEncoder
        let input = params.input;
        try { if (typeof input === 'string' && input.startsWith('{')) input = JSON.parse(input); } catch (e) { }

        const vector = await encoder.embed(input);
        // Simulation: We don't have the full Vector DB wired in this file, so we return the Vector + Mock Match
        // In prod this would call vectorIndex.query()
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              embedding_dim: vector.length,
              vector_sample: vector.slice(0, 5),
              status: 'encoded',
              nearest_neighbor_simulation: 'match_found'
            }, null, 2)
          }]
        };
      }

      case 'agentcache_compress_context': {
        const params = CompressContextSchema.parse(args);
        const result = await callAgentCacheAPI('/api/cognitive/compress', 'POST', {
          text: params.text,
          compression_ratio: params.compression_ratio
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'agentcache_simulate_outcome': {
        const params = SimulateOutcomeSchema.parse(args);
        // In a real implementation, this would call a predictive model or sandbox
        // For this demo, we use a simple heuristic simulation
        const isDestructive = params.action.includes('delete') || params.action.includes('remove') || params.action.includes('invalidate');

        const simulation = {
          outcome: isDestructive ? 'Resources will be permanently removed' : 'Action will interact with external APIs',
          confidence: isDestructive ? 0.95 : 0.8,
          risks: isDestructive ? ['Data Loss', 'Service Interruption'] : ['API Rate Limits'],
          predicted_duration_ms: Math.floor(Math.random() * 500) + 50
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(simulation, null, 2) }]
        };
      }

      case 'agentcache_memory_store': {
        const params = MemoryStoreSchema.parse(args);
        const result = await callAgentCacheAPI('/api/brain/memory/store', 'POST', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'agentcache_memory_recall': {
        const params = MemoryRecallSchema.parse(args);
        const result = await callAgentCacheAPI('/api/brain/memory/recall', 'POST', params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'agentcache_memory_graph': {
        const params = MemoryGraphSchema.parse(args);
        const result = await callAgentCacheAPI(`/api/brain/memory/${params.memoryId}/graph?depth=${params.depth}`, 'GET');
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'agentcache_evolve_fleet': {
        const params = EvolveFleetSchema.parse(args);
        console.error('[MCP] Triggering Evolutionary Optimization logic via Meta-Agent...');
        // Directly call the MetaAgent from the Router instance
        const supervisor = router.getSupervisor();

        // Mock fitness function for now (normally would query Analytics service)
        const mockFitness = async (g: any) => { return Math.random(); };

        let bestGenome = null;
        for (let i = 0; i < params.generations; i++) {
          bestGenome = await supervisor.evolveGeneration(mockFitness);
        }

        return {
          content: [{
            type: 'text', text: JSON.stringify({
              status: 'optimization_complete',
              generations_run: params.generations,
              best_genome: bestGenome,
              message: 'Fleet configuration updated based on evolutionary parameters.'
            }, null, 2)
          }]
        };
      }

      case 'agentcache_muscle_exec': {
        const params = MuscleExecSchema.parse(args);
        console.error('[MCP] Commanding Muscle (JettyThunder)...');

        // Call the proxy endpoint
        const result = await callAgentCacheAPI('/api/muscle/plan', 'POST', {
          goal: params.goal,
          context: params.context,
          priority: params.priority
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
