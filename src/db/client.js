import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgres://letstaco@localhost:5432/agentcache';

// Disable prefetch as it is not supported for "Transaction" pool mode
const isProd = process.env.NODE_ENV === 'production';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
export let client;
export let db;

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
    };
}
