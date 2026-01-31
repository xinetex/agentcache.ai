import { Hono } from 'hono';
import { handle } from 'hono/vercel';

export const config = {
    runtime: 'nodejs'
};

const app = new Hono();

app.get('*', (c) => {
    return c.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_DB_URL: !!process.env.DATABASE_URL,
            DB_URL_LENGTH: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
            HAS_MOONSHOT_KEY: !!process.env.MOONSHOT_API_KEY,
            HAS_VECTOR_URL: !!process.env.VECTOR_SERVICE_URL,
            VERCEL: process.env.VERCEL,
            VERCEL_Region: process.env.VERCEL_REGION
        },
        message: 'Isolated debug endpoint is working. The main app is likely crashing during import.'
    });
});

export default handle(app);
