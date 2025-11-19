# AgentCache Overflow Client

Official partner SDK for integrating AgentCache as an elastic overflow layer.

## Installation

```bash
npm install @agentcache/overflow-client
```

## Usage

```javascript
const AgentCacheOverflow = require('@agentcache/overflow-client');

const overflow = new AgentCacheOverflow({
  partnerId: 'your-partner-id',
  apiKey: 'your-api-key',
  revenueShare: 0.30
});

// Check cache
const result = await overflow.get({
  customerId: 'cust_123',
  request: {
    provider: 'openai',
    model: 'gpt-4',
    messages: [...]
  }
});

if (result.hit) {
  console.log('Cache hit:', result.response);
}
```
