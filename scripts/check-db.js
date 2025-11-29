/**
 * Check current database schema
 * Verifies what tables exist and their structure
 */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  console.log('Export it first: export DATABASE_URL="your_connection_string"');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function checkDatabase() {
  try {
    console.log('🔍 Checking database schema...\n');
    
    // List all tables
    console.log('📋 Tables:');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    
    // Check for wizard_learnings specifically
    const wizardExists = tables.some(t => t.table_name === 'wizard_learnings');
    console.log(`\n🧙 wizard_learnings table: ${wizardExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    // Check for pipelines table
    const pipelinesExists = tables.some(t => t.table_name === 'pipelines');
    console.log(`📊 pipelines table: ${pipelinesExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    if (pipelinesExists) {
      // Get pipelines table structure
      const pipelineCols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'pipelines'
        ORDER BY ordinal_position
      `;
      
      console.log('\n📐 pipelines table columns:');
      pipelineCols.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Count pipelines
      const count = await sql`SELECT COUNT(*) as count FROM pipelines`;
      console.log(`\n   Total pipelines: ${count[0].count}`);
    }
    
    if (wizardExists) {
      // Get wizard_learnings table structure
      const wizardCols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'wizard_learnings'
        ORDER BY ordinal_position
      `;
      
      console.log('\n🧙 wizard_learnings table columns:');
      wizardCols.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Count learnings
      const count = await sql`SELECT COUNT(*) as count FROM wizard_learnings`;
      console.log(`\n   Total learnings: ${count[0].count}`);
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  }
}

checkDatabase();
