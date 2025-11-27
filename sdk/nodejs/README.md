# @agentcache/sdk

Official Node.js/TypeScript client library for [AgentCache.ai](https://agentcache.ai) - Cognitive Caching for AI Agents.

## Installation

```bash
npm install @agentcache/sdk
# or
yarn add @agentcache/sdk
# or
pnpm add @agentcache/sdk
```

## Quick Start

### TypeScript

```typescript
import { AgentCache, Sector } from '@agentcache/sdk';

// Initialize client
const cache = new AgentCache({
  apiKey: 'sk_live_...', // or set AGENTCACHE_API_KEY env var
  sector: Sector.HEALTHCARE,
});

// Query the cache
const response = await cache.query('What is HIPAA compliance?');
console.log(`Result: ${response.result}`);
console.log(`Cache hit: ${response.cache_hit}`);
console.log(`Latency: ${response.metrics?.latency_ms}ms`);
```

### JavaScript

```javascript
const { AgentCache, Sector } = require('@agentcache/sdk');

const cache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.FINANCE,
});

const response = await cache.query('What is PCI-DSS?');
console.log(response.result);
```

## Features

### ✅ Sector-Specific Caching

```typescript
import { AgentCache, Sector, ComplianceFramework } from '@agentcache/sdk';

// Healthcare with HIPAA compliance
const healthcareCache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.HEALTHCARE,
  compliance: [ComplianceFramework.HIPAA, ComplianceFramework.HITECH],
});

// Finance with PCI-DSS
const financeCache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.FINANCE,
  compliance: [ComplianceFramework.PCI_DSS, ComplianceFramework.SOC2],
});
```

### ✅ Context & Metadata

```typescript
const response = await cache.query('Diagnose patient symptoms', {
  context: {
    patient_id: 'encrypted_123',
    history: [...],
  },
  metadata: {
    session_id: 'abc',
    user_id: 'doctor_1',
  },
});
```

### ✅ Custom TTL & Namespaces

```typescript
// Multi-tenant isolation
const cache = new AgentCache({
  apiKey: 'sk_live_...',
  namespace: 'org:acme:team:marketing',
});

// Custom cache lifetime
const response = await cache.query("What's the weather?", {
  ttl: 300, // 5 minutes
});
```

### ✅ Retry Logic & Error Handling

```typescript
import {
  AgentCache,
  RateLimitError,
  AuthenticationError,
} from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: 'sk_live_...',
  maxRetries: 5,
  timeout: 30000, // 30 seconds
});

try {
  const response = await cache.query('What is AI?');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limit hit. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  }
}
```

### ✅ Webhooks

```typescript
const webhook = await cache.createWebhook({
  url: 'https://myapp.com/webhooks',
  events: ['cache.hit', 'cache.miss', 'cache.invalidate'],
  secret: 'webhook_secret_123',
});

// List webhooks
const webhooks = await cache.listWebhooks();

// Delete webhook
await cache.deleteWebhook('webhook_id');
```

### ✅ Pipeline Management

```typescript
// Get pipeline config
const pipeline = await cache.getPipeline('pipeline_abc123');
console.log(`Nodes: ${pipeline.nodes.length}`);
console.log(`Compliance: ${pipeline.compliance}`);
```

## Supported Sectors

- `Sector.HEALTHCARE` - HIPAA-compliant medical AI
- `Sector.FINANCE` - PCI-DSS financial services
- `Sector.LEGAL` - Attorney-client privilege protection
- `Sector.EDUCATION` - FERPA-compliant learning systems
- `Sector.ECOMMERCE` - Product recommendations
- `Sector.ENTERPRISE` - Internal IT support
- `Sector.DEVELOPER` - Code generation & debugging
- `Sector.DATASCIENCE` - RAG & data analytics
- `Sector.GOVERNMENT` - FedRAMP-compliant systems
- `Sector.GENERAL` - General-purpose caching

## Compliance Frameworks

All major compliance frameworks supported:

- **Healthcare:** HIPAA, HITECH
- **Finance:** PCI-DSS, SOC2, FINRA, GLBA
- **Privacy:** GDPR, CCPA, FERPA
- **Government:** FedRAMP, ITAR

## Advanced Usage

### Cache Invalidation

```typescript
// Invalidate specific cache entry
await cache.invalidate('cache_key_abc123');
```

### Type Safety with Zod

```typescript
import { QueryRequestSchema } from '@agentcache/sdk';

const request = QueryRequestSchema.parse({
  prompt: 'What is AI?',
  ttl: 3600,
});
```

## API Reference

See full documentation at: [https://docs.agentcache.ai/sdk/nodejs](https://docs.agentcache.ai/sdk/nodejs)

## Examples

### Healthcare AI Assistant

```typescript
import { AgentCache, Sector, ComplianceFramework } from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.HEALTHCARE,
  compliance: [ComplianceFramework.HIPAA],
});

const response = await cache.query('What are the symptoms of diabetes?', {
  context: {
    patient_age: 45,
    medical_history: [...],
  },
});

console.log(`Diagnosis: ${response.result}`);
console.log(`Compliance validated: ${response.compliance_validated}`);
```

### Financial Trading Bot

```typescript
import { AgentCache, Sector } from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.FINANCE,
  timeout: 10000, // Low latency required
  maxRetries: 5,
});

const response = await cache.query('Analyze AAPL stock trend', {
  context: { market_data: currentPrices },
  ttl: 60, // Refresh every minute
});

console.log(`Analysis: ${response.result}`);
console.log(`Latency: ${response.metrics?.latency_ms}ms`);
```

### Express.js Integration

```typescript
import express from 'express';
import { AgentCache, Sector } from '@agentcache/sdk';

const app = express();
const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY!,
  sector: Sector.GENERAL,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await cache.query(message);
    res.json({ result: response.result, cached: response.cache_hit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### Next.js App Router

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AgentCache, Sector } from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY!,
  sector: Sector.DEVELOPER,
});

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  const response = await cache.query(prompt, {
    context: {
      user_id: request.headers.get('x-user-id'),
    },
  });

  return NextResponse.json({
    result: response.result,
    cached: response.cache_hit,
    latency: response.metrics?.latency_ms,
  });
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Support

- **Documentation:** [docs.agentcache.ai](https://docs.agentcache.ai)
- **Issues:** [GitHub Issues](https://github.com/agentcache/nodejs-sdk/issues)
- **Email:** support@agentcache.ai

## License

MIT License - see [LICENSE](LICENSE) for details.
