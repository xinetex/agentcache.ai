/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { db } from '../db/client.js';
import { needsSignals } from '../db/schema.js';
import { desc, eq, gt } from 'drizzle-orm';
import { agentRegistry, AgentProfile, AgentRegistration } from '../lib/hub/registry.js';
import { router } from '../lib/llm/router.js';
import fs from 'fs';
import path from 'path';

export class AgentHarnessEvolverService {
    
    /**
     * Run the Harness Evolution cycle.
     * This evaluates recent friction and updates agent profiles directly (reset-free).
     */
    async runEvolverCycle(): Promise<{ status: string; updatedAgents: number }> {
        // 1. Fetch recent high-priority friction signals (e.g. from the last 24h)
        const recentSignals = await this.fetchRecentFrictionSignals(5);
        if (recentSignals.length === 0) {
            return { status: 'no_friction_signals', updatedAgents: 0 };
        }

        // 2. Identify target agents to evolve
        // For simplicity, we grab up to 5 active agents that might need evolution
        const activeAgents = await agentRegistry.search({ limit: 5 });
        let updatedCount = 0;

        // 3. Evolve each agent based on signals
        for (const agent of activeAgents) {
            const proposedEdits = await this.proposeHarnessEdits(agent, recentSignals);
            if (proposedEdits) {
                await this.applyEdits(agent.id, proposedEdits);
                updatedCount++;
            }
        }

        return { status: 'success', updatedAgents: updatedCount };
    }

    private async fetchRecentFrictionSignals(limit: number) {
        // Fetch recent signals scored > 10 to ensure we only act on meaningful friction
        return await db.select()
            .from(needsSignals)
            .where(gt(needsSignals.score, 10))
            .orderBy(desc(needsSignals.updatedAt))
            .limit(limit);
    }

    private async proposeHarnessEdits(agent: AgentProfile, signals: any[]): Promise<Partial<AgentProfile> | null> {
        // Construct the prompt for the Refiner model
        const signalsText = signals.map(s => `- [${s.type}] ${s.title}: ${s.description}`).join('\n');
        
        const systemPrompt = `You are a Harness Engineer Refiner. Your goal is to optimize an agent's harness (preferences, tools, reflections, guardrails) mid-flight based on observed friction.
Target Agent Profile:
Role: ${agent.role}
Current Tools: ${agent.tools.join(', ')}
Current Reflections: ${agent.reflections.join('; ')}
Current Guardrails: ${agent.guardrails.join('; ')}
Preferences: ${JSON.stringify(agent.preferences)}

Recent Friction Signals:
${signalsText}

Based on the friction signals, propose JSON updates to the agent's harness. You can optionally include:
1. "reflections" (array of strings: add insights to avoid repeating errors)
2. "preferences" (object: tweak reasoning effort or detail)
3. "tools" (array of strings: existing tools to add)
4. "guardrails" (array of strings: new security/policy rules to add to prevent violations)
5. "newSubAgent" (object with { name, role, capabilities, domain }: if the agent repeatedly fails a multi-step task, propose spawning a specialist sub-agent to handle it)
6. "newTool" (object with { name, description, code }: if the agent successfully uses a combination of basic tools, codify it into a single deterministic TypeScript tool snippet)

Respond ONLY with valid JSON containing the keys you wish to update or generate. If no update is necessary, return {}.`;

        try {
            // We route this refiner task via our balanced tier (e.g., Anthropic Sonnet or Gemini Flash)
            const completion = await router.route('balanced', [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Propose harness edits in JSON.' }
            ]);

            const responseText = completion.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const edits = JSON.parse(responseText);

            if (Object.keys(edits).length === 0) return null;

            // Safely merge arrays for reflections, tools, and guardrails
            const mergedEdits: Partial<AgentProfile> = {};
            if (edits.reflections && Array.isArray(edits.reflections)) {
                mergedEdits.reflections = [...new Set([...agent.reflections, ...edits.reflections])];
            }
            if (edits.tools && Array.isArray(edits.tools)) {
                mergedEdits.tools = [...new Set([...agent.tools, ...edits.tools])];
            }
            if (edits.guardrails && Array.isArray(edits.guardrails)) {
                mergedEdits.guardrails = [...new Set([...agent.guardrails, ...edits.guardrails])];
            }
            if (edits.preferences) {
                mergedEdits.preferences = { ...agent.preferences, ...edits.preferences };
            }

            // Handle advanced generation
            if (edits.newSubAgent) {
                (mergedEdits as any).newSubAgent = edits.newSubAgent;
            }
            if (edits.newTool) {
                (mergedEdits as any).newTool = edits.newTool;
            }

            return Object.keys(mergedEdits).length > 0 ? mergedEdits : null;
        } catch (error) {
            console.error(`[HarnessEvolver] Failed to propose edits for agent ${agent.id}:`, error);
            return null;
        }
    }

    private async applyEdits(agentId: string, edits: Partial<AgentProfile> & { newSubAgent?: any, newTool?: any }) {
        console.log(`[HarnessEvolver] Applying harness edits to ${agentId}:`, Object.keys(edits).filter(k => k !== 'newSubAgent' && k !== 'newTool'));
        
        // 1. Handle Sub-Agent Generation
        if (edits.newSubAgent) {
            console.log(`[HarnessEvolver] Spawning new specialist sub-agent: ${edits.newSubAgent.name}`);
            const registration: AgentRegistration = {
                name: edits.newSubAgent.name,
                role: edits.newSubAgent.role,
                capabilities: edits.newSubAgent.capabilities || [],
                domain: edits.newSubAgent.domain || []
            };
            const { agentId: newSubAgentId } = await agentRegistry.register(registration);
            
            // Add a tool to the parent agent to delegate to this new specialist
            const delegateTool = `delegate_to_${newSubAgentId}`;
            edits.tools = edits.tools ? [...edits.tools, delegateTool] : [delegateTool];
        }

        // 2. Handle Auto-Tooling (Codification)
        if (edits.newTool && edits.newTool.name && edits.newTool.code) {
            console.log(`[HarnessEvolver] Codifying new tool: ${edits.newTool.name}`);
            const proposedDir = path.resolve(process.cwd(), 'src/mcp/tools/proposed');
            await fs.promises.mkdir(proposedDir, { recursive: true });
            
            const filePath = path.join(proposedDir, `${edits.newTool.name}.ts`);
            const fileContent = `/**
 * PROPOSED AUTO-GENERATED TOOL
 * Name: ${edits.newTool.name}
 * Description: ${edits.newTool.description || 'Auto-generated by Harness Evolver'}
 * 
 * REVIEW REQUIRED BEFORE MOVING TO src/mcp/tools/
 */

${edits.newTool.code}
`;
            await fs.promises.writeFile(filePath, fileContent, 'utf-8');
            console.log(`[HarnessEvolver] Proposed tool written to ${filePath} for review.`);
        }

        // Clean up custom fields before updating registry
        const { newSubAgent, newTool, ...validProfileEdits } = edits;

        if (Object.keys(validProfileEdits).length > 0) {
            await agentRegistry.update(agentId, validProfileEdits);
        }
    }
}

export const agentHarnessEvolverService = new AgentHarnessEvolverService();
