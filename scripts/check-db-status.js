#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '../.env') });

async function checkStatus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking database status...\n');

    // Check if organizations table exists
    const orgCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organizations'
      );
    `);

    const hasOrganizations = orgCheck.rows[0].exists;

    if (hasOrganizations) {
      console.log('✅ Organizations table exists');
      
      // Check for organization_id column in users table
      const userOrgCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organization_id';
      `);
      
      if (userOrgCheck.rows.length > 0) {
        console.log('✅ Users table has organization_id column');
      } else {
        console.log('❌ Users table missing organization_id column');
      }

      // Check namespaces table
      const nsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'namespaces'
        );
      `);
      
      if (nsCheck.rows[0].exists) {
        console.log('✅ Namespaces table exists');
      } else {
        console.log('❌ Namespaces table does not exist');
      }

      // Check organization_usage_metrics table
      const metricsCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'organization_usage_metrics'
        );
      `);
      
      if (metricsCheck.rows[0].exists) {
        console.log('✅ Organization usage metrics table exists');
      } else {
        console.log('❌ Organization usage metrics table does not exist');
      }

    } else {
      console.log('❌ Organizations table does not exist - migration needs to be run');
    }

    console.log('\n📋 All tables in database:');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    tables.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });

    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStatus();
