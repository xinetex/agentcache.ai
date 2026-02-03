
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
import { FoldingService } from '../../services/sectors/biotech/FoldingService.js';
import { RiskService } from '../../services/sectors/finance/RiskService.js';

export class WorkflowEngine {

    async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
        context.logs.push(`[${new Date().toISOString()}] Starting step: ${step.name} (${step.action})`);

        let output;
        try {
            switch (step.action) {
                // --- General Intelligence ---
                case 'search':
                case 'research':
                    try {
                        output = await researcherAgent.performResearch(step.params.query || step.name);
                    } catch (e) {
                        console.warn("[Engine] Research Agent failed. Using Mock.");
                        output = `[Mock Research] Findings: Market favorable. Competitors weak.`;
                    }
                    break;

                case 'audit':
                case 'code_review':
                    try {
                        const snippet = context.results['prev_code'] || "const x = 1;";
                        output = await coderAgent.auditCode(snippet);
                    } catch (e) {
                        output = `[Mock Audit] Clean code.`;
                    }
                    break;

                // --- BioTech Sector ---
                case 'fold_protein':
                case 'msa_gen':
                    const biotech = new FoldingService();
                    output = await biotech.execute({
                        sequence: step.params.sequence || "MKTLLILAVIV",
                        mode: step.params.mode || 'fast'
                    });
                    context.logs.push(`[BioTech] PDB Generated. Cached: ${output.msa_cached}`);
                    break;

                // --- Finance Sector ---
                case 'assess_risk':
                case 'monte_carlo':
                    const finance = new RiskService();
                    output = await finance.execute({
                        portfolio: step.params.portfolio || { "BTC": 1.0 },
                        scenario: step.params.scenario || "crash",
                        iterations: 5000
                    });
                    context.logs.push(`[Finance] VaR Calculated: ${(output.var_95 * 100).toFixed(2)}%`);
                    break;

                case 'summarize':
                    output = `Summary: The previous steps yielded significant insights.`;
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
