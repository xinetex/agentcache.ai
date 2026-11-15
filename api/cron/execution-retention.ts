import { executionRetentionService } from '../../src/services/ExecutionRetentionService.js';

export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await executionRetentionService.purgeExpired();
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[ExecutionRetention] Purge failed:', error?.message || 'unknown_error');
    return res.status(500).json({ success: false, error: 'execution_retention_failed' });
  }
}
