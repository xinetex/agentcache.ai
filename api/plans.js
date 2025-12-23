
import { db } from '../src/db/client.js';
import { planTemplates, cachedPlanExecutions } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

// Simple hash function for demo (in prod use crypto)
function hash(str) {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
        result = ((result << 5) - result) + str.charCodeAt(i);
        result |= 0;
    }
    return result.toString(16);
}

export default async function handler(req) {
    const url = new URL(req.url);
    // Extract relative path if hosted on deeper route, logic depends on router
    // Assuming this handler gets requests starting with /api/plans
    let path = url.pathname;
    if (path.startsWith('/api/plans')) {
        path = path.replace('/api/plans', '');
    }

    // POST /template - Create a Plan Template
    if (req.method === 'POST' && (path === '/template' || path === '/template/')) {
        try {
            const body = await req.json();
            const { name, description, sector, steps } = body;

            if (!name || !steps) return json({ error: 'Name and steps are required' }, 400);

            const result = await db.insert(planTemplates).values({
                name, description, sector, steps
            }).returning();

            return json({ success: true, template: result[0] });
        } catch (e) {
            console.error('Plan template error:', e);
            return json({ error: e.message }, 500);
        }
    }

    // POST /execute - Check/Cache Execution
    if (req.method === 'POST' && (path === '/execute' || path === '/execute/')) {
        try {
            const body = await req.json();
            const { templateId, inputs, executionTrace } = body;

            if (!inputs) return json({ error: 'inputs required' }, 400);

            // Generate Hashes
            const planHash = templateId || 'ad-hoc';
            const inputHash = hash(JSON.stringify(inputs));

            // Check cache
            const cached = await db.query.cachedPlanExecutions.findFirst({
                where: and(
                    eq(cachedPlanExecutions.planHash, planHash),
                    eq(cachedPlanExecutions.inputHash, inputHash)
                )
            });

            if (cached) {
                return json({
                    hit: true,
                    trace: cached.executionTrace,
                    saved: {
                        tokens: cached.tokensSaved,
                        cost: cached.costSaved,
                        latency_ms: cached.latencyMs
                    }
                });
            }

            // Miss - If trace provided, save it (Cache-Aside)
            if (executionTrace) {
                const result = await db.insert(cachedPlanExecutions).values({
                    templateId: templateId || null,
                    planHash,
                    inputHash,
                    executionTrace,
                    tokensSaved: Math.floor(Math.random() * 2000) + 500, // Simulated logic
                    costSaved: (Math.random() * 0.1).toFixed(4),
                    latencyMs: Math.floor(Math.random() * 500),
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
                }).returning();

                return json({ hit: false, cached: true, id: result[0].id });
            }

            return json({ hit: false, message: 'Not found. Provide executionTrace to cache.' }, 404);
        } catch (e) {
            console.error('Plan execution error:', e);
            return json({ error: e.message }, 500);
        }
    }

    // GET /:id - Get Template
    if (req.method === 'GET' && path.length > 1) {
        const id = path.slice(1);
        try {
            // Validate UUID format roughly
            if (id.length < 10) return json({ error: 'Invalid ID' }, 400);

            const template = await db.query.planTemplates.findFirst({
                where: eq(planTemplates.id, id)
            });

            if (!template) return json({ error: 'Not found' }, 404);
            return json(template);
        } catch (e) {
            console.error('Get plan error:', e);
            return json({ error: e.message }, 500);
        }
    }

    return json({ error: 'Method not allowed' }, 405);
}
