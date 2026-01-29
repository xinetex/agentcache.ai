/** Updated Brain API: Routes AI requests to Moonshot via Vercel AI Gateway
 *  
 * This replaces AutoMem proxy with direct Moonshot(Kimi) processing
 * to fix the OpenAI quota issues affecting audio1.tv playback
 **/

import { Hono } from 'hono';

// Switch from AutoMem to Vercel AI Gateway with Moonshot (Kimi)
const VERCEL_AI_GATEWAY = 'https://api.vercel.com/drgnflai-jetty/ai-gateway';
const AI_MODEL = 'moonshotai/kimi-k2';
const AGENT_ID = 'agentcache_ai_bridge';


const brainRouter = new Hono();

/**
 * Process AI requests through Vercel AI Gateway with Moonshot instead of AutoMem
 */
const processWithMoonshot = async (c: any, path: string, body: any) => {
    // Prepare request for Moonshot processing
    const messages = [
        {
            role: 'system',
            content: `You are AgentCache specializing in ${path.includes('audio') ? 'audio' : path.includes('video') ? 'video' : 'general'} content analysis and processing. 
Your role: Process this content accurately, extract key insights, and provide intelligent responses. Focus on accuracy and detail.`
        },
        {
            role: 'user',
            content: [path, JSON.stringify(body)].join(' || ')
        }
    ];

    // Route through Vercel AI Gateway to Moonshot
    const response = await fetch(`${VERCEL_AI_GATEWAY}/moonshotai/kimi-k2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VERCEL_AI_GATEWAY_KEY}`
        },
        body: JSON.stringify({
            messages,
            model: AI_MODEL,
            max_tokens: 8000,
            temperature: 0.2,
            seed: Math.floor(Math.random() * 1000000)
        })
    });

    if (!response.ok) {
        throw new Error(`AI Gateway Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return {
        result: result.choices?.[0]?.message?.content || '',
        reasoning_content: result.choices?.[0]?.message?.reasoning_content || null,
        provider: 'vercel-ai-gateway',
        model: 'moonshotai/kimi-k2',
        source: 'brain-api'
    };
};

/**
 * Proxy middleware updated to use Vercel AI Gateway
 */
const proxyToAIGateway = async (c: any, path: string) => {
    const method = c.req.method;
    const url = c.req.url;

    // Prepare request body if needed
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
        body = await c.req.json();
    }

    // Route through Vercel AI Gateway instead of AutoMem
    try {
        const result = await processWithMoonshot(c, path, body);

        return c.json({
            success: true,
            data: result.result,
            metadata: {
                provider: result.provider,
                model: result.model,
                source: 'agentcache',
                agentId: AGENT_ID,
                timestamp: new Date().toISOString(),
                reasoning_content: result.reasoning_content
            }
        });
    } catch (error: any) {
        return c.json({
            success: false,
            error: error.message,
            fallback: true
        }, 500);
    }
};

// Health check endpoint
brainRouter.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        provider: 'moonshotai',
        model: AI_MODEL,
        source: 'vercel-ai-gateway'
    });
});

brainRouter.all('/*', async (c) => {
    return await proxyToAIGateway(c, c.req.path);
});

export default brainRouter;