
export const config = { runtime: 'nodejs' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            },
        });
    }

    // Mock Team Data
    const members = [
        { id: 1, name: 'Alex (You)', email: 'alex@agentcache.ai', role: 'Admin', status: 'Active', initials: 'AL', color: 'blue' },
        { id: 2, name: 'Sarah Jenkins', email: 'sarah@agentcache.ai', role: 'Editor', status: 'Active', initials: 'SJ', color: 'gray' },
        { id: 3, name: 'Mike K.', email: 'mike@partner.com', role: 'Viewer', status: 'Invited', initials: 'MK', color: 'gray' },
        { id: 4, name: 'Bot-001', email: 'bot.001@system.ai', role: 'Agent', status: 'Active', initials: 'B1', color: 'emerald' }
    ];

    return new Response(JSON.stringify({ members }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
