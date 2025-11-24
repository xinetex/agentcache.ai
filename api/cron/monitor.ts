import { UrlWatchdog } from '../../src/lib/robotics/watchdog.js';

export const config = {
    runtime: 'edge', // Run on Edge for speed
};

export default async function handler(req: Request) {
    // Verify Cron Secret to prevent unauthorized triggers
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const results = await UrlWatchdog.runCheckCycle();

        const changes = results.filter(r => r.changed).length;
        const errors = results.filter(r => r.error).length;

        return new Response(JSON.stringify({
            success: true,
            checked: results.length,
            changes,
            errors,
            timestamp: Date.now()
        }), {
            headers: { 'content-type': 'application/json' }
        });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }
}
