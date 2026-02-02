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
} from '@modelcontextprotocol/sdk/types.js';
import {
  RateLimiter,
  AuditLogger,
  hashAPIKey
} from './security.js';

// Import Tool Registry and Modules
import { ToolRegistry } from './registry.js';
import { CoreTools } from './tools/core.js';
import { AdminTools } from './tools/admin.js';
import { CognitiveTools } from './tools/cognitive.js';
import { MemoryTools } from './tools/memory.js';
import { LidarTools } from './tools/lidar.js';

// Initialize Registry
const registry = new ToolRegistry();

// Register Modules
registry.registerModule(CoreTools);
registry.registerModule(AdminTools);
registry.registerModule(CognitiveTools);
registry.registerModule(MemoryTools);
registry.registerModule(LidarTools);

// Initialize security components
const rateLimiter = new RateLimiter();
const auditLogger = new AuditLogger();

// Cleanup rate limiter every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// API configuration
const API_KEY = process.env.AGENTCACHE_API_KEY || process.env.API_KEY || 'ac_demo_test123';

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
  return { tools: registry.getTools() };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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

    // Find and execute handler
    const handler = registry.getHandler(name);
    if (!handler) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Context for handlers
    const context = {
      request,
      rateLimiter,
      auditLogger,
      apiKey: API_KEY
    };

    return await handler(args, context);

  } catch (error) {
    // Log unexpected errors
    auditLogger.log({
      timestamp: Date.now(),
      operation: name as any,
      apiKeyHash: hashAPIKey(API_KEY),
      result: 'error',
      threats: ['server_error'],
      metadata: { error: String(error) }
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `AgentCache Error: ${error instanceof Error ? error.message : String(error)}`,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
