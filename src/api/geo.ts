import { Hono } from 'hono';
import { db } from '../db/client.js';
import { patterns } from '../db/schema.js';
import { desc, like } from 'drizzle-orm';
import { redis } from '../lib/redis.js';

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

        // Fetch Global Solar State
        const solarState = await redis.get('mesh:global:solar') || '1.0';

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

                // MESH CACHE LOOKUP
                // Try to get real-time state from Redis Mesh
                // Note: In a high-perf scenario we would use MGET for all IDs at start, but loop is fine for MVP.
                let cachedState = null;
                try {
                    const rawMesh = await redis.get(`mesh:node:${p.id}`);
                    if (rawMesh) cachedState = JSON.parse(rawMesh);
                } catch (e) { }

            } else {
                // Scatter for organic agents
                const randLat = ((hash % 100) / 1000) - 0.05;
                const randLon = (((hash * 13) % 100) / 1000) - 0.05;
                lat = CENTER.lat + randLat;
                lon = CENTER.lon + randLon;
                type = 'agent';
            }

            // Resolve Display Values (Cache > DB Default)
            const resolvedValue = (type === 'sensor' && cachedState) ? cachedState.density : (p.energyLevel || 1);
            const resolvedCamera = (type === 'sensor' && cachedState) ? cachedState.camera : null;

            return {
                id: p.id,
                name: p.name,
                type: type,
                coordinates: [lon, lat],
                value: resolvedValue,
                intent: p.intent,
                camera: resolvedCamera
            };
        });

        return c.json({
            nodes,
            meta: {
                solar: parseFloat(solarState)
            }
        });
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

/**
 * GET /flow
 * Returns active "Packet Flows" (Imitation Events) for the Pipeline Game
 */
geoRouter.get('/flow', async (c) => {
    try {
        // Fetch last 50 events from Redis List
        // These represent "Learning Packets" traveling source -> target
        const rawPackets = await redis.lrange('mesh:pipeline_flow', 0, 49);
        const packets = rawPackets.map(p => JSON.parse(p));

        // Enhance with coordinates
        // We need to resolve ID -> Coords.
        // For efficiency, we just re-calculate the deterministic coords for the IDs 
        // (This mirrors the client-side logic avoids a full DB lookup for coords)

        const resolveCoords = (id: string, nameHint: string = '') => {
            const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            // Since we don't have the full name here easily without DB query, 
            // we use a heuristic based on ID. 
            // Note: In prod we'd hydrate this properly.
            // For the Demo, we assume organic scatter unless we know better.
            const randLat = ((hash % 100) / 1000) - 0.05;
            const randLon = (((hash * 13) % 100) / 1000) - 0.05;
            return [CENTER.lon + randLon, CENTER.lat + randLat];
        };
        // NOTE: The above coordinate resolution is imperfect because we lack the "Traffic" grid logic 
        // which depends on array index.
        // Better Approach: Frontend already has nodes. 
        // We just return IDs and let frontend map them to positions.

        return c.json(packets);
    } catch (e) {
        return c.json([]);
    }
});

export { geoRouter };
