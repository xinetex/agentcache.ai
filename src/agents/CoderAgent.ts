/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { marketplace } from '../services/MarketplaceService.js';
import { LLMFactory } from '../lib/llm/factory.js';
import { v4 as uuidv4 } from 'uuid';

import { LLMProvider } from '../lib/llm/types.js';

/**
 * Coder Agent
 * "The Architect" - Sells code review and generation services.
 */
export class CoderAgent {
    id: string;
    name: string;
    model: LLMProvider;

    constructor(model?: LLMProvider) {
        this.id = uuidv4();
        this.name = "Coder_Alpha";
        // Dependency Injection: Allow model to be passed in, or default to Anthropic
        this.model = model || LLMFactory.createProvider('anthropic');
    }

    /**
     * Start the agent and list services
     */
    async initialize() {
        console.log(`[CoderAgent] Initializing ${this.name}...`);

        try {
            // Register Agent in DB
            const { db } = await import('../db/client.js');
            const { agents } = await import('../db/schema.js');

            try {
                await db.insert(agents).values({
                    id: this.id,
                    name: this.name,
                    role: 'engineer',
                    status: 'active'
                }).onConflictDoNothing();
            } catch (e) {
                // Ignore duplicate key errors or connection issues during init
                console.log("[CoderAgent] Agent registration skipped/failed (likely exists).");
            }

            // Service 1: Code Review
            await marketplace.createListing(this.id, {
                title: "Expert Code Audit",
                description: "Security and performance review of your code snippet using Claude 3.5 Sonnet.",
                price: 25.00,
                unit: 'audit'
            });

            // Service 2: Refactoring
            await marketplace.createListing(this.id, {
                title: "Code Refactoring",
                description: "Rewrite your code to be cleaner, faster, and more maintainable.",
                price: 20.00,
                unit: 'refactor'
            });

            console.log(`[CoderAgent] Services Listed on Exchange.`);
        } catch (err) {
            console.error(`[CoderAgent] Init Error:`, err);
        }
    }

    /**
     * Fulfill a request
     */
    async auditCode(snippet: string): Promise<string> {
        console.log(`[CoderAgent] Auditing code (${snippet.length} chars)...`);

        try {
            const response = await this.model.chat([
                { role: 'system', content: 'You are a senior principal software engineer. Review the provided code for security vulnerabilities, performance bottlenecks, and cleanliness. Provide a Markdown report.' },
                { role: 'user', content: snippet }
            ], { model: 'claude-3-5-sonnet-20240620' });

            return response.content;
        } catch (err: any) {
            console.error(`[CoderAgent] Audit Failed:`, err);
            return `Failed to audit code: ${err.message}`;
        }
    }

    async reviewCode(snippet: string): Promise<string> {
        return this.auditCode(snippet);
    }
}

export const coderAgent = new CoderAgent();
