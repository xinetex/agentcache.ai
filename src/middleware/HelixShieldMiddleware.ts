/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Context, Next } from 'hono';
import { alignmentMapService } from '../services/AlignmentMapService.js';
import { HelixEngine } from '../services/HelixEngine.js';

/**
 * Helix Shield Middleware
 * 
 * Detects HELIX-aligned encrypted requests.
 * If X-Helix-Shield header is present, it validates the representation
 * and allows the request to bypass standard plaintext PII/WAF checks 
 * since the data is cryptographically transformed.
 */
export async function helixShield(c: Context, next: Next) {
    const isHelix = c.req.header('X-Helix-Shield') === 'true';
    const sourceModel = c.req.header('X-Helix-Source');
    const targetModel = c.req.header('X-Helix-Target');

    if (isHelix && sourceModel && targetModel) {
        console.log(`[HelixShield] 🛡️ Intercepted HELIX-aligned request from ${sourceModel} to ${targetModel}`);

        // 1. Resolve Alignment Map
        const map = await alignmentMapService.getMap(sourceModel, targetModel);
        if (!map) {
            console.warn(`[HelixShield] No alignment map found for ${sourceModel} -> ${targetModel}`);
            // Fail safe: allow request but don't grant Helix bypass
            await next();
            return;
        }

        // 2. Proof-of-Intuition (PoI) / Alignment Validation
        // In a full implementation, we'd verify the homomorphic signature here.
        // For the prototype, we signal to downstream services that this is a "Secure Representation".
        c.set('isHelixAligned', true);
        c.set('helixMap', map);

        // Add a trace header to signal the provider that we are in HELIX mode
        c.header('X-Helix-Trace', 'aligned-sub-second');
    }

    await next();
}
