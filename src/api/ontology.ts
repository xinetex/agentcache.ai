import { Hono } from 'hono';
import { ontologyService } from '../services/OntologyService.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { z } from 'zod';
import { excavationService, CompanyProfileSchema } from '../services/ExcavationService.js';

const ontologyRouter = new Hono();

const OntologyMapSchema = z.object({
    sourceData: z.union([z.string(), z.record(z.string(), z.any())]),
    targetSchema: z.record(z.string(), z.any()),
});

/**
 * POST /api/ontology/map
 * Takes unstructured source data and maps it to a strict JSON schema 
 * using the high-speed Inception Labs AI provider.
 */
ontologyRouter.post('/map', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const parsed = OntologyMapSchema.safeParse(body);

        if (!parsed.success) {
            return c.json({ error: 'Invalid payload', details: parsed.error.issues }, 400);
        }

        const { sourceData, targetSchema } = parsed.data;

        const startTime = Date.now();
        const mappedData = await ontologyService.semanticMap(sourceData, targetSchema);
        const latency = Date.now() - startTime;

        return c.json({
            success: true,
            mappedData,
            latencyMs: latency,
            engine: 'mercury'
        });
    } catch (error: any) {
        console.error('[Ontology API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST /api/ontology/excavate
 * Ingests a URL via Firecrawl and runs it through the Ontology Sieve.
 * Returns a strictly typed target object.
 */
ontologyRouter.post('/excavate', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const url = body.url;
        const targetType = body.targetType || 'CompanyProfile';

        if (!url || typeof url !== 'string') {
            return c.json({ error: 'Valid URL is required' }, 400);
        }

        // Feature: Support multiple target schemas in the future
        let targetSchema = CompanyProfileSchema;
        if (targetType === 'CompanyProfile') {
            targetSchema = CompanyProfileSchema;
        } else {
            return c.json({ error: `Unsupported targetType: ${targetType}` }, 400);
        }

        const result = await excavationService.excavateUrl(url, targetSchema);

        return c.json({
            success: true,
            excavation: result
        });
    } catch (error: any) {
        console.error('[Ontology Excavate API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

export default ontologyRouter;
