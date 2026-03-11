/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { app } from './index.js';
import { serve } from '@hono/node-server';

const PORT = process.env.PORT || 3001;

console.log(`🚀 AgentCache.ai MVP starting on port ${PORT}`);

serve({
    fetch: app.fetch,
    port: Number(PORT),
});
