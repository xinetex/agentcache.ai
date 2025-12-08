
export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Helper for Redis calls
async function redis(command, ...args) {
    const path = `${command}/${args.map(a => encodeURIComponent(String(a))).join('/')}`;
    const res = await fetch(`${UPSTASH_URL}/${path}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data.result;
}

export default async function handler(req) {
    try {
        // Cache Check (10s TTL)
        const CACHE_KEY = 'telemetry:living_grid';
        const cached = await redis('get', CACHE_KEY);
        if (cached) {
            return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
        }

        // Parallel fetch for external feeds
        // 1. ISS Position (Space)
        // 2. Weather (Atmosphere) - defaulting to NYC/IAD region if generic, or specific coords
        // Using IAD (Ashburn, VA) as it's a major data center hub: 39.0438, -77.4874

        const [issRes, weatherRes] = await Promise.all([
            fetch('https://api.wheretheiss.at/v1/satellites/25544').catch(e => null),
            fetch('https://api.open-meteo.com/v1/forecast?latitude=39.0438&longitude=-77.4874&current=temperature_2m,relative_humidity_2m,wind_speed_10m').catch(e => null)
        ]);

        const issData = issRes ? await issRes.json() : null;
        const weatherData = weatherRes ? await weatherRes.json() : null;

        const telemetry = {
            timestamp: new Date().toISOString(),
            space: {
                station: 'ISS',
                status: issData ? 'tracking' : 'signal_lost',
                latitude: issData?.latitude || 0,
                longitude: issData?.longitude || 0,
                altitude: issData?.altitude || 400, // km
                velocity: issData?.velocity || 27600 // km/h
            },
            atmosphere: {
                location: 'US-East (Ashburn)',
                status: weatherData ? 'online' : 'offline',
                temp_c: weatherData?.current?.temperature_2m || 20,
                humidity: weatherData?.current?.relative_humidity_2m || 50,
                wind_kph: weatherData?.current?.wind_speed_10m || 10
            }
        };

        // Cache for 10 seconds
        await redis('setex', CACHE_KEY, 10, JSON.stringify(telemetry));

        return new Response(JSON.stringify(telemetry), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
