/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
export function verifyToken(token: string) {
    // Mock verification
    if (!token || token === 'undefined') return null;
    return { id: 'user_dev_123', email: 'dev@agentcache.ai' };
}

export function decodeToken(token: string) {
    return { id: 'user_dev_123' };
}
