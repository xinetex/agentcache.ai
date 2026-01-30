import { Hono } from 'hono';

const bridge = new Hono();

/**
 * Bridge to Moonshot AI for all AI processing
 * Replaces AutoMem with Vercel AI Gateway/Moonshot
 */

const VERCEL_AI_GATEWAY = 'https://api.vercel.com/drgnflai-jetty/ai-gateway';
const AGENT_ID = 'audio1_ai_bridge';

/**
 * Bridge all AI requests to Moonshot
 */
bridge.all('/*', async (c) => {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are AgentCache specializing in audio and video content analysis, transcription, and intelligence.'
      },
      {
        role: 'user',
        content: c.req.method === 'GET' ? c.req.query('q') : JSON.stringify(await c.req.json())
      }
    ];

    // Route through Vercel AI Gateway to Moonshot (Kimi)
    const response = await fetch(`${VERCEL_AI_GATEWAY}/moonshotai/kimi-k2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VERCEL_AI_GATEWAY_KEY || process.env.MOONSHOT_API_KEY}`,
        'x-agentcache-id': AGENT_ID
      },
      body: JSON.stringify({
        messages,
        model: 'moonshotai/kimi-k2',
        max_tokens: 4000,
        temperature: 0.7,
        seed: Math.floor(Math.random() * 1000000)
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result.choices?.[0]?.message?.content || '';

    return c.json({
      success: true,
      result: generatedText,
      provider: 'vercel-ai-gateway',
      model: 'moonshotai/kimi-k2',
      agentId: AGENT_ID,
      timestamp: new Date().toISOString(),
      type: 'text',
      source: 'bridge'
    });

  } catch (error: any) {
    return c.json({ 
      success: false,
      error: error.message,
      fallback: true
    }, 500);
  }
});

export default bridge;