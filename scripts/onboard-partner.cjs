#!/usr/bin/env node

/**
 * Partner Onboarding Script
 * 
 * Creates partner account with API credentials for AgentCache overflow integration
 * 
 * Usage:
 *   node scripts/onboard-partner.cjs redis-labs "Redis Labs" 0.30
 *   node scripts/onboard-partner.cjs pinecone "Pinecone" 0.20
 */

const crypto = require('crypto');

// Redis configuration
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

// Parse arguments
const [partnerId, partnerName, revenueShare] = process.argv.slice(2);

if (!partnerId || !partnerName || !revenueShare) {
  console.error('Usage: node onboard-partner.cjs <partner-id> <partner-name> <revenue-share>');
  console.error('Example: node onboard-partner.cjs redis-labs "Redis Labs" 0.30');
  process.exit(1);
}

const revShare = parseFloat(revenueShare);
if (isNaN(revShare) || revShare < 0 || revShare > 1) {
  console.error('❌ Revenue share must be between 0 and 1 (e.g., 0.30 for 30%)');
  process.exit(1);
}

// Generate partner API key
function generatePartnerKey() {
  return `ac_partner_${partnerId}_${crypto.randomBytes(16).toString('hex')}`;
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${command}/${args.map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  return response.json();
}

async function onboardPartner() {
  console.log('\n🚀 AgentCache Partner Onboarding\n');
  console.log('Partner ID:', partnerId);
  console.log('Partner Name:', partnerName);
  console.log('Revenue Share:', `${(revShare * 100).toFixed(0)}%`);
  console.log('');
  
  // Generate API key
  const apiKey = generatePartnerKey();
  const apiKeyHash = sha256(apiKey);
  
  console.log('Generating credentials...');
  
  // Store partner key (hashed for security)
  await redis('set', `partner:${partnerId}:key`, apiKeyHash);
  
  // Store partner metadata
  await redis('hset', `partner:${partnerId}:info`, 'name', partnerName);
  await redis('hset', `partner:${partnerId}:info`, 'revenue_share', revShare);
  await redis('hset', `partner:${partnerId}:info`, 'status', 'active');
  await redis('hset', `partner:${partnerId}:info`, 'created_at', new Date().toISOString());
  
  // Initialize stats
  await redis('hset', `partner:${partnerId}:stats`, 'hits', '0');
  await redis('hset', `partner:${partnerId}:stats`, 'misses', '0');
  await redis('hset', `partner:${partnerId}:stats`, 'sets', '0');
  
  console.log('✅ Partner onboarded successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Partner Credentials');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Partner ID:', partnerId);
  console.log('API Key:', apiKey);
  console.log('');
  console.log('⚠️  IMPORTANT: Save these credentials securely!');
  console.log('   The API key will not be shown again.');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📖 Integration Example');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('const AgentCacheOverflow = require(\'@agentcache/overflow-client\');');
  console.log('');
  console.log('const overflow = new AgentCacheOverflow({');
  console.log(`  partnerId: '${partnerId}',`);
  console.log(`  apiKey: '${apiKey}',`);
  console.log(`  revenueShare: ${revShare}`);
  console.log('});');
  console.log('');
  console.log('// Check cache');
  console.log('const result = await overflow.get({');
  console.log('  customerId: \'customer_123\',');
  console.log('  request: { provider: \'openai\', model: \'gpt-4\', ... }');
  console.log('});');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Test overflow endpoint:');
  console.log(`curl -X POST https://agentcache.ai/api/overflow \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "X-Partner-ID: ${partnerId}" \\`);
  console.log(`  -H "X-Partner-Key: ${apiKey}" \\`);
  console.log(`  -d '{"customer_id":"test","original_request":{"provider":"openai","model":"gpt-4","messages":[{"role":"user","content":"test"}]}}'`);
  console.log('');
}

onboardPartner().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
