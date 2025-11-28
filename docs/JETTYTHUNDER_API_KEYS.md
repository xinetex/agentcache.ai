# JettyThunder API Key Provisioning

## Overview
JettyThunder needs secure API keys with namespace isolation for their multi-tenant file management platform. This document outlines the provisioning strategy.

## Key Requirements

### 1. **Multi-Tenant Isolation**
- Each JettyThunder customer needs isolated cache namespace
- Customer data must never leak between accounts
- Support for B2B customers with sub-organizations

### 2. **High Volume Usage**
- Expected: 1M+ requests/month across all customers
- Peak: 50K requests/day during business hours
- File sizes: 10KB - 100MB

### 3. **Security**
- API keys must be securely generated and stored
- Keys should be rotatable without downtime
- Rate limiting per customer

---

## Provisioning Options

### Option 1: Single Master Key (Recommended for Pilot)
**Best for**: Initial integration, testing, single-deployment

**Pros:**
- Simple setup
- One key to manage
- Fast to get started

**Cons:**
- All customers share rate limits
- Harder to track usage per customer
- Single point of failure

**Implementation:**
```bash
# Generate master key
curl -X POST https://api.agentcache.ai/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "jettythunder_master",
    "integration": "jettythunder",
    "project_id": "jettythunder-production",
    "tier": "enterprise",
    "rate_limit": 10000000
  }'

# Returns:
{
  "api_key": "ac_jettythunder_a3f89d2c1b...",
  "namespace": "jettythunder_production",
  "rate_limit": 10000000
}
```

**Usage in JettyThunder:**
```typescript
// src/lib/edge-cdn.ts
import { AgentCache } from 'agentcache-client';

const agentCache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY!, // Master key
  namespace: (customerId: string) => `jt_customer_${customerId}`, // Per-customer namespaces
  baseUrl: 'https://api.agentcache.ai'
});

// Automatically isolates by customer
export async function cacheFile(file: File, customerId: string) {
  return agentCache.set({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: `file:${file.id}` }],
    response: file.url,
    namespace: `jt_customer_${customerId}` // Isolation
  });
}
```

---

### Option 2: Per-Customer API Keys (Recommended for Production)
**Best for**: Production, billing per customer, granular control

**Pros:**
- Perfect usage tracking per customer
- Individual rate limits
- Easy to disable problematic customers
- Better security (key compromise affects only one customer)

**Cons:**
- More complex key management
- Need key rotation strategy
- Requires customer onboarding flow

**Implementation:**

#### 2.1 JettyThunder Dashboard Integration
```typescript
// src/api/customers/provision.ts
import { generateApiKey, createNamespace } from '@/lib/agentcache';

export async function provisionCustomerCache(customerId: string) {
  const customer = await db.customer.findUnique({ 
    where: { id: customerId } 
  });
  
  // Generate unique API key for this customer
  const apiKey = await generateApiKey({
    user_id: `jt_customer_${customerId}`,
    integration: 'jettythunder',
    project_id: customer.projectId,
    tier: customer.plan, // free, pro, enterprise
    rate_limit: getRateLimitForPlan(customer.plan)
  });
  
  // Create isolated namespace
  const namespace = await createNamespace({
    name: `jt_customer_${customerId}`,
    user_id: `jt_customer_${customerId}`,
    sector: 'filestorage',
    use_case: 'cdn_acceleration'
  });
  
  // Store encrypted in database
  await db.customerCache.create({
    data: {
      customerId,
      apiKey: encrypt(apiKey), // Encrypt at rest
      namespace,
      provisionedAt: new Date()
    }
  });
  
  console.log(`Provisioned cache for customer ${customerId}`);
  return { apiKey, namespace };
}

function getRateLimitForPlan(plan: string): number {
  const limits = {
    free: 10000,      // 10k/month
    pro: 100000,      // 100k/month
    enterprise: 10000000  // 10M/month
  };
  return limits[plan] || limits.free;
}
```

#### 2.2 Runtime Key Resolution
```typescript
// src/lib/edge-cdn.ts
import { AgentCache } from 'agentcache-client';

// Cache of customer API keys (refresh every 5 min)
const customerKeys = new Map<string, string>();
let lastRefresh = 0;

async function getCustomerApiKey(customerId: string): Promise<string> {
  const now = Date.now();
  if (now - lastRefresh > 5 * 60 * 1000) { // 5 min
    await refreshCustomerKeys();
    lastRefresh = now;
  }
  
  return customerKeys.get(customerId) || 
         process.env.AGENTCACHE_FALLBACK_KEY!;
}

async function refreshCustomerKeys() {
  const keys = await db.customerCache.findMany({
    select: { customerId: true, apiKey: true }
  });
  
  keys.forEach(({ customerId, apiKey }) => {
    customerKeys.set(customerId, decrypt(apiKey));
  });
}

// Use per-customer key
export async function cacheFile(file: File, customerId: string) {
  const apiKey = await getCustomerApiKey(customerId);
  const agentCache = new AgentCache({ apiKey });
  
  return agentCache.set({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: `file:${file.id}` }],
    response: file.url,
    namespace: `jt_customer_${customerId}`
  });
}
```

---

### Option 3: Hybrid Approach (Best of Both)
**Best for**: Gradual rollout, cost optimization

**Strategy:**
- Master key for all **free tier** customers (pooled resources)
- Individual keys for **pro/enterprise** customers (dedicated resources)

**Implementation:**
```typescript
export async function getApiKeyForCustomer(customerId: string) {
  const customer = await db.customer.findUnique({ 
    where: { id: customerId } 
  });
  
  // Pro/Enterprise get dedicated keys
  if (customer.plan === 'pro' || customer.plan === 'enterprise') {
    return customer.agentcacheApiKey;
  }
  
  // Free tier shares master key
  return process.env.AGENTCACHE_MASTER_KEY;
}
```

---

## API Key Management Dashboard

### For JettyThunder Admin
Create admin panel at `/admin/cache-keys`:

```typescript
// Admin dashboard features
interface CacheKeyManagement {
  // View all provisioned keys
  listKeys(): Promise<ApiKey[]>;
  
  // Generate new key for customer
  provisionKey(customerId: string): Promise<ApiKey>;
  
  // Rotate key (zero-downtime)
  rotateKey(customerId: string): Promise<void>;
  
  // Disable/enable key
  toggleKey(customerId: string, enabled: boolean): Promise<void>;
  
  // View usage statistics
  getUsageStats(customerId: string): Promise<UsageStats>;
  
  // Monitor rate limits
  checkRateLimit(customerId: string): Promise<RateLimitStatus>;
}
```

---

## Security Best Practices

### 1. **Environment Variables**
```bash
# .env (never commit)
AGENTCACHE_MASTER_KEY=ac_jettythunder_a3f89d2c1b...
AGENTCACHE_API_URL=https://api.agentcache.ai

# For Vercel deployment
vercel env add AGENTCACHE_MASTER_KEY production
```

### 2. **Encryption at Rest**
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 3. **Key Rotation Strategy**
```typescript
// Zero-downtime key rotation
export async function rotateCustomerKey(customerId: string) {
  // 1. Generate new key
  const newKey = await generateApiKey({
    user_id: `jt_customer_${customerId}`,
    integration: 'jettythunder',
    project_id: 'jettythunder-production'
  });
  
  // 2. Store as secondary key (both work)
  await db.customerCache.update({
    where: { customerId },
    data: {
      apiKeyNew: encrypt(newKey),
      rotationStartedAt: new Date()
    }
  });
  
  // 3. Wait 5 minutes for caches to refresh
  await sleep(5 * 60 * 1000);
  
  // 4. Promote new key to primary
  await db.customerCache.update({
    where: { customerId },
    data: {
      apiKey: encrypt(newKey),
      apiKeyOld: db.customerCache.apiKey, // Keep old for 24h
      apiKeyNew: null,
      rotationCompletedAt: new Date()
    }
  });
  
  console.log(`Rotated key for customer ${customerId}`);
}
```

---

## Rate Limiting Configuration

### Per-Customer Limits
```typescript
interface RateLimitTier {
  plan: string;
  requestsPerMonth: number;
  requestsPerSecond: number;
  maxConcurrentRequests: number;
  maxFileSize: number; // bytes
}

const RATE_LIMITS: Record<string, RateLimitTier> = {
  free: {
    plan: 'free',
    requestsPerMonth: 10_000,
    requestsPerSecond: 10,
    maxConcurrentRequests: 5,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },
  pro: {
    plan: 'pro',
    requestsPerMonth: 100_000,
    requestsPerSecond: 50,
    maxConcurrentRequests: 20,
    maxFileSize: 100 * 1024 * 1024 // 100MB
  },
  enterprise: {
    plan: 'enterprise',
    requestsPerMonth: 10_000_000,
    requestsPerSecond: 500,
    maxConcurrentRequests: 100,
    maxFileSize: 1024 * 1024 * 1024 // 1GB
  }
};
```

---

## Monitoring & Analytics

### Usage Tracking
```typescript
// Track cache performance per customer
interface CacheMetrics {
  customerId: string;
  date: Date;
  requests: number;
  hits: number;
  misses: number;
  bytesServed: number;
  avgLatency: number;
  cost: number; // in credits
}

export async function trackCacheRequest(
  customerId: string,
  hit: boolean,
  bytes: number,
  latency: number
) {
  await analytics.track({
    event: 'cache_request',
    customerId,
    properties: { hit, bytes, latency }
  });
  
  // Update customer usage
  await db.customerCache.update({
    where: { customerId },
    data: {
      totalRequests: { increment: 1 },
      totalHits: hit ? { increment: 1 } : undefined,
      totalBytesServed: { increment: bytes }
    }
  });
}
```

---

## Implementation Checklist

### Phase 1: Pilot (Week 1)
- [ ] Create AgentCache account for JettyThunder
- [ ] Generate master API key
- [ ] Store in environment variables
- [ ] Test integration with staging environment
- [ ] Monitor for 1 week

### Phase 2: Production Rollout (Week 2-3)
- [ ] Implement per-customer key provisioning
- [ ] Create admin dashboard for key management
- [ ] Set up encryption for keys at rest
- [ ] Configure rate limits per plan
- [ ] Deploy to production

### Phase 3: Advanced Features (Month 2)
- [ ] Implement key rotation system
- [ ] Build usage analytics dashboard
- [ ] Set up billing integration
- [ ] Add customer-facing cache analytics
- [ ] Implement automatic key rotation (quarterly)

---

## Recommended Approach for JettyThunder

### **Start with Option 1 (Master Key) for Pilot:**

1. **Generate master key** via API or dashboard
2. **Store in environment**:
   ```bash
   # .env.production
   AGENTCACHE_API_KEY=ac_jettythunder_[generated]
   AGENTCACHE_API_URL=https://api.agentcache.ai
   ```
3. **Implement namespace isolation** in code:
   ```typescript
   namespace: `jt_customer_${customerId}`
   ```
4. **Monitor usage** for 2-4 weeks
5. **Collect metrics**: hit rate, latency, cost savings

### **Transition to Option 3 (Hybrid) for Scale:**

1. Keep master key for free tier
2. Generate individual keys for paying customers
3. Implement gradual rollout (1 customer/day)
4. Monitor for issues
5. Full migration over 2-3 weeks

---

## Cost Estimation

### Based on JettyThunder's Current Usage

**Assumptions:**
- 1,000 active customers
- 100 files per customer per month
- Average file size: 5MB
- 70% cache hit rate (after warm-up)

**Calculations:**
```
Total requests: 1,000 customers × 100 files = 100,000 requests/month
Cache hits: 70,000 requests
Origin fetches: 30,000 requests

Current Lyve Cloud cost: $200/month (bandwidth)
With AgentCache: $60/month (30% origin fetches)
AgentCache cost: $50/month (100k requests)

Total new cost: $110/month
Savings: $90/month (45% reduction)
```

**ROI Timeline:**
- Month 1: Break-even (setup costs)
- Month 2+: $90/month savings
- Year 1: $1,080 savings

---

## Support & Troubleshooting

### Common Issues

**Issue: "API key invalid"**
```typescript
// Check key format
if (!apiKey.startsWith('ac_jettythunder_')) {
  throw new Error('Invalid API key format');
}

// Verify key is not expired
const keyInfo = await validateApiKey(apiKey);
if (!keyInfo) {
  throw new Error('API key not found or expired');
}
```

**Issue: "Rate limit exceeded"**
```typescript
// Implement exponential backoff
async function cacheWithRetry(file: File, retries = 3) {
  try {
    return await agentCache.set(file);
  } catch (err) {
    if (err.status === 429 && retries > 0) {
      await sleep(Math.pow(2, 3 - retries) * 1000);
      return cacheWithRetry(file, retries - 1);
    }
    throw err;
  }
}
```

**Issue: "Namespace collision"**
```typescript
// Always prefix with customer ID
const namespace = `jt_customer_${customerId}`;

// Verify customer ID is sanitized
if (!/^[a-zA-Z0-9_-]+$/.test(customerId)) {
  throw new Error('Invalid customer ID format');
}
```

---

## Next Steps

1. **Contact AgentCache Support** to request enterprise account
2. **Schedule onboarding call** to discuss specific needs
3. **Receive master API key** within 24 hours
4. **Begin pilot integration** with staging environment
5. **Monitor and iterate** based on metrics

### Contact
- Email: support@agentcache.ai
- Slack: #jettythunder-integration
- Emergency: +1 (555) 0123

---

## Appendix: Code Examples

### Complete EdgeCDN Service Integration
```typescript
// src/lib/edge-cdn.ts
import { AgentCache } from 'agentcache-client';

class EdgeCDNService {
  private cache: AgentCache;
  
  constructor() {
    this.cache = new AgentCache({
      apiKey: process.env.AGENTCACHE_API_KEY!,
      baseUrl: process.env.AGENTCACHE_API_URL || 'https://api.agentcache.ai'
    });
  }
  
  async cacheFile(file: File, customerId: string): Promise<string> {
    const namespace = `jt_customer_${customerId}`;
    
    // Check cache first
    const cached = await this.cache.get({
      provider: 'jettythunder',
      model: 'file-delivery',
      messages: [{ role: 'system', content: `file:${file.id}` }],
      namespace
    });
    
    if (cached) {
      console.log(`Cache hit for file ${file.id}`);
      return cached.url;
    }
    
    // Fetch from Lyve Cloud
    const lyveUrl = await this.fetchFromLyve(file);
    
    // Cache for future requests
    await this.cache.set({
      provider: 'jettythunder',
      model: 'file-delivery',
      messages: [{ role: 'system', content: `file:${file.id}` }],
      response: lyveUrl,
      namespace,
      ttl: 86400 // 24 hours
    });
    
    console.log(`Cached file ${file.id} from Lyve`);
    return lyveUrl;
  }
  
  private async fetchFromLyve(file: File): Promise<string> {
    // Existing Lyve Cloud fetch logic
    return file.lyveUrl;
  }
}

export const edgeCDN = new EdgeCDNService();
```
