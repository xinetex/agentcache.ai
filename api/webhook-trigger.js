
const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) return null;
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    try {
        const res = await fetch(`${url}/${path}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.result;
    } catch (e) {
        return null;
    }
}

export const config = {
    runtime: 'nodejs',
};

export async function triggerWebhook(userHash, eventType, payload) {
    try {
        // 1. Get Webhook URL for user
        const webhookUrl = await redis('HGET', `user:${userHash}`, 'webhookUrl');

        if (!webhookUrl) return { triggered: false, reason: 'no_url' };

        // 2. Fire Webhook
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-AgentCache-Event': eventType
            },
            body: JSON.stringify({
                event: eventType,
                timestamp: new Date().toISOString(),
                data: payload
            })
        });

        return { triggered: true, status: res.status };

    } catch (err) {
        console.error('Webhook trigger failed:', err);
        return { triggered: false, error: err.message };
    }
}
