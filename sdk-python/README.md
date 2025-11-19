# AgentCache Python Client

Official Python client for [AgentCache.ai](https://agentcache.ai) - The Global Edge Cache for LLMs.

## Installation

```bash
pip install agentcache
```

## Usage

### Standard Completion

```python
import agentcache

# Drop-in replacement for OpenAI call logic
response = agentcache.completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello world"}],
    provider="openai"  # optional, defaults to openai
)

if response and response.get('hit'):
    print("Cache HIT:", response['response'])
else:
    print("Cache MISS - Call your LLM here")
```

### Streaming

AgentCache supports streaming responses, making it compatible with chat UIs that expect Server-Sent Events (SSE).

```python
stream = agentcache.completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True
)

if stream:
    print("Cache HIT (Streaming):")
    for chunk in stream:
        content = chunk['choices'][0]['delta'].get('content', '')
        print(content, end="", flush=True)
```

## Environment Variables

Set `AGENTCACHE_API_KEY` in your environment, or pass `api_key` to the constructor.

```python
from agentcache import AgentCache

client = AgentCache(api_key="ac_live_...")
```
