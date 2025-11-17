#!/usr/bin/env node
// scripts/onboard-jettythunder.cjs - Onboard JettyThunder.app as first customer
// Usage: node scripts/onboard-jettythunder.cjs

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Load .env file manually (prefer .env.vercel from Vercel CLI)
const envFiles = ['.env.vercel', '.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) {
    console.log(`📂 Loading environment from ${envFile}...`);
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Strip quotes from value
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    break; // Use first found env file
  }
}

// Environment variables
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

// SHA-256 hash helper
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Generate API key
function generateApiKey(identifier) {
  const bytes = crypto.randomBytes(32);
  const hex = bytes.toString('hex');
  // Use identifier in key for clarity (still secure with random suffix)
  return `ac_live_${identifier}_${hex.slice(0, 32)}`;
}

// Redis helper
async function redis(command, ...args) {
  const url = `${UPSTASH_URL}/${command}/${args.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

// Main onboarding function
async function onboardJettyThunder() {
  console.log('🚀 Onboarding JettyThunder.app as AgentCache\'s first customer...\n');
  
  const email = 'platform@jettythunder.app';
  const name = 'JettyThunder Platform';
  const plan = 'enterprise'; // Give them enterprise plan as first customer
  const quota = 500000; // 500k requests/month
  
  const emailHash = sha256(email);
  
  // Check if already exists
  const existing = await redis('HGET', `user:${emailHash}`, 'email');
  if (existing) {
    console.log('⚠️  JettyThunder.app user already exists!');
    console.log('📧 Email:', email);
    console.log('🔑 Email hash:', emailHash);
    
    // Get existing API key hash
    const apiKeyHash = await redis('HGET', `user:${emailHash}`, 'apiKeyHash');
    console.log('🔐 API Key Hash:', apiKeyHash ? apiKeyHash.slice(0, 16) + '...' : 'Not found');
    
    console.log('\n❓ To regenerate API key, delete the user first:');
    console.log(`   redis-cli DEL user:${emailHash}`);
    console.log(`   redis-cli DEL key:${apiKeyHash}`);
    return;
  }
  
  // Generate API key
  const apiKey = generateApiKey('jettythunder');
  const apiKeyHash = sha256(apiKey);
  
  // Create password hash (they won't use password, but need it for login system)
  const tempPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = sha256(tempPassword);
  
  console.log('📝 Creating user account...');
  
  // Store user data in Redis
  await redis('HSET', `user:${emailHash}`,
    'email', email,
    'name', name,
    'passwordHash', passwordHash,
    'apiKeyHash', apiKeyHash,
    'plan', plan,
    'quota', quota.toString(),
    'createdAt', Date.now().toString(),
    'verified', 'true' // Pre-verified
  );
  
  console.log('✅ User created:', email);
  console.log('   Hash:', emailHash);
  
  // Store API key mapping
  await redis('HSET', `key:${apiKeyHash}`,
    'email', email,
    'plan', plan,
    'quota', quota.toString()
  );
  
  console.log('✅ API key mapping created');
  
  // Initialize usage counters
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  await redis('HSET', `usage:${apiKeyHash}`,
    'hits', '0',
    'misses', '0',
    'requests', '0'
  );
  
  await redis('SET', `usage:${apiKeyHash}:m:${currentMonth}`, '0');
  await redis('SET', `usage:${apiKeyHash}/monthlyQuota`, quota.toString());
  
  console.log('✅ Usage tracking initialized');
  
  // Output results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 JettyThunder.app successfully onboarded!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📧 Email:        ', email);
  console.log('👤 Name:         ', name);
  console.log('💎 Plan:         ', plan);
  console.log('📊 Monthly Quota:', quota.toLocaleString(), 'requests');
  console.log('✅ Status:       ', 'Verified & Active');
  console.log('\n🔑 API Key (save this securely!):\n');
  console.log('   ', apiKey);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Output integration instructions
  console.log('📚 Integration Instructions:\n');
  console.log('1. Save the API key in JettyThunder.app environment variables:');
  console.log('   AGENTCACHE_API_KEY=' + apiKey);
  console.log('\n2. Use the API key in HTTP requests:');
  console.log('   curl -X POST https://agentcache.ai/api/cache/get \\');
  console.log('     -H "X-API-Key: ' + apiKey + '" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"provider":"openai","model":"gpt-4","messages":[...]}\'');
  console.log('\n3. Test namespace support (multi-tenant):');
  console.log('   Add header: X-Cache-Namespace: customer_123');
  console.log('\n4. Monitor usage via stats API:');
  console.log('   curl -X GET "https://agentcache.ai/api/stats?period=24h" \\');
  console.log('     -H "X-API-Key: ' + apiKey + '"');
  console.log('\n5. Rate limits: 500 requests/minute');
  console.log('   Monthly quota: 500,000 requests');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('✨ Next steps:');
  console.log('   • Add API key to JettyThunder.app .env file');
  console.log('   • Test cache endpoints with real AI requests');
  console.log('   • Monitor dashboard at agentcache.ai/dashboard');
  console.log('   • Watch cost savings accumulate! 💰\n');
}

// Run onboarding
onboardJettyThunder().catch(err => {
  console.error('❌ Onboarding failed:', err);
  process.exit(1);
});
