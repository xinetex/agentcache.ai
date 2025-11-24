# LlamaIndex Integration

Use AgentCache to cache index queries and ingestion steps.

## Python

```python
from llama_index.core import VectorStoreIndex
from agentcache import AgentCache

cache = AgentCache()

def cached_query(index, query_text):
    # 1. Check Cache
    cached_response = cache.get(query_text)
    if cached_response:
        return cached_response

    # 2. Query Index
    query_engine = index.as_query_engine()
    response = query_engine.query(query_text)

    # 3. Store Result
    cache.set(query_text, str(response))
    return response

# Usage
index = VectorStoreIndex.from_documents(documents)
response = cached_query(index, "What is the summary?")
print(response)
```
