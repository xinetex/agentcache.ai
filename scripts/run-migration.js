/**
 * Run database migrations on Neon production
 * Usage: node scripts/run-migration.js <migration_file>
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration_file>');
  console.error('Example: node scripts/run-migration.js db/migrations/007_wizard_learnings.sql');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.error('Set it with: export DATABASE_URL="your_neon_connection_string"');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log(`📂 Reading migration file: ${migrationFile}`);
    const sql = neon(process.env.DATABASE_URL);
    const migrationSQL = readFileSync(resolve(migrationFile), 'utf-8');
    
    console.log(`🚀 Running migration...`);
    
    // Neon serverless requires the full SQL as a single query
    // We'll use the raw query method for migrations
    console.log(`   Executing migration SQL...`);
    
    // Execute the entire migration file as one query
    // This works better with CREATE TABLE, CREATE INDEX, etc.
    const result = await sql([migrationSQL]);
    
    console.log(`   Migration executed successfully`);
    console.log(`   Result:`, result.length > 0 ? `${result.length} operations` : 'Complete');
    
    console.log(`✅ Migration completed successfully!`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    process.exit(1);
  }
}

runMigration();
