#!/usr/bin/env node
// scripts/seed-jettythunder.js - Create JettyThunder.app enterprise account
// Usage: node scripts/seed-jettythunder.js

import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function seedJettyThunder() {
  console.log('🚀 Setting up JettyThunder.app enterprise account...\n');

  try {
    // 1. Create organization
    console.log('📝 Creating organization...');
    const orgResult = await query(`
      INSERT INTO organizations (
        name, slug, sector, contact_email, contact_name,
        plan_tier, max_namespaces, max_api_keys, max_users,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (slug) DO UPDATE 
      SET name = EXCLUDED.name,
          sector = EXCLUDED.sector,
          contact_email = EXCLUDED.contact_email,
          plan_tier = EXCLUDED.plan_tier,
          status = EXCLUDED.status
      RETURNING id, name, slug, plan_tier
    `, [
      'JettyThunder',
      'jettythunder',
      'filestorage',
      'platform@jettythunder.app',
      'JettyThunder Platform Team',
      'enterprise',
      50, // max namespaces
      10, // max API keys
      20, // max users
      'active'
    ]);

    const org = orgResult.rows[0];
    console.log('✅ Organization created:', org.name);
    console.log('   ID:', org.id);
    console.log('   Slug:', org.slug);
    console.log('   Plan:', org.plan_tier);

    // 2. Create admin user
    console.log('\n📝 Creating admin user...');
    const password = 'JettyThunder2024!'; // Change this!
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(`
      INSERT INTO users (
        email, full_name, password_hash, is_active,
        organization_id, role
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE 
      SET organization_id = EXCLUDED.organization_id,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active
      RETURNING id, email, full_name, role
    `, [
      'admin@jettythunder.app',
      'JettyThunder Admin',
      passwordHash,
      true,
      org.id,
      'admin'
    ]);

    const user = userResult.rows[0];
    console.log('✅ Admin user created:', user.email);
    console.log('   ID:', user.id);
    console.log('   Role:', user.role);

    // 3. Create default namespaces
    console.log('\n📝 Creating default namespaces...');
    const namespaces = [
      { name: 'jt_production', display_name: 'Production', description: 'Production environment cache' },
      { name: 'jt_staging', display_name: 'Staging', description: 'Staging environment cache' },
      { name: 'jt_customer_seagate', display_name: 'Seagate Customer', description: 'Seagate customer segment' },
      { name: 'jt_customer_wd', display_name: 'Western Digital', description: 'WD customer segment' },
      { name: 'jt_internal', display_name: 'Internal', description: 'Internal testing and development' },
    ];

    for (const ns of namespaces) {
      await query(`
        INSERT INTO namespaces (
          organization_id, name, display_name, description, is_active
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (organization_id, name) DO NOTHING
      `, [org.id, ns.name, ns.display_name, ns.description, true]);
      console.log('   ✅', ns.display_name, `(${ns.name})`);
    }

    // 4. Create API key
    console.log('\n📝 Creating API key...');
    const apiKeyPrefix = 'ac_live_jettythunder_';
    const apiKeySuffix = crypto.randomBytes(16).toString('hex');
    const apiKey = apiKeyPrefix + apiKeySuffix;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await query(`
      INSERT INTO api_keys (
        user_id, organization_id, key_hash, name, allowed_namespaces, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (key_hash) DO NOTHING
      RETURNING id
    `, [
      user.id,
      org.id,
      apiKeyHash,
      'JettyThunder Production Key',
      ['*'], // Access to all namespaces
      true
    ]);

    // Output summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 JettyThunder.app successfully set up!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🏢 Organization:  JettyThunder');
    console.log('📧 Admin Email:   admin@jettythunder.app');
    console.log('🔑 Password:      ' + password);
    console.log('💎 Plan:          Enterprise');
    console.log('📊 Namespaces:    5 created');
    console.log('\n🔐 API Key (save securely!):\n');
    console.log('   ' + apiKey);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📚 Next Steps:\n');
    console.log('1. Test login at: https://agentcache.ai/login.html');
    console.log('   Email: admin@jettythunder.app');
    console.log('   Password: ' + password);
    console.log('\n2. Use API key for cache requests:');
    console.log('   X-API-Key: ' + apiKey);
    console.log('   X-Cache-Namespace: jt_production');
    console.log('\n3. Available namespaces:');
    namespaces.forEach(ns => {
      console.log(`   - ${ns.name}: ${ns.description}`);
    });
    console.log('\n✨ Account is ready for testing!\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Run setup
seedJettyThunder()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
