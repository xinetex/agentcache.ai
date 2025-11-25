#!/usr/bin/env node
/**
 * Database Setup Script
 * Run this to create all necessary tables in your Neon database
 * 
 * Usage: node scripts/setup-database.js
 * Make sure DATABASE_URL environment variable is set
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.log('\nPlease set your Neon database URL:');
  console.log('export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"');
  process.exit(1);
}

console.log('🚀 AgentCache Database Setup\n');
console.log('📦 Connecting to Neon database...');

const sql = neon(DATABASE_URL);

async function setupDatabase() {
  try {
    // Read schema file
    const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
    console.log(`📄 Reading schema from: ${schemaPath}`);
    
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('🔨 Creating tables...');
    
    // Execute schema (Neon doesn't support multi-statement execution directly)
    // So we need to split and execute statements individually
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const statement of statements) {
      try {
        if (statement.toLowerCase().includes('create table') ||
            statement.toLowerCase().includes('create index') ||
            statement.toLowerCase().includes('create view') ||
            statement.toLowerCase().includes('create trigger') ||
            statement.toLowerCase().includes('create or replace function')) {
          await sql(statement);
          successCount++;
          
          // Extract table/index/view name for logging
          const match = statement.match(/create\s+(?:or\s+replace\s+)?(?:table|index|view|trigger|function)\s+(?:if\s+not\s+exists\s+)?(\w+)/i);
          if (match) {
            console.log(`  ✅ ${match[1]}`);
          }
        } else {
          skipCount++;
        }
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  Already exists, skipping`);
          skipCount++;
        } else {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✨ Database setup complete!`);
    console.log(`   Created: ${successCount} objects`);
    console.log(`   Skipped: ${skipCount} objects`);
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log(`\n📊 Found ${tables.length} tables:`);
    tables.forEach(t => console.log(`   • ${t.table_name}`));
    
    console.log('\n🎉 All done! Your database is ready.');
    console.log('\n💡 Next steps:');
    console.log('   1. Set DATABASE_URL in Vercel environment variables');
    console.log('   2. Set JWT_SECRET in Vercel environment variables');
    console.log('   3. Redeploy your application');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

setupDatabase();
