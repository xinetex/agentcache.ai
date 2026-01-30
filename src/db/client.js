import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgres://letstaco@localhost:5432/agentcache';

// Disable prefetch as it is not supported for "Transaction" pool mode
const isProd = process.env.NODE_ENV === 'production';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
export const client = postgres(connectionString, {
    prepare: false,
    ssl: 'require', // Neon requires SSL always
    connect_timeout: 5 // Fail fast after 5s
});
export const db = drizzle(client, { schema });
