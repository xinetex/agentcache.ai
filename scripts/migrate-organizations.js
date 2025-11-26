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

    // Read and execute migration
    console.log('\n📄 Reading organizations migration...');
    const migrationPath = join(__dirname, '../db/migrations/001_add_organizations.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');

    console.log('\n🚀 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully');

    // Verify new tables exist
    console.log('\n🔍 Verifying migration...');
    
    const orgCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organizations'
      );
    `);
    
    if (orgCheck.rows[0].exists) {
      console.log('  ✓ organizations table created');
    }

    const nsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'namespaces'
      );
    `);
    
    if (nsCheck.rows[0].exists) {
      console.log('  ✓ namespaces table created');
    }

    const metricsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organization_usage_metrics'
      );
    `);
    
    if (metricsCheck.rows[0].exists) {
      console.log('  ✓ organization_usage_metrics table created');
    }

    const settingsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organization_settings'
      );
    `);
    
    if (settingsCheck.rows[0].exists) {
      console.log('  ✓ organization_settings table created');
    }

    client.release();
    await pool.end();

    console.log('\n✨ Organizations migration completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
