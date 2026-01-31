import { Hono } from 'hono';

import { authenticateApiKey } from '../middleware/auth.js';
import { CognitiveEngine } from '../infrastructure/CognitiveEngine.js';

const securityRouter = new Hono();

let engine: CognitiveEngine | null = null;
function getEngine() {
  if (!engine) engine = new CognitiveEngine();
  return engine;
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

securityRouter.get('/health', async (c) => {
  return c.json({
    ok: true,
    service: 'security',
    injection_detection: {
      mode: process.env.MOONSHOT_API_KEY ? 'llm+heuristic' : 'heuristic',
    },
    timestamp: new Date().toISOString(),
  });
});

securityRouter.post('/check', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const body = await c.req.json().catch(() => ({} as any));
  const content = safeString(body.content ?? body.text);

  if (!content || content.trim().length < 2) {
    return c.json({ error: 'content is required (min 2 chars)' }, 400);
  }

  try {
    const result = await getEngine().detectInjection(content);

    // CognitiveEngine returns ValidationResult { valid, score, reason }
    return c.json({
      safe: !!result.valid,
      score: result.score,
      reason: result.reason,
    });
  } catch (error: any) {
    return c.json({
      error: 'Security check failed',
      message: error?.message || String(error),
    }, 500);
  }
});

export default securityRouter;
