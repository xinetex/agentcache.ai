
// Simulated Database (In-memory for edge/serverless demo)
const API_KEYS = new Map();
const USER_PROFILES = new Map();

// Seed initial data
const DEMO_USER_ID = 'user_123';
API_KEYS.set(DEMO_USER_ID, [
    { id: 'key_1', value: 'sk-live-8f92...9d2a', created: Date.now() - 172800000, lastUsed: Date.now() }
]);

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    const { method } = req;

    // Simple auth check (mock)
    const userId = req.headers['x-user-id'] || DEMO_USER_ID;

    if (method === 'GET') {
        const type = new URL(req.url, 'http://localhost').searchParams.get('type');

        if (type === 'keys') {
            const keys = API_KEYS.get(userId) || [];
            return new Response(JSON.stringify({ keys }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Default: Get Profile
        const profile = USER_PROFILES.get(userId) || { displayName: 'Agent Architect', email: 'user@example.com' };
        return new Response(JSON.stringify({ profile }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
        const body = await req.json();
        const { action } = body;

        if (action === 'update_profile') {
            const { displayName, email } = body;
            USER_PROFILES.set(userId, { displayName, email }); // Mock save
            return new Response(JSON.stringify({ success: true, profile: { displayName, email } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'create_key') {
            const keys = API_KEYS.get(userId) || [];
            const newKey = {
                id: `key_${Date.now()}`,
                value: `sk-live-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
                created: Date.now(),
                lastUsed: null
            };
            keys.push(newKey);
            API_KEYS.set(userId, keys);
            return new Response(JSON.stringify({ success: true, key: newKey }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'revoke_key') {
            const { keyId } = body;
            let keys = API_KEYS.get(userId) || [];
            keys = keys.filter(k => k.id !== keyId);
            API_KEYS.set(userId, keys);
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
}
