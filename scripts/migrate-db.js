#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Read schema file
    console.log('\n📄 Reading schema file...');
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded');

    // Execute schema
    console.log('\n🚀 Executing schema...');
    await client.query(schemaSQL);
    console.log('✅ Schema executed successfully');

    // Read and execute migration
    console.log('\n📄 Reading organizations migration...');
    const migrationPath = join(__dirname, '../db/migrations/001_add_organizations.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');

    console.log('\n🚀 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully');

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    client.release();
    await pool.end();

    console.log('\n✨ Database migration completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
