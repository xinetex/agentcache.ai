
import { coderAgent } from '../../src/agents/CoderAgent.js';
import { LLMFactory } from '../../src/lib/llm/factory.js';

export const config = { runtime: 'nodejs' };

/**
 * POST /api/agent/chat
 * Unified Chat Endpoint
 */
export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const body = await req.json();
        const { message, agent = 'default', sessionId } = body;

        console.log(`[Chat] Request for agent: ${agent}`);

        let responseContent = "";
        let metrics = { latency: 0, cacheHit: false };
        const start = Date.now();

        // Helper to safe-call LLM
        const safeChat = async (providerCall: () => Promise<any>, fallbackText: string) => {
            try {
                const res = await providerCall();
                return res.content;
            } catch (err: any) {
                if (err.message.includes('API key missing')) {
                    console.warn(`[Chat] Missing API Key. Returning Demo Response.`);
                    return fallbackText + " (Demo Mode: API Key missing)";
                }
                throw err;
            }
        };

        // Dispatch to correct Agent
        if (agent === 'coder' || agent === 'code_auditor') {
            // Use Coder Agent (Anthropic)
            // Note: CoderAgent.auditCode is specialized, but we can expose a generic chat too?
            // For now, let's treat it as a chat interface to the same model.
            responseContent = await safeChat(
                () => coderAgent.model.chat([
                    { role: 'system', content: 'You are Coder_Alpha.' },
                    { role: 'user', content: message }
                ], { model: 'claude-3-5-sonnet-20240620' }),
                "The code looks solid, but could use better error handling. [Demo Audit]"
            );

        } else if (agent === 'sentinel') {
            // The Sentinel (Security/Logistics) - Uses Moonshot or GPT-4
            const model = LLMFactory.createProvider('moonshot');
            responseContent = await safeChat(
                () => model.chat([
                    { role: 'system', content: 'You are The Sentinel.' },
                    { role: 'user', content: message }
                ]),
                "I have detected no new anomalies in the sector. System is nominal. [Demo Sentinel]"
            );

        } else {
            // Default / General
            const model = LLMFactory.createProvider('openai');
            responseContent = await safeChat(
                () => model.chat([
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: message }
                ]),
                "I am here to help. Please configure your API keys to enable full intelligence. [Demo Agent]"
            );
        }

        metrics.latency = Date.now() - start;

        return new Response(JSON.stringify({
            message: responseContent,
            metrics
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error("[Chat API Error]", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
