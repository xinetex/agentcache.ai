# Context Caching for Agents (Gemini/Aardvark Style)

## Problem Statement

Agents often have **long conversation contexts** that get repeated:
- System prompts (1K-5K tokens)
- Tool definitions (500-2K tokens per tool)
- Conversation history (grows with each turn)
- Knowledge base excerpts (variable, can be huge)

**Current AgentCache**: Caches entire completions, not context.

**Gemini's Approach**: Cache the *context* (prefix), only pay for new tokens.

---

## Proposed Architecture

### 1. Context Prefix Caching

**Concept**: Separate what changes vs. what stays the same.

```typescript
// Current AgentCache usage
const response = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'system', content: LONG_SYSTEM_PROMPT },     // 2K tokens - same every time
    { role: 'system', content: TOOL_DEFINITIONS },        // 3K tokens - same every time
    { role: 'user', content: 'Previous question' },
    { role: 'assistant', content: 'Previous answer' },
    { role: 'user', content: 'New question' }             // Only this is different!
  ]
});

// Proposed: Context Caching
const response = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  context_prefix: [  // ← Cache this separately
    { role: 'system', content: LONG_SYSTEM_PROMPT },
    { role: 'system', content: TOOL_DEFINITIONS },
  ],
  context_id: 'jettythunder_agent_v1',  // ← Reusable context ID
  messages: [
    { role: 'user', content: 'Previous question' },
    { role: 'assistant', content: 'Previous answer' },
    { role: 'user', content: 'New question' }
  ],
  cache_ttl: 3600  // Context expires in 1 hour
});
```

### 2. Implementation Strategy

**New Redis Keys**:
```
agentcache:context:{context_id}:{hash}          # Stores context embedding/tokens
agentcache:context:{context_id}:metadata        # Stores token count, created_at, expires_at
agentcache:v1:{context_id}:{messages_hash}     # Full cache key includes context
```

**API Changes**:

```javascript
// New endpoint: POST /api/context/register
{
  "context_id": "jettythunder_agent_v1",
  "context_prefix": [...],  // System prompt + tool definitions
  "ttl": 3600  // Cache for 1 hour
}
// Response: { "context_id": "...", "token_count": 5000, "cost_saved_per_call": "$0.05" }

// Modified: POST /api/cache/get
{
  "provider": "openai",
  "model": "gpt-4",
  "context_id": "jettythunder_agent_v1",  // ← Reference cached context
  "messages": [...]  // Only the variable part
}
```

**Cost Calculation**:
- Without context caching: 5K context + 1K new = 6K tokens @ $0.01/1K = $0.06
- With context caching: 1K new tokens only = $0.01
- **Savings: 83% per call**

---

## Use Cases for JettyThunder.app

### 1. Agent System Prompts

**Before**:
```typescript
// Every agent call sends 2K token system prompt
const response = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: JETTYTHUNDER_SYSTEM_PROMPT },  // 2K tokens
    { role: 'user', content: userQuery }
  ]
});
```

**After**:
```typescript
// Register context once
await agentcache.registerContext({
  context_id: 'jt_system_v1',
  prefix: [{ role: 'system', content: JETTYTHUNDER_SYSTEM_PROMPT }],
  ttl: 86400  // 24 hours
});

// Every subsequent call reuses cached context
const response = await agentcache.get({
  context_id: 'jt_system_v1',
  messages: [{ role: 'user', content: userQuery }]
});
```

### 2. Tool-Heavy Agents

**Use case**: Agent with 10 tools (3K tokens of definitions)

```typescript
// Register tool definitions once per deployment
await agentcache.registerContext({
  context_id: 'jt_tools_v2',
  prefix: [
    { role: 'system', content: 'You are an agent with these tools:' },
    { role: 'system', content: JSON.stringify(TOOL_DEFINITIONS) }  // 3K tokens
  ],
  ttl: 3600  // 1 hour (tools might update)
});

// Every agent call: 3K tokens free
```

### 3. Conversation History

**Problem**: Multi-turn conversations grow huge

**Solution**: Cache conversation prefix, only add new turns

```typescript
// Turn 1
await agentcache.registerContext({
  context_id: `conversation_${sessionId}`,
  prefix: [...previousTurns],  // Growing history
  ttl: 1800  // 30 minutes (active conversation)
});

// Turn 2-N: Automatically extend context
await agentcache.get({
  context_id: `conversation_${sessionId}`,
  messages: [{ role: 'user', content: newUserMessage }],
  extend_context: true  // Append new messages to context
});
```

---

## 2. Latent Manipulator Architecture

This is **incredibly relevant** for Phase 3's semantic caching! Let me break down how we can use it:

### Key Insight from Latent Manipulator

**Problem with current caching**:
```
"What is Python?" ≠ "Explain Python" ≠ "Tell me about Python"
→ 3 separate cache misses, even though they mean the same thing!
```

**Solution with Latent Space**:
```
"What is Python?" → [embed] → [latent vector: 0.23, -0.45, ...]
"Explain Python" → [embed] → [latent vector: 0.24, -0.44, ...]  ← 99% similar!
"Tell me about Python" → [embed] → [latent vector: 0.22, -0.46, ...]

→ All map to same cached response (semantic similarity matching)
```

### Implementation Plan for AgentCache.ai

**Phase 3 Feature: Semantic Caching**

#### Step 1: Add Embedding Endpoint

```javascript
// New endpoint: POST /api/cache/semantic-get
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [...],
  "similarity_threshold": 0.95  // Return cached if 95%+ similar
}

// Process:
// 1. Generate embedding of new prompt (OpenAI embeddings API)
// 2. Query Upstash Vector for similar embeddings
// 3. If similarity > threshold, return cached response
// 4. Otherwise, cache miss
```

#### Step 2: Use Latent Manipulator for Agent "Thinking"

**Concept**: Agents can "think" in latent space before responding

```typescript
// Agent workflow with latent manipulation
const thought = await agentcache.manipulate({
  input_latent: promptEmbedding,
  manipulator_id: 'reasoning_agent_v1',  // Pre-trained manipulator
  operation: 'chain_of_thought'
});

// Generate response from manipulated latent
const response = await agentcache.decode({
  latent: thought.output_latent
});
```

**Why this is powerful for agents**:
- **Faster reasoning**: Manipulate 1024-dim vectors vs. generating tokens
- **Consistent logic**: Same latent manipulator = consistent reasoning across agents
- **Cacheable thoughts**: Can cache intermediate reasoning steps

---

## 3. Agent Communication/Notification System

Great idea! Let's build webhook-based notifications:

### Proposed Architecture

```typescript
// JettyThunder.app registers webhook
await agentcache.registerWebhook({
  url: 'https://jettythunder.app/webhooks/agentcache',
  events: [
    'cache.hit',           // Real-time cache hits (for analytics)
    'cache.miss',          // Cache misses (opportunity to optimize prompts)
    'quota.warning',       // At 80% of quota
    'quota.exceeded',      // Quota exceeded
    'anomaly.detected',    // Unusual cache patterns (possible attack)
    'context.expired',     // Cached context expired
    'performance.degraded' // API latency spikes
  ],
  secret: 'webhook_secret_xxx'  // For signature verification
});

// AgentCache sends webhook
POST https://jettythunder.app/webhooks/agentcache
{
  "event": "quota.warning",
  "timestamp": "2025-01-11T10:45:00Z",
  "data": {
    "api_key": "ac_live_xxx",
    "quota": {
      "limit": 150000,
      "used": 120000,
      "remaining": 30000,
      "percent": 80
    },
    "recommendation": "Consider upgrading to Enterprise plan"
  },
  "signature": "sha256=..."  // HMAC signature for verification
}
```

### Use Cases

1. **Proactive Monitoring** (JettyThunder.app dashboard)
   - Real-time alerts when cache hit rate drops
   - Notify when quota approaching limit
   - Alert on unusual patterns (runaway agent?)

2. **Agent-to-Agent Communication**
   - Agent A caches a response
   - Webhook notifies Agent B: "New knowledge available"
   - Agent B can proactively warm cache

3. **Performance Optimization**
   - Webhook on cache.miss with prompt text
   - JettyThunder can analyze which prompts aren't caching
   - Optimize prompts to increase hit rate

---

## Implementation Priority

### This Week (Phase 1.5)
1. ✅ Webhook system (basic)
   - Register webhook endpoint
   - Send `quota.warning` and `quota.exceeded` events

### Next 2 Weeks (Phase 2)
2. 🔜 Context caching (Gemini-style)
   - Register context prefixes
   - Separate context from messages
   - Calculate token savings

### Next 2 Months (Phase 3)
3. 🔜 Semantic caching (Latent Manipulator inspired)
   - Add embeddings API
   - Similarity search in Upstash Vector
   - Cache hits on semantic matches

4. 🔜 Latent manipulation (experimental)
   - Train domain-specific manipulators
   - "Think before you speak" for agents
   - Cache intermediate thoughts

---

## Quick Win: Build Webhook System Today

Want me to implement the webhook notification system right now? It's a 1-hour task that gives JettyThunder immediate value:
- Proactive quota warnings
- Real-time cache analytics
- Foundation for agent-to-agent communication

**Your call**: Should I build it now, or focus on the integration call prep?
