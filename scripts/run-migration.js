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
    
    // Split on semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.length === 0) continue;
      console.log(`   Executing: ${statement.substring(0, 50)}...`);
      await sql([statement]);
    }
    
    console.log(`✅ Migration completed successfully!`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    process.exit(1);
  }
}

runMigration();
