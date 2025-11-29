#!/usr/bin/env node
/**
 * Fix Account Script
 * Diagnoses and fixes auth issues (duplicate accounts, missing fields, etc.)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔍 AgentCache Account Diagnostic\n');

  const email = await question('Enter your email: ');
  
  if (!email) {
    console.log('❌ Email is required');
    rl.close();
    return;
  }

  console.log('\n📊 Searching database for:', email.toLowerCase());
  
  try {
    // Check for user
    const userResult = await query(
      'SELECT id, email, full_name, is_active, created_at, organization_id, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      console.log('\n❌ No account found with this email');
      console.log('   You can create a new account at /signup.html');
      rl.close();
      return;
    }

    const user = userResult.rows[0];
    console.log('\n✅ Account found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Name:', user.full_name);
    console.log('   Active:', user.is_active);
    console.log('   Role:', user.role || 'member');
    console.log('   Org ID:', user.organization_id || 'none');
    console.log('   Created:', user.created_at);

    // Check password hash
    const passResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );

    const hasPassword = passResult.rows[0]?.password_hash;
    console.log('   Password:', hasPassword ? '✅ Set' : '❌ Missing');

    if (!user.is_active) {
      console.log('\n⚠️  Account is INACTIVE');
      const activate = await question('\nActivate account? (y/n): ');
      
      if (activate.toLowerCase() === 'y') {
        await query(
          'UPDATE users SET is_active = true WHERE id = $1',
          [user.id]
        );
        console.log('✅ Account activated');
      }
    }

    if (!hasPassword || hasPassword === '') {
      console.log('\n⚠️  No password set');
      const setPass = await question('\nSet a new password? (y/n): ');
      
      if (setPass.toLowerCase() === 'y') {
        const newPassword = await question('Enter new password (min 8 chars): ');
        
        if (newPassword.length < 8) {
          console.log('❌ Password must be at least 8 characters');
        } else {
          const passwordHash = await bcrypt.hash(newPassword, 10);
          await query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, user.id]
          );
          console.log('✅ Password updated');
        }
      }
    } else {
      // Offer to test password
      const testPass = await question('\nTest your password? (y/n): ');
      
      if (testPass.toLowerCase() === 'y') {
        const password = await question('Enter password: ');
        const match = await bcrypt.compare(password, hasPassword);
        
        if (match) {
          console.log('✅ Password is correct! Login should work.');
        } else {
          console.log('❌ Password does not match');
          
          const resetPass = await question('\nReset password? (y/n): ');
          if (resetPass.toLowerCase() === 'y') {
            const newPassword = await question('Enter new password (min 8 chars): ');
            
            if (newPassword.length < 8) {
              console.log('❌ Password must be at least 8 characters');
            } else {
              const passwordHash = await bcrypt.hash(newPassword, 10);
              await query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [passwordHash, user.id]
              );
              console.log('✅ Password reset successfully');
            }
          }
        }
      }
    }

    // Check subscriptions
    const subResult = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    if (subResult.rows.length === 0) {
      console.log('\n⚠️  No subscription found');
      const createSub = await question('Create starter subscription? (y/n): ');
      
      if (createSub.toLowerCase() === 'y') {
        await query(`
          INSERT INTO subscriptions (
            user_id, plan_tier, status, 
            current_period_start, current_period_end
          ) VALUES ($1, 'starter', 'active', NOW(), NOW() + INTERVAL '1 month')
        `, [user.id]);
        console.log('✅ Starter subscription created');
      }
    } else {
      console.log('\n✅ Subscription:', subResult.rows[0].plan_tier, '-', subResult.rows[0].status);
    }

    console.log('\n✨ Account check complete!');
    console.log('\nYou should now be able to login at /login.html');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('connect')) {
      console.log('\n💡 Make sure DATABASE_URL is set in .env');
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
