import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not configured - running without persistence');
}

// Create postgres connection
const client = DATABASE_URL ? postgres(DATABASE_URL) : null;

// Create drizzle instance
export const db = client ? drizzle(client, { schema }) : null;

export * from './schema.js';
