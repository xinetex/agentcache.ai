import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

export let client;
export let db;

// IMPORTANT:
// - Do NOT default to localhost in serverless (Vercel) or production.
// - If DATABASE_URL is missing, use a safe mock so APIs can still respond quickly.
if (!connectionString) {
    console.warn('[DB] DATABASE_URL missing - using mock DB (no localhost fallback)');
    db = {
        select: () => ({ from: () => [] }),
        insert: () => ({ values: () => ({ returning: () => [] }) }),
        update: () => ({ set: () => ({ where: () => [] }) }),
        delete: () => ({ where: () => ({ returning: () => [] }) }),
        execute: () => ([]),
    };
} else {
    try {
        client = postgres(connectionString, {
            prepare: false,
            ssl: 'require', // Neon requires SSL always
            connect_timeout: 5 // Fail fast after 5s
        });
        db = drizzle(client, { schema });
    } catch (error) {
        console.error('[DB] Failed to initialize database client:', error);
        // Fail safe: Mock Drizzle object to prevent crash on import
        // Any usage will throw or return undefined, but server will start.
        db = {
            select: () => ({ from: () => [] }),
            insert: () => ({ values: () => ({ returning: () => [] }) }),
            update: () => ({ set: () => ({ where: () => [] }) }),
            delete: () => ({ where: () => ({ returning: () => [] }) }),
            execute: () => ([]),
        };
    }
}
