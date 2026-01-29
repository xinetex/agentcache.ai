
import { Hono } from 'hono';
import { LLMFactory } from '../lib/llm/factory.js';

const pipelineRouter = new Hono();

/**
 * POST /api/pipeline/generate
 * Generates what looks like an intelligent caching pipeline configuration using Kimi (Moonshot).
 * Returns the "reasoning_content" (Thinking Process) alongside the JSON pipeline.
 */
pipelineRouter.post('/generate', async (c) => {
    try {
        const body = await c.req.json();
        const { prompt, sector, performance } = body;

        // Construct a prompt that asks for a JSON response
        // and leverages Kimi's reasoning capabilities.
        const systemPrompt = `You are a System Architect Expert specializing in High-Performance Computing and Edge Caching.
Your goal is to design an "AgentCache Pipeline" based on the user's requirements.

A Pipeline consists of Nodes (Source, Cache, LLM, Router) and Edges (Connections).

Output valid JSON matching this structure:
{
  "name": "string",
  "description": "string",
  "nodes": [
    { "id": "string", "type": "string", "position": { "x": number, "y": number }, "data": { "label": "string", "details": "string" } }
  ],
  "edges": [
    { "id": "string", "source": "string", "target": "string" }
  ],
  "estimatedSavings": "string (e.g. '$500/mo')",
  "complexity": "string"
}

Provide a detailed, logical reasoning process before generating the JSON.
Explain *why* you chose specific cache layers (L1 vs L2), validation controls, or routing logic.
`;

        const userMessage = `Sector: ${sector || 'General'}
Performance Goal: ${performance || 'Balanced'}
User Request: ${prompt}

Design the optimal pipeline.`;

        // Create Moonshot Provider
        // defaults to 'moonshot-v1-8k' if not specified, but we want K2.5 if available
        // The factory or provider handles the model selection or we pass it.
        const llm = LLMFactory.createProvider('moonshot');

        const response = await llm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ], {
            model: 'moonshot-v1-8k', // Or 'moonshot-v1-32k' / 'kimi-k2' depending on what's supported
            temperature: 0.3
        });

        // Extract JSON from content (it might be wrapped in backticks)
        let jsonContent = response.content;
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonContent = jsonMatch[0];
        }

        let pipeline;
        try {
            pipeline = JSON.parse(jsonContent);
        } catch (e) {
            console.error("Failed to parse pipeline JSON", e);
            // Fallback
            pipeline = {
                name: "Error Generating Pipeline",
                description: "Could not parse AI response",
                nodes: [],
                edges: []
            };
        }

        return c.json({
            success: true,
            pipeline,
            reasoning: response.metadata?.reasoning_content || "No reasoning trace provided.",
            raw: response.content
        });

    } catch (error: any) {
        console.error('[Pipeline] Generation Error:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default pipelineRouter;
