
import { engine, WorkflowStep } from '../../src/lib/workflow/engine.js';
import { v4 as uuidv4 } from 'uuid';

export const config = { runtime: 'nodejs' };

/**
 * POST /api/pipelines/run
 * Trigger a workflow execution.
 */
export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const body = await req.json();
        const { pipelineId, steps } = body;

        // If no steps provided, use a default demo sequence
        const demoSteps: WorkflowStep[] = steps || [
            { id: 's1', name: 'Data Ingestion', action: 'search', params: { query: 'Q3 Financials' } },
            { id: 's2', name: 'Risk Analysis', action: 'audit', params: {} },
            { id: 's3', name: 'Report Generation', action: 'summarize', params: {} }
        ];

        const runId = uuidv4();

        // In a real system, we'd push this to a queue (Redis/Bull)
        // For this MVP, we await it (blocking) or fire-and-forget
        // Let's await it so the user sees the result immediately in the response,
        // or we could return a "Running" status.

        const context = await engine.runWorkflow(runId, demoSteps);

        return new Response(JSON.stringify({
            success: true,
            runId,
            status: 'completed',
            results: context.results,
            logs: context.logs
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
