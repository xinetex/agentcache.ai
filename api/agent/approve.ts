// api/agent/approve.ts
//
// POST /api/agent/approve   { runId: string, decision: 'approve' | 'reject' }
//   Headers: Authorization: Bearer ac_...
//
// The async human-in-the-loop resume endpoint. A background agent paused by the
// governance gate (near budget, over the approval threshold, or flagged) waits
// on the `agent/run.approve` event; this webhook emits it, resuming (approve) or
// ending (reject) the run. This is what makes AgentCache a control plane for
// long-running agents rather than a request-time middleware.

import { inngest } from '../../src/inngest/client.js';
import { validateApiKey } from '../../lib/api-key-middleware.js';

export const config = { runtime: 'nodejs' };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' } });
}

async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (!apiKey || !apiKey.startsWith('ac_')) return json({ error: 'Unauthorized', message: 'Valid AgentCache API key required' }, 401);
    try { await validateApiKey(apiKey); } catch (e: any) { return json({ error: 'Unauthorized', message: e.message }, 401); }

    const body: any = (await req.json().catch(() => ({}))) || {};
    if (!body.runId) return json({ error: 'Bad Request', message: 'runId required' }, 400);
    const decision = body.decision === 'approve' ? 'approve' : 'reject';

    await inngest.send({ name: 'agent/run.approve', data: { runId: String(body.runId), decision, note: body.note || null } });
    return json({ ok: true, runId: body.runId, decision });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

export { handler as POST };
