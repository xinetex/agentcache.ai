import { app } from './index.js';
import { serve } from '@hono/node-server';

const PORT = process.env.PORT || 3001;

console.log(`🚀 AgentCache.ai MVP starting on port ${PORT}`);
console.log(`🎯 Demo API Key: ac_demo_test123`);

serve({
    fetch: app.fetch,
    port: Number(PORT),
});
