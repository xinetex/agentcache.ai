export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Authorization',
        },
    });
}

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) throw new Error('Upstash not configured');

    // Handle array arguments for commands like MGET
    const path = `${command}/${args.map(arg =>
        Array.isArray(arg) ? arg.map(encodeURIComponent).join('/') : encodeURIComponent(arg)
    ).join('/')}`;

    const res = await fetch(`${url}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        // Auth Check (Simplified for Lab)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, 401);
        }

        if (req.method === 'POST') {
            const body = await req.json();
            const { genome } = body;

            if (!genome || !genome.id) {
                return json({ error: 'Invalid genome data' }, 400);
            }

            const key = `lab:genomes:${genome.id}`;

            // Save Genome
            await redis('SET', key, JSON.stringify(genome));

            // Add to Index (Sorted Set by Fitness)
            // Score = Fitness (default 0)
            const score = genome.fitness || 0;
            await redis('ZADD', 'lab:genomes:index', score, genome.id);

            return json({ success: true, id: genome.id });
        }

        if (req.method === 'GET') {
            const url = new URL(req.url);
            const limit = parseInt(url.searchParams.get('limit') || '10');
            const generation = url.searchParams.get('generation');

            let genomeIds = [];

            if (generation) {
                // TODO: Implement generation filtering if needed
                // For now, just return top fitness
                genomeIds = await redis('ZREVRANGE', 'lab:genomes:index', 0, limit - 1);
            } else {
                // Get Top Genomes by Fitness
                genomeIds = await redis('ZREVRANGE', 'lab:genomes:index', 0, limit - 1);
            }

            if (genomeIds.length === 0) {
                return json({ genomes: [] });
            }

            // Fetch actual genome data
            // Upstash REST API supports multiple keys in MGET? 
            // The simple helper above might not support MGET with multiple keys in path correctly if not careful.
            // Let's do parallel GETs for simplicity and reliability with the helper.
            const genomes = await Promise.all(genomeIds.map(async (id) => {
                const data = await redis('GET', `lab:genomes:${id}`);
                return data ? JSON.parse(data) : null;
            }));

            return json({ genomes: genomes.filter(g => g !== null) });
        }

        return json({ error: 'Method not allowed' }, 405);

    } catch (err) {
        console.error('Genome API Error:', err);
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
