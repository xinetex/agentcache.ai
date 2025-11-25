# JettyThunder Integration Guide for AgentCache

## Overview

This guide explains how to set up JettyThunder to automatically provision storage accounts when AgentCache users sign up or upgrade their plan.

**Flow**:
```
AgentCache User Signs Up
    ↓
AgentCache creates user in database
    ↓
Webhook triggers → JettyThunder API
    ↓
JettyThunder creates storage account
    ↓
Returns API credentials to AgentCache
    ↓
AgentCache stores credentials
    ↓
User can now use multimodal cache
```

## Prerequisites

### On JettyThunder Side
- PostgreSQL database
- Node.js backend (Hono/Express)
- Lyve Cloud S3 credentials
- Webhook endpoint exposed

### On AgentCache Side
- User authentication system
- PostgreSQL database
- Webhook delivery system
- API key management

## Part 1: JettyThunder Database Schema

### Create Tables

```sql
-- JettyThunder Database Schema
-- File: jettythunder-db-schema.sql

-- AgentCache accounts (linked to AgentCache users)
CREATE TABLE agentcache_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- AgentCache user info
  agentcache_user_id UUID NOT NULL UNIQUE,
  agentcache_email VARCHAR(255) NOT NULL,
  agentcache_tier VARCHAR(20) NOT NULL, -- 'free', 'starter', 'pro', 'business', 'enterprise'
  
  -- JettyThunder credentials
  api_key VARCHAR(255) NOT NULL UNIQUE,
  api_secret VARCHAR(255) NOT NULL,
  
  -- Storage allocation (based on AgentCache tier)
  storage_quota_gb INTEGER NOT NULL,
  storage_used_gb DECIMAL(10,2) DEFAULT 0,
  bandwidth_quota_gb INTEGER NOT NULL,
  bandwidth_used_gb DECIMAL(10,2) DEFAULT 0,
  
  -- Features
  jetty_speed_enabled BOOLEAN DEFAULT false,
  
  -- S3 bucket info
  s3_bucket_name VARCHAR(255) NOT NULL,
  s3_prefix VARCHAR(255) NOT NULL, -- User's folder prefix
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP,
  
  -- Constraints
  CONSTRAINT check_tier CHECK (agentcache_tier IN ('free', 'starter', 'pro', 'business', 'enterprise')),
  CONSTRAINT check_status CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_agentcache_accounts_user ON agentcache_accounts(agentcache_user_id);
CREATE INDEX idx_agentcache_accounts_api_key ON agentcache_accounts(api_key);
CREATE INDEX idx_agentcache_accounts_email ON agentcache_accounts(agentcache_email);

-- Storage usage tracking
CREATE TABLE storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agentcache_accounts(id) ON DELETE CASCADE,
  
  -- Usage metrics
  storage_bytes BIGINT NOT NULL,
  bandwidth_bytes BIGINT NOT NULL,
  request_count INTEGER NOT NULL,
  
  -- Period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Cost tracking (internal)
  storage_cost DECIMAL(10,4),
  bandwidth_cost DECIMAL(10,4),
  total_cost DECIMAL(10,4),
  
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_storage_usage_account ON storage_usage(account_id);
CREATE INDEX idx_storage_usage_period ON storage_usage(period_start, period_end);

-- Asset storage (files uploaded via AgentCache)
CREATE TABLE agentcache_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agentcache_accounts(id) ON DELETE CASCADE,
  
  -- S3 storage info
  s3_key TEXT NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  
  -- File metadata
  filename TEXT NOT NULL,
  content_type VARCHAR(100),
  size_bytes BIGINT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE, -- SHA-256 for deduplication
  
  -- Cache info (from AgentCache)
  cache_key TEXT,
  agentcache_pipeline_id UUID,
  
  -- Access tracking
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  
  -- TTL
  expires_at TIMESTAMP,
  
  -- Upload info
  uploaded_via VARCHAR(20) DEFAULT 'api', -- 'api' or 'jettyspeed'
  upload_speed_mbps DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_account ON agentcache_assets(account_id);
CREATE INDEX idx_assets_hash ON agentcache_assets(content_hash);
CREATE INDEX idx_assets_cache_key ON agentcache_assets(cache_key);
CREATE INDEX idx_assets_expires ON agentcache_assets(expires_at);

-- API request logs
CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES agentcache_accounts(id) ON DELETE SET NULL,
  
  -- Request details
  method VARCHAR(10) NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  
  -- Performance
  response_time_ms INTEGER,
  bytes_transferred BIGINT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_requests_account ON api_requests(account_id);
CREATE INDEX idx_api_requests_created ON api_requests(created_at);
```

### Tier Configuration

```sql
-- Seed data: Tier configurations
-- File: seed-tier-configs.sql

CREATE TABLE tier_configs (
  tier VARCHAR(20) PRIMARY KEY,
  storage_quota_gb INTEGER NOT NULL,
  bandwidth_quota_gb INTEGER NOT NULL,
  jetty_speed_enabled BOOLEAN DEFAULT false,
  rate_limit_per_minute INTEGER DEFAULT 60,
  max_file_size_mb INTEGER DEFAULT 100
);

INSERT INTO tier_configs VALUES
  ('free', 0, 0, false, 10, 10),
  ('starter', 2, 10, false, 60, 50),
  ('pro', 20, 50, true, 300, 500),
  ('business', 100, 200, true, 1000, 1000),
  ('enterprise', 1000, 5000, true, 10000, 5000);
```

## Part 2: JettyThunder API Endpoints

### File Structure

```
jettythunder.app/
├── api/
│   ├── agentcache/
│   │   ├── provision.ts       # Create account
│   │   ├── upgrade.ts          # Upgrade tier
│   │   ├── suspend.ts          # Suspend account
│   │   ├── delete.ts           # Delete account
│   │   └── quota.ts            # Get usage stats
│   ├── storage/
│   │   ├── upload.ts           # Upload asset
│   │   ├── download.ts         # Download asset
│   │   ├── delete.ts           # Delete asset
│   │   └── list.ts             # List assets
│   └── webhook/
│       └── agentcache.ts       # Receive webhooks from AgentCache
├── lib/
│   ├── s3-client.ts            # Lyve Cloud S3 client
│   ├── api-key-generator.ts   # Generate secure API keys
│   └── quota-enforcer.ts       # Check and enforce quotas
└── config/
    └── lyve.ts                 # Lyve Cloud configuration
```

### 1. Account Provisioning Endpoint

```typescript
// api/agentcache/provision.ts
// POST /api/agentcache/provision

import { Hono } from 'hono';
import { db } from '@/lib/database';
import { generateApiKey, generateApiSecret } from '@/lib/api-key-generator';
import { createS3Bucket, createUserPrefix } from '@/lib/s3-client';

const app = new Hono();

interface ProvisionRequest {
  agentcache_user_id: string;
  agentcache_email: string;
  tier: 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
  webhook_url?: string; // For status updates
}

app.post('/api/agentcache/provision', async (c) => {
  try {
    // Authenticate request (shared secret between AgentCache and JettyThunder)
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${process.env.AGENTCACHE_WEBHOOK_SECRET}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body: ProvisionRequest = await c.req.json();
    const { agentcache_user_id, agentcache_email, tier } = body;

    // Validate input
    if (!agentcache_user_id || !agentcache_email || !tier) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check if account already exists
    const existing = await db.query(
      'SELECT * FROM agentcache_accounts WHERE agentcache_user_id = $1',
      [agentcache_user_id]
    );

    if (existing.rows.length > 0) {
      return c.json({ error: 'Account already exists' }, 409);
    }

    // Get tier configuration
    const tierConfig = await db.query(
      'SELECT * FROM tier_configs WHERE tier = $1',
      [tier]
    );

    if (tierConfig.rows.length === 0) {
      return c.json({ error: 'Invalid tier' }, 400);
    }

    const config = tierConfig.rows[0];

    // Generate API credentials
    const apiKey = generateApiKey('jt'); // Prefix: jt_xxxxx
    const apiSecret = generateApiSecret();

    // Create S3 bucket/prefix for user
    const s3BucketName = process.env.LYVE_BUCKET_NAME || 'agentcache-assets';
    const s3Prefix = `users/${agentcache_user_id}`;

    // Ensure S3 bucket exists and create user prefix
    await createUserPrefix(s3BucketName, s3Prefix);

    // Insert into database
    const result = await db.query(
      `INSERT INTO agentcache_accounts (
        agentcache_user_id,
        agentcache_email,
        agentcache_tier,
        api_key,
        api_secret,
        storage_quota_gb,
        bandwidth_quota_gb,
        jetty_speed_enabled,
        s3_bucket_name,
        s3_prefix,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, api_key, created_at`,
      [
        agentcache_user_id,
        agentcache_email,
        tier,
        apiKey,
        apiSecret, // In production: hash this!
        config.storage_quota_gb,
        config.bandwidth_quota_gb,
        config.jetty_speed_enabled,
        s3BucketName,
        s3Prefix,
        'active'
      ]
    );

    const account = result.rows[0];

    // Log provisioning
    console.log(`Provisioned JettyThunder account for AgentCache user ${agentcache_user_id}`);

    return c.json({
      success: true,
      account: {
        id: account.id,
        api_key: apiKey,
        api_secret: apiSecret, // ⚠️ Only returned once!
        tier: tier,
        storage_quota_gb: config.storage_quota_gb,
        bandwidth_quota_gb: config.bandwidth_quota_gb,
        jetty_speed_enabled: config.jetty_speed_enabled,
        created_at: account.created_at
      }
    }, 201);

  } catch (error) {
    console.error('Provision error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
```

### 2. Upgrade Account Endpoint

```typescript
// api/agentcache/upgrade.ts
// POST /api/agentcache/upgrade

import { Hono } from 'hono';
import { db } from '@/lib/database';

const app = new Hono();

interface UpgradeRequest {
  agentcache_user_id: string;
  new_tier: 'starter' | 'pro' | 'business' | 'enterprise';
}

app.post('/api/agentcache/upgrade', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${process.env.AGENTCACHE_WEBHOOK_SECRET}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body: UpgradeRequest = await c.req.json();
    const { agentcache_user_id, new_tier } = body;

    // Get new tier config
    const tierConfig = await db.query(
      'SELECT * FROM tier_configs WHERE tier = $1',
      [new_tier]
    );

    if (tierConfig.rows.length === 0) {
      return c.json({ error: 'Invalid tier' }, 400);
    }

    const config = tierConfig.rows[0];

    // Update account
    const result = await db.query(
      `UPDATE agentcache_accounts SET
        agentcache_tier = $1,
        storage_quota_gb = $2,
        bandwidth_quota_gb = $3,
        jetty_speed_enabled = $4,
        updated_at = NOW()
      WHERE agentcache_user_id = $5
      RETURNING id, agentcache_tier, storage_quota_gb`,
      [
        new_tier,
        config.storage_quota_gb,
        config.bandwidth_quota_gb,
        config.jetty_speed_enabled,
        agentcache_user_id
      ]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404);
    }

    const account = result.rows[0];

    console.log(`Upgraded AgentCache user ${agentcache_user_id} to ${new_tier}`);

    return c.json({
      success: true,
      account: {
        id: account.id,
        tier: account.agentcache_tier,
        storage_quota_gb: account.storage_quota_gb
      }
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
```

### 3. API Key Generator

```typescript
// lib/api-key-generator.ts

import crypto from 'crypto';

/**
 * Generate API key with prefix
 * Format: jt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
export function generateApiKey(prefix: string = 'jt'): string {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const random = crypto.randomBytes(24).toString('base64url'); // URL-safe base64
  return `${prefix}_${env}_${random}`;
}

/**
 * Generate API secret (longer, more secure)
 * Format: jts_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
export function generateApiSecret(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `jts_${random}`;
}

/**
 * Hash API secret for storage
 * Never store secrets in plaintext!
 */
export function hashApiSecret(secret: string): string {
  return crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex');
}

/**
 * Verify API credentials
 */
export async function verifyApiKey(apiKey: string, apiSecret: string): Promise<boolean> {
  const hashedSecret = hashApiSecret(apiSecret);
  
  // In production, query database:
  // SELECT * FROM agentcache_accounts WHERE api_key = $1 AND api_secret_hash = $2
  
  return true; // Placeholder
}
```

### 4. S3 Client (Lyve Cloud)

```typescript
// lib/s3-client.ts

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.LYVE_REGION || 'us-east-1',
  endpoint: process.env.LYVE_ENDPOINT, // e.g., https://s3.lyvecloud.seagate.com
  credentials: {
    accessKeyId: process.env.LYVE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.LYVE_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true // Required for Lyve Cloud
});

/**
 * Create user folder in S3
 */
export async function createUserPrefix(bucket: string, prefix: string): Promise<void> {
  // S3 doesn't have folders, but we can create a marker object
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `${prefix}/.keep`,
    Body: '',
    ContentType: 'text/plain'
  });

  await s3Client.send(command);
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ success: boolean; size: number }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType
  });

  await s3Client.send(command);

  return {
    success: true,
    size: data.length
  };
}

/**
 * Generate presigned download URL
 */
export async function generateDownloadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(bucket: string, key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  });

  await s3Client.send(command);
}

/**
 * List user's files
 */
export async function listUserFiles(
  bucket: string,
  prefix: string,
  maxKeys: number = 1000
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: maxKeys
  });

  const response = await s3Client.send(command);

  return (response.Contents || []).map(obj => ({
    key: obj.Key!,
    size: obj.Size!,
    lastModified: obj.LastModified!
  }));
}
```

### 5. Environment Variables

```bash
# .env
# JettyThunder configuration

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jettythunder

# Lyve Cloud S3
LYVE_ENDPOINT=https://s3.lyvecloud.seagate.com
LYVE_REGION=us-east-1
LYVE_ACCESS_KEY_ID=your_access_key
LYVE_SECRET_ACCESS_KEY=your_secret_key
LYVE_BUCKET_NAME=agentcache-assets

# AgentCache Integration
AGENTCACHE_WEBHOOK_SECRET=shared_secret_here_123456789
AGENTCACHE_API_URL=https://agentcache.ai/api

# JettySpeed CDN
JETTYSPEED_ENABLED=true
JETTYSPEED_CDN_URL=http://localhost:53777

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Part 3: AgentCache Integration

### Webhook Delivery from AgentCache

```typescript
// agentcache-ai/api/webhooks/provision-storage.ts
// Triggered when user signs up or upgrades

import { db } from '@/lib/database';

export async function provisionJettyThunderStorage(
  userId: string,
  email: string,
  tier: string
): Promise<{ success: boolean; credentials?: any; error?: string }> {
  try {
    // Call JettyThunder provisioning API
    const response = await fetch('https://jettythunder.app/api/agentcache/provision', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.JETTYTHUNDER_WEBHOOK_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentcache_user_id: userId,
        agentcache_email: email,
        tier: tier
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('JettyThunder provisioning failed:', error);
      return { success: false, error: error.message };
    }

    const data = await response.json();

    // Store credentials in AgentCache database
    await db.query(
      `INSERT INTO jettythunder_credentials (
        user_id,
        api_key,
        api_secret,
        tier,
        storage_quota_gb,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        data.account.api_key,
        data.account.api_secret, // ⚠️ Encrypt in production!
        tier,
        data.account.storage_quota_gb
      ]
    );

    console.log(`✅ Provisioned JettyThunder storage for user ${userId}`);

    return {
      success: true,
      credentials: {
        api_key: data.account.api_key,
        storage_quota_gb: data.account.storage_quota_gb,
        jetty_speed_enabled: data.account.jetty_speed_enabled
      }
    };

  } catch (error) {
    console.error('Failed to provision JettyThunder storage:', error);
    return { success: false, error: error.message };
  }
}
```

### Usage in AgentCache Sign-Up Flow

```typescript
// agentcache-ai/api/auth/signup.ts

import { provisionJettyThunderStorage } from '@/api/webhooks/provision-storage';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  // 1. Create AgentCache user
  const user = await createUser(email, password);

  // 2. Determine initial tier
  const tier = 'free'; // or 'starter' if they selected a paid plan

  // 3. Provision JettyThunder storage
  const storageResult = await provisionJettyThunderStorage(
    user.id,
    user.email,
    tier
  );

  if (!storageResult.success) {
    console.error('Failed to provision storage:', storageResult.error);
    // Don't block signup, retry later
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email
    },
    storage: storageResult.credentials
  });
}
```

## Part 4: Testing the Integration

### 1. Provision Test Account

```bash
curl -X POST https://jettythunder.app/api/agentcache/provision \
  -H "Authorization: Bearer shared_secret_123" \
  -H "Content-Type: application/json" \
  -d '{
    "agentcache_user_id": "test-user-123",
    "agentcache_email": "test@example.com",
    "tier": "pro"
  }'
```

Expected response:
```json
{
  "success": true,
  "account": {
    "id": "uuid-here",
    "api_key": "jt_live_xxxxxxxx",
    "api_secret": "jts_xxxxxxxx",
    "tier": "pro",
    "storage_quota_gb": 20,
    "bandwidth_quota_gb": 50,
    "jetty_speed_enabled": true,
    "created_at": "2025-01-25T10:15:00Z"
  }
}
```

### 2. Test File Upload

```bash
curl -X POST https://jettythunder.app/api/storage/upload \
  -H "Authorization: Bearer jt_live_xxxxxxxx" \
  -H "X-API-Secret: jts_xxxxxxxx" \
  -F "file=@test-image.jpg" \
  -F "cache_key=dalle_image_sunset_beach"
```

### 3. Check Quota

```bash
curl -X GET https://jettythunder.app/api/agentcache/quota \
  -H "Authorization: Bearer jt_live_xxxxxxxx" \
  -H "X-API-Secret: jts_xxxxxxxx"
```

Expected response:
```json
{
  "tier": "pro",
  "storage": {
    "quota_gb": 20,
    "used_gb": 1.2,
    "available_gb": 18.8,
    "percent_used": 6.0
  },
  "bandwidth": {
    "quota_gb": 50,
    "used_gb": 3.5,
    "available_gb": 46.5
  }
}
```

## Part 5: Pre-Seeding & Initialization

### Database Initialization Script

```bash
#!/bin/bash
# init-jettythunder-db.sh

echo "Initializing JettyThunder database for AgentCache integration..."

# 1. Create tables
psql $DATABASE_URL < jettythunder-db-schema.sql

# 2. Seed tier configurations
psql $DATABASE_URL < seed-tier-configs.sql

# 3. Create S3 bucket if it doesn't exist
aws s3 mb s3://agentcache-assets --endpoint-url=$LYVE_ENDPOINT

# 4. Set bucket CORS policy
cat > cors-policy.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://agentcache.ai"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket agentcache-assets \
  --cors-configuration file://cors-policy.json \
  --endpoint-url=$LYVE_ENDPOINT

echo "✅ JettyThunder database initialized!"
```

### Run Initialization

```bash
chmod +x init-jettythunder-db.sh
./init-jettythunder-db.sh
```

## Part 6: Monitoring & Maintenance

### Daily Cleanup Job

```typescript
// jobs/cleanup-expired-assets.ts
// Remove expired assets from S3

import { db } from '@/lib/database';
import { deleteFromS3 } from '@/lib/s3-client';

export async function cleanupExpiredAssets() {
  const expiredAssets = await db.query(`
    SELECT id, s3_bucket, s3_key
    FROM agentcache_assets
    WHERE expires_at < NOW()
    AND expires_at IS NOT NULL
  `);

  for (const asset of expiredAssets.rows) {
    try {
      await deleteFromS3(asset.s3_bucket, asset.s3_key);
      await db.query('DELETE FROM agentcache_assets WHERE id = $1', [asset.id]);
      console.log(`Deleted expired asset: ${asset.s3_key}`);
    } catch (error) {
      console.error(`Failed to delete asset ${asset.id}:`, error);
    }
  }
}

// Run daily at 2 AM
// cron: 0 2 * * *
```

### Usage Monitoring

```typescript
// jobs/update-usage-stats.ts
// Calculate daily usage for billing

import { db } from '@/lib/database';

export async function updateUsageStats() {
  const accounts = await db.query('SELECT id FROM agentcache_accounts WHERE status = \'active\'');

  for (const account of accounts.rows) {
    // Calculate storage usage
    const storageResult = await db.query(`
      SELECT COALESCE(SUM(size_bytes), 0) as total_bytes
      FROM agentcache_assets
      WHERE account_id = $1
    `, [account.id]);

    const storageGB = storageResult.rows[0].total_bytes / (1024 ** 3);

    // Update account
    await db.query(`
      UPDATE agentcache_accounts
      SET storage_used_gb = $1, updated_at = NOW()
      WHERE id = $2
    `, [storageGB, account.id]);
  }
}

// Run every hour
// cron: 0 * * * *
```

## Summary Checklist

### JettyThunder Setup
- [ ] PostgreSQL database created
- [ ] Tables and indexes created
- [ ] Tier configurations seeded
- [ ] Lyve Cloud S3 bucket created
- [ ] API endpoints deployed
- [ ] Environment variables configured
- [ ] Webhook secret shared with AgentCache
- [ ] Cron jobs scheduled

### AgentCache Integration
- [ ] Webhook endpoints created
- [ ] JettyThunder credentials table created
- [ ] Sign-up flow triggers provisioning
- [ ] Upgrade flow triggers tier change
- [ ] Multimodal cache uses JettyThunder API
- [ ] Storage quota warnings implemented

### Testing
- [ ] Provision test account
- [ ] Upload test file
- [ ] Download test file
- [ ] Delete test file
- [ ] Check quota endpoint
- [ ] Test tier upgrade
- [ ] Verify JettySpeed fallback

## Support

If you encounter issues:

1. Check logs: `tail -f /var/log/jettythunder/api.log`
2. Verify database connection: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM agentcache_accounts"`
3. Test S3 connection: `aws s3 ls s3://agentcache-assets --endpoint-url=$LYVE_ENDPOINT`
4. Check webhook delivery: Monitor AgentCache webhook logs

---

**Ready to integrate!** Let me know when JettyThunder database is initialized and I'll help test the flow.
