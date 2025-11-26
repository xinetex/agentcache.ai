#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '../.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    const migrationSQL = readFileSync(join(__dirname, '../db/migrations/002_add_password_reset_tokens.sql'), 'utf8');
    await client.query(migrationSQL);
    
    console.log('✅ Password reset tokens table created');
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Migration error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
