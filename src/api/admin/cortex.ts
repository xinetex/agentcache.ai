
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
        const raw = await redis.lrange('cortex:stream:synapses', 0, 19);
        const synapses = raw.map(s => JSON.parse(s));
        return c.json(synapses);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { cortexRouter };
