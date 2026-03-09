export function verifyToken(token: string) {
    // Mock verification
    if (!token || token === 'undefined') return null;
    return { id: 'user_dev_123', email: 'dev@agentcache.ai' };
}

export function decodeToken(token: string) {
    return { id: 'user_dev_123' };
}
