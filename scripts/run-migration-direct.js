/**
 * Run migrations directly using Neon's Pool-compatible interface
 */

import { neonConfig, Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ws from 'ws';

// Enable WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration-direct.js <migration_file>');
  console.error('Example: node scripts/run-migration-direct.js db/migrations/007_wizard_learnings.sql');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log(`📂 Reading migration file: ${migrationFile}`);
    const migrationSQL = readFileSync(resolve(migrationFile), 'utf-8');
    
    console.log(`🚀 Running migration...`);
    
    // Execute the full SQL file
    await pool.query(migrationSQL);
    
    console.log(`✅ Migration completed successfully!`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
