/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Tool, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export interface ToolHandlerContext {
    request: any;
    rateLimiter: any;
    auditLogger: any;
    apiKey: string;
}

export interface ToolModule {
    registerResults?: any; // Optional results from registration
    tools: Tool[];
    handlers: Record<string, (args: any, context: ToolHandlerContext) => Promise<any>>;
}

export class ToolRegistry {
    private tools: Tool[] = [];
    private handlers: Map<string, (args: any, context: ToolHandlerContext) => Promise<any>> = new Map();

    registerModule(module: ToolModule) {
        this.tools.push(...module.tools);
        for (const [name, handler] of Object.entries(module.handlers)) {
            if (this.handlers.has(name)) {
                throw new Error(`Tool ${name} is already registered`);
            }
            this.handlers.set(name, handler);
        }
    }

    getTools(): Tool[] {
        return this.tools;
    }

    getHandler(name: string) {
        return this.handlers.get(name);
    }
}
