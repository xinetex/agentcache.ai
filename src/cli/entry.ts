/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import 'dotenv/config';
import { cli } from './index.js';

cli(process.argv).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
