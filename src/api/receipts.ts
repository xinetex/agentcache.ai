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
import { sharedReceiptService } from '../services/SharedReceiptService.js';

type Variables = {
  apiKey: string;
  principalId?: string;
};

const router = new Hono<{ Variables: Variables }>();

router.post('/ingest', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const result = await sharedReceiptService.ingest(body, {
      apiKey: c.get('apiKey'),
      principalId: c.get('principalId'),
    });

    return c.json({
      success: true,
      duplicate: result.duplicate,
      receiptId: result.stored.receipt.receiptId,
      receiptHash: result.stored.receiptHash,
      signatureStatus: result.stored.signatureStatus,
      ingestedAt: result.stored.ingestedAt,
    }, result.duplicate ? 200 : 201);
  } catch (err: any) {
    const message = err?.message || 'Failed to ingest shared receipt.';
    const status = message.includes('Invalid shared receipt')
      ? 400
      : message.includes('signature is invalid')
        ? 401
        : message.includes('Receipt ID conflict')
          ? 409
          : 500;
    return c.json({ error: message }, status);
  }
});

router.get('/summary', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const summary = await sharedReceiptService.getSummary({
      producerSystem: c.req.query('producerSystem'),
      subjectKind: c.req.query('subjectKind'),
      sectorId: c.req.query('sectorId'),
      verdict: c.req.query('verdict'),
      limit: Number(c.req.query('limit') || 100),
    });

    return c.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to load receipt summary.' }, 500);
  }
});

router.get('/:receiptId', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const receiptId = c.req.param('receiptId');
    const stored = await sharedReceiptService.get(receiptId);
    if (!stored) {
      return c.json({ error: 'Receipt not found.' }, 404);
    }

    return c.json({
      success: true,
      receipt: stored.receipt,
      receiptHash: stored.receiptHash,
      signatureStatus: stored.signatureStatus,
      ingestedAt: stored.ingestedAt,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to load receipt.' }, 500);
  }
});

router.get('/', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const receipts = await sharedReceiptService.list({
      producerSystem: c.req.query('producerSystem'),
      subjectKind: c.req.query('subjectKind'),
      sectorId: c.req.query('sectorId'),
      verdict: c.req.query('verdict'),
      limit: Number(c.req.query('limit') || 25),
    });

    return c.json({
      success: true,
      receipts,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to list receipts.' }, 500);
  }
});

export default router;
