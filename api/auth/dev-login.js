
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { email } = await req.json();

        // 🟢 SIMULATION MODE: Always succeed for any email in dev
        // In production, this would verify password hash from DB
        const mockUser = {
            id: 'user_' + Math.random().toString(36).substr(2, 9),
            email: email || 'dev@agentcache.ai',
            role: 'admin',
            displayName: (email || 'Dev').split('@')[0],
            plan: 'pro'
        };

        const mockToken = 'dev_token_' + Date.now();

        return new Response(JSON.stringify({
            token: mockToken,
            user: mockUser
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
