#!/usr/bin/env node
// scripts/reset-user-password.js - Directly reset a user's password
// Usage: node scripts/reset-user-password.js <email> <new-password>

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: node scripts/reset-user-password.js <email> <new-password>');
    console.error('Example: node scripts/reset-user-password.js user@example.com MyNewPass123');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking up user: ${email}...`);
    
    // Find user
    const users = await sql`
      SELECT id, email, full_name, is_active 
      FROM users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    const user = users[0];

    if (!user.is_active) {
      console.error(`❌ User account is inactive: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.full_name || user.email}`);
    console.log(`🔒 Hashing new password...`);

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    console.log(`💾 Updating password in database...`);

    // Update password
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}, 
          updated_at = NOW() 
      WHERE id = ${user.id}
    `;

    // Clean up any existing password reset tokens
    await sql`
      DELETE FROM password_reset_tokens 
      WHERE user_id = ${user.id}
    `;

    console.log('\n✅ Password reset successful!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Login Credentials:');
    console.log(`   Email:    ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Login at: https://agentcache.ai/login.html\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
