# AgentCache Python SDK

Official Python client library for [AgentCache.ai](https://agentcache.ai) - Cognitive Caching for AI Agents.

## Installation

```bash
pip install agentcache
```

## Quick Start

```python
from agentcache import AgentCache, Sector

# Initialize client
cache = AgentCache(
    api_key="sk_live_...",  # or set AGENTCACHE_API_KEY env var
    sector=Sector.HEALTHCARE
)

# Query the cache
response = cache.query("What is HIPAA compliance?")
print(f"Result: {response.result}")
print(f"Cache hit: {response.cache_hit}")
print(f"Latency: {response.metrics.latency_ms}ms")
```

## Async Usage

```python
import asyncio
from agentcache import AgentCache, Sector

async def main():
    cache = AgentCache(api_key="sk_live_...", sector=Sector.FINANCE)
    
    response = await cache.query_async("What is PCI-DSS?")
    print(response.result)

asyncio.run(main())
```

## Features

### ✅ Sector-Specific Caching

```python
from agentcache import AgentCache, Sector

# Healthcare with HIPAA compliance
healthcare_cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.HEALTHCARE,
    compliance=["HIPAA", "HITECH"]
)

# Finance with PCI-DSS
finance_cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.FINANCE,
    compliance=["PCI-DSS", "SOC2"]
)
```

### ✅ Context & Metadata

```python
response = cache.query(
    prompt="Diagnose patient symptoms",
    context={"patient_id": "encrypted_123", "history": [...]},
    metadata={"session_id": "abc", "user_id": "doctor_1"}
)
```

### ✅ Custom TTL & Namespaces

```python
# Multi-tenant isolation
cache = AgentCache(
    api_key="sk_live_...",
    namespace="org:acme:team:marketing"
)

# Custom cache lifetime
response = cache.query(
    prompt="What's the weather?",
    ttl=300  # 5 minutes
)
```

### ✅ Retry Logic & Error Handling

```python
from agentcache import AgentCache, RateLimitError, AuthenticationError

cache = AgentCache(
    api_key="sk_live_...",
    max_retries=5,
    timeout=30
)

try:
    response = cache.query("What is AI?")
except RateLimitError as e:
    print(f"Rate limit hit. Retry after {e.retry_after}s")
except AuthenticationError:
    print("Invalid API key")
```

### ✅ Webhooks

```python
from agentcache import WebhookConfig

webhook = cache.create_webhook(WebhookConfig(
    url="https://myapp.com/webhooks",
    events=["cache.hit", "cache.miss", "cache.invalidate"],
    secret="webhook_secret_123"
))
```

### ✅ Pipeline Management

```python
# Get pipeline config
pipeline = cache.get_pipeline("pipeline_abc123")
print(f"Nodes: {len(pipeline.nodes)}")
print(f"Compliance: {pipeline.compliance}")
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

### Context Manager

```python
with AgentCache(api_key="sk_live_...") as cache:
    response = cache.query("What is AGI?")
    print(response.result)
```

### Async Context Manager

```python
async with AgentCache(api_key="sk_live_...") as cache:
    response = await cache.query_async("What is RAG?")
    print(response.result)
```

### Cache Invalidation

```python
# Invalidate specific cache entry
cache.invalidate("cache_key_abc123")

# Async
await cache.invalidate_async("cache_key_abc123")
```

## API Reference

See full documentation at: [https://docs.agentcache.ai/sdk/python](https://docs.agentcache.ai/sdk/python)

## Examples

### Healthcare AI Assistant

```python
from agentcache import AgentCache, Sector, ComplianceFramework

cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.HEALTHCARE,
    compliance=[ComplianceFramework.HIPAA]
)

response = cache.query(
    prompt="What are the symptoms of diabetes?",
    context={"patient_age": 45, "medical_history": [...]}
)

print(f"Diagnosis: {response.result}")
print(f"Compliance validated: {response.compliance_validated}")
```

### Financial Trading Bot

```python
from agentcache import AgentCache, Sector

cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.FINANCE,
    timeout=10,  # Low latency required
    max_retries=5
)

response = cache.query(
    prompt="Analyze AAPL stock trend",
    context={"market_data": current_prices},
    ttl=60  # Refresh every minute
)

print(f"Analysis: {response.result}")
print(f"Latency: {response.metrics.latency_ms}ms")
```

### Legal Research

```python
from agentcache import AgentCache, Sector

cache = AgentCache(
    api_key="sk_live_...",
    sector=Sector.LEGAL
)

response = cache.query(
    prompt="Find non-compete clauses in tech employment",
    context={"jurisdiction": "California"},
    ttl=604800  # 7 days
)

print(f"Precedents: {response.result}")
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy agentcache/

# Linting
ruff check agentcache/

# Formatting
black agentcache/
```

## Support

- **Documentation:** [docs.agentcache.ai](https://docs.agentcache.ai)
- **Issues:** [GitHub Issues](https://github.com/agentcache/python-sdk/issues)
- **Email:** support@agentcache.ai

## License

MIT License - see [LICENSE](LICENSE) for details.
