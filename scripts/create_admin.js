import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) throw new Error('Upstash not configured');
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    const res = await fetch(`${url}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
}

async function createAdmin() {
    const adminKey = 'ac_admin_master_key_999';

    // Hash it
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(adminKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

    console.log('Creating Admin User...');
    console.log('Key:', adminKey);
    console.log('Hash:', hash);

    await redis('HSET', `user:${hash}`,
        'email', 'admin@agentcache.ai',
        'plan', 'business',
        'role', 'admin',
        'created', new Date().toISOString()
    );

    console.log('✅ Admin User Created in Redis');
}

createAdmin();
