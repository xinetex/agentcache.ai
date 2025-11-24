# AgentCache Python SDK

The official Python client for [AgentCache](https://agentcache.ai) - Lightning-fast caching for AI agents.

## Installation

```bash
pip install agentcache
```

## Quick Start

```python
from agentcache import AgentCache

# Initialize
cache = AgentCache(api_key="ac_live_...")

# Cache expensive LLM calls
result = cache.get_or_set(
    "my_prompt",
    lambda: my_expensive_llm_call()
)
```

## Features

- **One-line integration**: Replace expensive calls with `cache.get_or_set()`
- **Semantic caching**: Matches similar prompts automatically
- **Model routing**: Get optimal LLM recommendations
- **Zero config**: Just your API key

## API

### `AgentCache(api_key, base_url=...)`
Initialize the client.

### `cache.get(key)`
Get cached value by key.

### `cache.set(key, value, ttl=3600)`
Set cache value with TTL.

### `cache.get_or_set(key, fn, ttl=3600)`
Get from cache or compute and cache the result.

### `cache.invalidate(pattern="*")`
Invalidate cache entries matching pattern.

### `cache.route(prompt)`
Get optimal model routing for a prompt.

## License

MIT © AgentCache
