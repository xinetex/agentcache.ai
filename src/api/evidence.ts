/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { Hono } from 'hono';
import { authenticateApiKey } from '../middleware/auth.js';
import { evidencePackService } from '../services/EvidencePackService.js';
import { sharedReceiptService } from '../services/SharedReceiptService.js';

type Variables = {
  apiKey: string;
  principalId?: string;
};

const router = new Hono<{ Variables: Variables }>();

router.post('/packs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const result = await evidencePackService.submitPack(body);
    const receiptResult = await sharedReceiptService.ingest(result.pack.receipt, {
      apiKey: c.get('apiKey'),
      principalId: c.get('principalId'),
    });

    return c.json({
      success: true,
      duplicate: result.duplicate,
      pack: result.pack,
      receiptId: receiptResult.stored.receipt.receiptId,
      receiptHash: receiptResult.stored.receiptHash,
      signatureStatus: receiptResult.stored.signatureStatus,
      ingestedAt: receiptResult.stored.ingestedAt,
    }, result.duplicate ? 200 : 201);
  } catch (err: any) {
    const message = err?.message || 'Failed to create evidence pack.';
    const status = message.includes('required') || message.includes('limited to')
      ? 400
      : message.includes('conflict')
        ? 409
        : 500;
    return c.json({ error: message }, status);
  }
});

router.get('/packs/:packId', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const pack = await evidencePackService.getPack(c.req.param('packId'));
    if (!pack) {
      return c.json({ error: 'Evidence pack not found.' }, 404);
    }

    return c.json({
      success: true,
      pack,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to load evidence pack.' }, 500);
  }
});

router.get('/packs', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const packs = await evidencePackService.listPacks({
      verdict: c.req.query('verdict'),
      sectorId: c.req.query('sectorId'),
      namespace: c.req.query('namespace'),
      limit: Number(c.req.query('limit') || 25),
    });

    return c.json({
      success: true,
      count: packs.length,
      packs,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to list evidence packs.' }, 500);
  }
});

export default router;
