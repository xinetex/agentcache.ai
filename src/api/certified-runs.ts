/** Certified Agent Runs / Trust Ledger API. Raw arguments/results are never persisted. */
import { Hono } from 'hono';
import { authenticateAdmin, authenticateApiKey } from '../middleware/auth.js';
import { certifiedRunService } from '../services/CertifiedRunService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';

const router = new Hono();

router.post('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  try {
    const result = await certifiedRunService.createRun(await c.req.json());
    const receipt = await sharedReceiptService.ingest(result.run.receipt, {
      apiKey: (c as any).get('apiKey'),
      principalId: (c as any).get('principalId'),
    });
    return c.json({ success: true, duplicate: result.duplicate, run: result.run, receiptId: receipt.stored.receipt.receiptId, receiptHash: receipt.stored.receiptHash }, result.duplicate ? 200 : 201);
  } catch (error: any) {
    const message = error?.message || 'Failed to create certified run.';
    const status = message.includes('required') || message.includes('limited') || message.includes('Invalid') ? 400 : message.includes('not found') ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

router.get('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  const runs = await certifiedRunService.listRuns(Number(c.req.query('limit') || 25));
  return c.json({ success: true, count: runs.length, runs });
});

router.get('/:runId', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;
  const run = await certifiedRunService.getRun(c.req.param('runId'));
  if (!run) return c.json({ error: 'Certified run not found.' }, 404);
  return c.json({ success: true, run });
});

async function decide(c: any, decision: 'approved' | 'rejected') {
  const authError = await authenticateAdmin(c);
  if (authError) return authError;
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await certifiedRunService.decideRun(c.req.param('runId'), decision, { decidedBy: body.decidedBy, note: body.note });
    const receipt = await sharedReceiptService.ingest(result.decisionReceipt, { principalId: body.decidedBy });
    return c.json({ success: true, run: result.run, receipt: receipt.stored });
  } catch (error: any) {
    const message = error?.message || `Failed to ${decision} certified run.`;
    return c.json({ error: message }, message.includes('not found') ? 404 : 409);
  }
}

router.post('/:runId/approve', (c) => decide(c, 'approved'));
router.post('/:runId/reject', (c) => decide(c, 'rejected'));

export default router;
