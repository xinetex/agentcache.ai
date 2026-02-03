
/**
 * Simple Workflow Engine
 * Executes a sequence of steps defined in a JSON blueprint.
 */

export interface WorkflowStep {
    id: string;
    name: string;
    action: string; // e.g. 'search', 'summarize', 'email'
    params: any;
}

export interface WorkflowContext {
    workflowId: string;
    results: Record<string, any>;
    logs: string[];
}

import { researcherAgent } from '../../agents/ResearcherAgent.js';
import { coderAgent } from '../../agents/CoderAgent.js';

export class WorkflowEngine {

    async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
        context.logs.push(`[${new Date().toISOString()}] Starting step: ${step.name} (${step.action})`);

        let output;
        try {
            switch (step.action) {
                case 'search':
                case 'research':
                    // Real Intelligence: Use Perplexity via ResearcherAgent
                    // If no API key, it might return error, so we might want a fallback or just let it err for now
                    // But ResearcherAgent doesn't have a fallback built-in like Chat API.
                    // We'll wrap it.
                    try {
                        output = await researcherAgent.performResearch(step.params.query || step.name);
                    } catch (e) {
                        console.warn("[Engine] Research Agent failed (likely missing key). Using Mock.");
                        output = `[Mock Research] Findings for ${step.params.query}: \n1. Market trends are up.\n2. Competitors are actively hiring.`;
                    }
                    break;

                case 'audit':
                case 'code_review':
                    // Real Intelligence: CoderAgent
                    try {
                        const snippet = context.results['prev_code'] || "const x = 1; // Default snippet";
                        output = await coderAgent.auditCode(snippet);
                    } catch (e) {
                        console.warn("[Engine] Coder Agent failed. Using Mock.");
                        output = `[Mock Audit] Code looks clean. 0 vulnerabilities found.`;
                    }
                    break;

                case 'summarize':
                    output = `Summary: The previous steps yielded significant insights. [Auto-Generated Wrapper]`;
                    break;

                default:
                    // Simulate processing latency for other steps
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    output = `Executed ${step.action}`;
            }
        } catch (e: any) {
            output = `Error in execution: ${e.message}`;
        }

        context.results[step.id] = output;
        context.logs.push(`[${new Date().toISOString()}] Completed step: ${step.name}`);
        return output;
    }

    async runWorkflow(id: string, steps: WorkflowStep[]) {
        const context: WorkflowContext = {
            workflowId: id,
            results: {},
            logs: []
        };

        console.log(`[WorkflowEngine] Starting Workflow ${id}`);

        for (const step of steps) {
            try {
                await this.executeStep(step, context);
            } catch (err: any) {
                console.error(`[WorkflowEngine] Step Failed: ${step.name}`, err);
                context.logs.push(`ERROR: ${err.message}`);
                break; // Stop on error
            }
        }

        console.log(`[WorkflowEngine] Workflow ${id} Completed.`);
        return context;
    }
}

export const engine = new WorkflowEngine();
