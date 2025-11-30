import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    const migration = fs.readFileSync('db/migrations/011_onboarding_flow.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    
    console.log('✅ Migration 011_onboarding_flow.sql applied successfully');
    console.log('   - Added onboarding_completed, first_login to users');
    console.log('   - Added is_starter, projected_savings to pipelines');
    console.log('   - Created user_onboarding_status view');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

runMigration();
