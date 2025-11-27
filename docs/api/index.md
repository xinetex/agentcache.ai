# AgentCache API Documentation

Welcome to the AgentCache.ai API documentation - the cognitive caching platform for AI agents.

## Overview

AgentCache provides sector-specific caching optimized for AI workloads with built-in compliance frameworks and intelligent invalidation strategies.

### Key Features

- **🏥 Sector-Specific** - Pre-configured pipelines for 10 market sectors
- **🔒 Compliance-First** - HIPAA, PCI-DSS, SOC2, FERPA, FedRAMP support
- **⚡ High Performance** - Sub-50ms latency with 75-94% hit rates
- **🔄 Smart Invalidation** - Event-based cache invalidation
- **📊 Analytics** - Real-time metrics and cost tracking

## Getting Started

### 1. Get Your API Key

Sign up at [agentcache.ai](https://agentcache.ai) to get your API key.

### 2. Install SDK

**Python:**
```bash
pip install agentcache
```

**Node.js:**
```bash
npm install @agentcache/sdk
```

### 3. Make Your First Request

**Python:**
```python
from agentcache import AgentCache, Sector

cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.HEALTHCARE
)

response = cache.query("What is HIPAA compliance?")
print(response.result)
```

**Node.js:**
```typescript
import { AgentCache, Sector } from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: 'sk_live_...',
  sector: Sector.HEALTHCARE
});

const response = await cache.query('What is HIPAA compliance?');
console.log(response.result);
```

## Core Concepts

### Sectors

AgentCache provides pre-configured pipeline templates for different industries:

- **Healthcare** - HIPAA-compliant medical AI
- **Finance** - PCI-DSS financial services
- **Legal** - Attorney-client privilege protection
- **Education** - FERPA-compliant learning
- **E-commerce** - Product recommendations
- **Enterprise** - Internal IT support
- **Developer** - Code generation
- **Data Science** - RAG & analytics
- **Government** - FedRAMP systems
- **General** - General-purpose caching

### Compliance Frameworks

Built-in support for:
- HIPAA, HITECH (Healthcare)
- PCI-DSS, SOC2, FINRA, GLBA (Finance)
- GDPR, CCPA (Privacy)
- FERPA (Education)
- FedRAMP, ITAR (Government)

### Cache Tiers

- **Basic** - Simple LLM response caching
- **Advanced** - Multi-layer with semantic matching
- **Enterprise** - Custom nodes + compliance enforcement

## API Endpoints

### Base URL
```
https://agentcache.ai
```

### Authentication
All API requests require authentication via Bearer token:
```
Authorization: Bearer sk_live_...
```

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cache/query` | POST | Query or populate cache |
| `/api/cache/invalidate/:key` | DELETE | Invalidate cache entry |
| `/api/pipelines/:id` | GET | Get pipeline configuration |
| `/api/webhooks` | POST | Create webhook subscription |
| `/api/webhooks` | GET | List webhooks |
| `/api/webhooks/:id` | DELETE | Delete webhook |

## Quick Links

- [Python SDK Reference](./python-sdk.md)
- [Node.js SDK Reference](./nodejs-sdk.md)
- [REST API Reference](./rest-api.md)
- [Webhooks Guide](./webhooks.md)
- [Compliance Guide](./compliance.md)
- [Sector Examples](./examples/)

## Rate Limits

| Tier | Requests/min | Concurrent |
|------|-------------|-----------|
| Free | 100 | 5 |
| Pro | 1,000 | 50 |
| Enterprise | Custom | Custom |

## Support

- **Documentation:** [docs.agentcache.ai](https://docs.agentcache.ai)
- **GitHub:** [github.com/agentcache](https://github.com/agentcache)
- **Email:** support@agentcache.ai
- **Slack:** [community.agentcache.ai](https://community.agentcache.ai)

## Status

Check system status at [status.agentcache.ai](https://status.agentcache.ai)

---

**Next Steps:**
- Explore [sector examples](./examples/)
- Read the [REST API reference](./rest-api.md)
- Learn about [webhooks](./webhooks.md)
