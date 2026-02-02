
import { Hono } from 'hono';
import { ArmorService } from '../../services/ArmorService.js';

const armorRouter = new Hono();
const armor = new ArmorService();

armorRouter.get('/stats', async (c) => {
    try {
        const stats = await armor.getStats();
        return c.json(stats);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { armorRouter };
