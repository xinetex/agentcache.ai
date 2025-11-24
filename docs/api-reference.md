# AgentCache API Reference

## Authentication
All API requests require a Bearer Token in the header:
`Authorization: Bearer ac_live_...`

## Cache API

### Get Item
Retrieves a value from the cache.
- **Endpoint**: `GET /api/cache/get`
- **Query Params**: `key` (string, required)
- **Response**: `{ "value": "..." }` or `404 Not Found`

### Set Item
Stores a value in the cache.
- **Endpoint**: `POST /api/cache/set`
- **Body**:
  ```json
  {
    "key": "user:123",
    "value": "data",
    "ttl": 3600,
    "namespace": "optional"
  }
  ```

### Invalidate
Removes items matching a pattern.
- **Endpoint**: `POST /api/cache/invalidate`
- **Body**: `{ "pattern": "user:*" }`

## Intelligent Router
Routes prompts to the most cost-effective model.
- **Endpoint**: `POST /api/router/route`
- **Body**: `{ "prompt": "..." }`
- **Response**:
  ```json
  {
    "model": "gpt-4o-mini",
    "reasoning": "Simple query",
    "confidence": 0.95
  }
  ```

## Listeners (Webhooks)
Register URLs to receive cache updates.
- **Endpoint**: `POST /api/listeners/register`
- **Body**: `{ "url": "https://..." }`

## SDK Reference

### Python (`agentcache`)
```python
from agentcache import AgentCache
cache = AgentCache()

# Methods
cache.get(key)
cache.set(key, value, ttl=3600)
cache.get_or_set(key, fn)
cache.route(prompt)
cache.invalidate(pattern)
```

### Node.js (`agentcache`)
```javascript
import { agentcache } from 'agentcache';

// Methods
await agentcache.get(key);
await agentcache.set(key, value, { ttl });
await agentcache.getOrSet(key, fn);

// Middleware
app.use(agentCacheMiddleware({ ... }));

// Wrapper
const cachedFn = withCache(fn);
```
