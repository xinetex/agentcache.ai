
import { Hono } from 'hono';
import { CortexBridge } from '../../services/CortexBridge.js';
import { redis } from '../../lib/redis.js';

const cortexRouter = new Hono();
const bridge = new CortexBridge();

cortexRouter.get('/stats', async (c) => {
    try {
        const stats = await bridge.getStats();
        return c.json(stats);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

cortexRouter.get('/synapses', async (c) => {
    try {
        // Fetch last 20 entries from stream
        const raw = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 20);
        
        const synapses = raw.map(([id, fields]) => {
            const entry: any = { id };
            for (let i = 0; i < fields.length; i += 2) {
                entry[fields[i]] = fields[i+1];
            }
            // Parse JSON fields if they exist
            if (entry.data) try { entry.data = JSON.parse(entry.data); } catch(e) {}
            if (entry.entities) try { entry.entities = JSON.parse(entry.entities); } catch(e) {}
            if (entry.relations) try { entry.relations = JSON.parse(entry.relations); } catch(e) {}
            return entry;
        });

        return c.json(synapses);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { cortexRouter };
