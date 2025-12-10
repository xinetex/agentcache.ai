import { Hono } from 'hono';
import { db } from '../db/client.js';
import { patterns } from '../db/schema.js';
import { desc, like } from 'drizzle-orm';

const geoRouter = new Hono();

// NYC Center
const CENTER = { lat: 40.7128, lon: -74.0060 };

/**
 * GET /nodes
 * Returns active patterns as geospatial points.
 */
geoRouter.get('/nodes', async (c) => {
    try {
        const allPatterns = await db.select().from(patterns);

        const nodes = allPatterns.map((p, index) => {
            // Deterministic pseudo-random location based on ID
            const hash = p.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

            let lat, lon, type;

            if (p.name.includes('Traffic')) {
                // Grid layout for traffic sensors
                const offset = (index * 0.005);
                lat = CENTER.lat + (Math.sin(offset) * 0.02);
                lon = CENTER.lon + (Math.cos(offset) * 0.02);
                type = 'sensor';
            } else {
                // Scatter for organic agents
                const randLat = ((hash % 100) / 1000) - 0.05;
                const randLon = (((hash * 13) % 100) / 1000) - 0.05;
                lat = CENTER.lat + randLat;
                lon = CENTER.lon + randLon;
                type = 'agent';
            }

            return {
                id: p.id,
                name: p.name,
                type: type,
                coordinates: [lon, lat], // GeoJSON is [lon, lat]
                value: p.energyLevel || 1, // Determines height/radius
                intent: p.intent
            };
        });

        return c.json(nodes);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /arcs
 * Returns flows between nodes (Neural Pipeline visualization)
 */
geoRouter.get('/arcs', async (c) => {
    // Mocking connections for the "Pipeline" visual
    // In a real version, we'd query a 'pattern_interactions' table

    const nodes = (await db.select().from(patterns)).slice(0, 10); // get a few
    const arcs = [];

    for (let i = 0; i < nodes.length - 1; i++) {
        const source = nodes[i];
        const target = nodes[i + 1];

        // Generate coords (same logic as above to match)
        const getCoords = (p: any, idx: number) => {
            const hash = p.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
            if (p.name.includes('Traffic')) {
                const offset = (idx * 0.005);
                return [CENTER.lon + (Math.cos(offset) * 0.02), CENTER.lat + (Math.sin(offset) * 0.02)];
            }
            const randLat = ((hash % 100) / 1000) - 0.05;
            const randLon = (((hash * 13) % 100) / 1000) - 0.05;
            return [CENTER.lon + randLon, CENTER.lat + randLat];
        };

        const sourceCoords = getCoords(source, i);
        const targetCoords = getCoords(target, i + 1);

        arcs.push({
            source: sourceCoords,
            target: targetCoords,
            value: Math.random() * 10,
            type: 'pipeline_flow'
        });
    }

    return c.json(arcs);
});

export { geoRouter };
