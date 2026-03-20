# AgentCache MCP Plugin - Universal Integration Requirements

**From**: JettyThunder Labs - SOR Platform (First Production User)  
**To**: AgentCache.ai Team  
**Date**: 2024-11-24  

This document provides requirements and recommendations for making the AgentCache MCP plugin work seamlessly for most Node.js/Express-based AI applications.

---

## Executive Summary

**Our Use Case**: Educational AI platform (React + Express + Gemini API) with 70+ research sources, RAG implementation, and authenticated chat system serving teachers.

**What We Need**: Drop-in caching for Gemini API calls with minimal code changes, semantic caching for RAG queries, and memory persistence across user sessions.

**Key Insight**: Most AI apps follow similar patterns - make your plugin work for these patterns and you'll cover 80% of use cases.

---

## Common Architecture Patterns (80% of AI Apps)

### Pattern 1: Express + LLM API (95% similarity to our app)

```javascript
// Typical chat endpoint structure
app.post('/api/chat', authenticateUser, async (req, res) => {
    const { messages } = req.body;
    const userId = req.user.id;
    
    // Call LLM provider (OpenAI, Anthropic, Google, etc.)
    const response = await llmClient.chat({
        model: 'gpt-4',
        messages: messages,
    });
    
    res.json({ message: response });
});
```

**What your plugin should handle**:
1. ✅ Intercept before LLM call
2. ✅ Check cache using message history hash
3. ✅ Return cached response if hit
4. ✅ Store response after miss
5. ✅ Support user-scoped namespaces

### Pattern 2: RAG (Retrieval-Augmented Generation)

```javascript
// Our implementation
const similarContent = await searchSimilarContent(query, 3);
const context = buildContextPrompt(similarContent);
const response = await gemini.chat({
    systemInstruction: SYSTEM_PROMPT + context,
    messages: messages,
});
```

**What your plugin should handle**:
1. ✅ Cache based on query + context (not just query alone)
2. ✅ Semantic similarity for "close enough" queries
3. ✅ Invalidate cache when knowledge base updates
4. ✅ Support for context-aware caching

### Pattern 3: Streaming Responses

```javascript
// Many apps use streaming
const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    stream: true,
});

for await (const chunk of stream) {
    res.write(chunk);
}
```

**What your plugin should handle**:
1. ✅ Cache full streamed responses
2. ✅ Replay streams from cache
3. ✅ SSE (Server-Sent Events) passthrough

---

## Critical Integration Points

### 1. Authentication & Multi-Tenancy

**Our Setup**:
- JWT-based auth with user roles
- Each user has isolated chat history
- Platform admin has access to all data

**Plugin Requirements**:
```javascript
// Support user-scoped namespaces
agentcache_get({
    provider: 'google',
    model: 'gemini-1.5-flash',
    messages: messages,
    namespace: `user_${userId}`,  // ← Critical for privacy
});
```

**Why This Matters**: 
- Teachers can't see each other's cached responses
- FERPA/COPPA compliance requires user isolation
- Enables personalized memory without data leaks

### 2. Environment Configuration

**Standard .env Pattern** (works for 90% of apps):
```bash
# Your plugin should work with these vars
AGENTCACHE_API_KEY=ac_live_xxx
AGENTCACHE_API_URL=https://agentcache.ai  # Optional, defaults to prod
AGENTCACHE_ENABLED=true  # Feature flag
AGENTCACHE_TTL=604800    # Default 7 days
```

**Plugin Should**:
- ✅ Auto-detect API key from env
- ✅ Gracefully degrade if disabled (pass-through mode)
- ✅ Validate API key on startup, warn if invalid

### 3. Framework Compatibility

**Priority Order** (based on market share):

1. **Express.js** (80% of Node.js APIs) - **Us**
2. **Next.js API Routes** (15%)
3. **Fastify** (3%)
4. **Hono** (2% but growing)

**Recommendation**: Start with Express middleware pattern:

```javascript
import { agentCacheMiddleware } from 'agentcache';

// Drop-in middleware
app.use('/api/chat', agentCacheMiddleware({
    provider: 'google',
    model: 'gemini-1.5-flash',
    namespaceFromReq: (req) => `user_${req.user.id}`,
}));
```

This pattern works because:
- Familiar to Express developers
- Minimal code changes (1-3 lines)
- Doesn't break existing error handling
- Easy to disable for debugging

### 4. LLM Provider Support

**Current Priority** (based on our research + market):

1. **OpenAI** (60% market share) - GPT-4, GPT-3.5
2. **Google Gemini** (20%) - **Us** - Gemini 1.5 Flash/Pro
3. **Anthropic Claude** (15%)
4. **Open Source** (5%) - Llama, Mistral via Together/Groq

**Plugin Should Auto-Detect**:
```javascript
// Parse from common patterns
const provider = detectProvider(apiEndpoint);
// https://generativelanguage.googleapis.com → 'google'
// https://api.openai.com → 'openai'
// https://api.anthropic.com → 'anthropic'
```

### 5. Error Handling & Fallback

**Critical Requirement**: Never break the app if cache fails.

```javascript
// Desired behavior
try {
    const cached = await agentcache.get(prompt);
    if (cached) return cached;
} catch (error) {
    console.warn('AgentCache unavailable, proceeding to LLM:', error);
    // Continue to LLM call - app keeps working
}

const response = await llm.chat(prompt);
await agentcache.set(prompt, response).catch(() => {}); // Silent fail
```

**Why**: 
- Upstash/Redis outages shouldn't break chat
- API key issues should warn, not crash
- Cache corruption should auto-recover

---

## Installation & Quick Start (What We Need)

### Ideal Developer Experience:

```bash
# Step 1: Install
npm install agentcache

# Step 2: Set API key
echo "AGENTCACHE_API_KEY=ac_live_xxx" >> .env

# Step 3: Add 3 lines to existing code
```

**Existing Code**:
```javascript
const response = await gemini.chat({
    model: 'gemini-1.5-flash',
    messages: messages,
});
```

**After Integration** (3-line change):
```javascript
import { withCache } from 'agentcache';

const response = await withCache(
    () => gemini.chat({ model: 'gemini-1.5-flash', messages }),
    { namespace: `user_${userId}` }
);
```

**That's it.** If this works, 90% of developers will adopt.

---

## Testing Scenarios (What We'll Test)

### Scenario 1: Teacher asks same question twice
```
Teacher 1: "What are the five pillars of reading?"
→ CACHE MISS → Call Gemini → Store response (200ms, $0.001)

Teacher 1 (2 min later): "What are the five pillars of reading?"
→ CACHE HIT → Return instantly (10ms, $0)

✅ Expected: 20x faster, 100% cost savings on hit
```

### Scenario 2: Different teacher, same question
```
Teacher 2: "What are the five pillars of reading?"
→ CACHE MISS (different namespace: user_2 vs user_1)
→ Call Gemini → Store in user_2 namespace

OR (if global caching enabled):
→ CACHE HIT from global namespace → Return instantly

✅ Expected: Configurable global vs user-scoped caching
```

### Scenario 3: RAG query with similar context
```
Query: "What are phonics strategies?"
→ RAG retrieves 3 sources (FCRR, Reading League, IDA)
→ Build prompt with context
→ Check cache with semantic similarity
→ CACHE HIT (90% similar to "What are phonics teaching methods?")

✅ Expected: Semantic caching reduces redundant calls
```

### Scenario 4: Knowledge base update
```
Admin: Scrapes new research from Reading.org (POST /api/admin/references/1/scrape)
→ Trigger cache invalidation for namespace "reading"
→ Next query re-fetches with new context

✅ Expected: Cache invalidation API or webhook
```

### Scenario 5: Cache failure (resilience test)
```
Upstash Redis is down
→ AgentCache returns error
→ App logs warning, proceeds to Gemini normally
→ Response still returned to user (no error)

✅ Expected: Graceful degradation, zero downtime
```

---

## Performance Requirements

Based on our current system:

| Metric | Without Cache | With Cache (Target) |
|--------|---------------|---------------------|
| Latency | 1500ms (Gemini) | <50ms (P95) |
| Cost | $0.001/request | $0 (hit), $0.001 (miss) |
| Throughput | 10 req/sec | 100+ req/sec |
| Hit Rate | N/A | 70-85% (typical) |

**Our Traffic Pattern**:
- 100 teachers × 10 questions/day = 1,000 requests/day
- 70% are common questions ("What is phonemic awareness?")
- 30% are unique ("How do I help Timmy with blending?")
- **Expected hit rate**: 70% → **700 cache hits/day**
- **Monthly savings**: ~$20 → $2 (90% reduction)

At scale (10,000 teachers): **$2,000/mo → $200/mo**

---

## Security & Compliance (Critical for Education)

### Data Privacy
```javascript
// Plugin MUST support encryption at rest
agentcache.config({
    encryptionKey: process.env.CACHE_ENCRYPTION_KEY,
    encryptContent: true,  // Encrypt cached LLM responses
});
```

**Why**: 
- FERPA requires student data protection
- COPPA requires parental consent tracking
- Teachers' names/schools are PII

### Audit Logging
```javascript
// Plugin should log all cache operations
await agentcache.get(prompt, {
    auditLog: {
        userId: req.user.id,
        action: 'cache_hit',
        timestamp: new Date(),
    }
});
```

**Why**: 
- Compliance audits require access logs
- Debugging requires request tracing
- Billing disputes need evidence

### Cache Expiration
```javascript
// Support TTL per namespace
agentcache.set(prompt, response, {
    namespace: 'research_content',
    ttl: 2592000,  // 30 days for research (stable)
});

agentcache.set(prompt, response, {
    namespace: 'user_chat',
    ttl: 604800,   // 7 days for chat (changes often)
});
```

---

## Documentation Needs (For Plugin Users)

### 1. Quick Start (5 minutes)
- Installation command
- API key setup
- 3-line code example
- Verification test (console.log cache hit)

### 2. Migration Guide (15 minutes)
- Before/after code comparison
- Common patterns (Express, Next.js, Fastify)
- Namespace configuration
- Environment variables

### 3. Advanced Usage (30 minutes)
- Semantic caching configuration
- Cache invalidation strategies
- Multi-model setups (Gemini + GPT-4 fallback)
- Monitoring & observability

### 4. Troubleshooting (Common Issues)
- "Cache always misses" → Check namespace config
- "High latency" → Verify Upstash region
- "API key invalid" → Regenerate key
- "Streaming broken" → Check SSE headers

---

## Plugin API Design (Recommendations)

### Simple API (80% of users)
```javascript
import agentcache from 'agentcache';

// Auto-wraps any async function that returns LLM response
const cachedChat = agentcache.wrap(gemini.chat, {
    namespace: (args) => `user_${args[0].userId}`,
});

const response = await cachedChat({
    model: 'gemini-1.5-flash',
    messages: messages,
    userId: req.user.id,
});
```

### Advanced API (20% power users)
```javascript
import { AgentCache } from 'agentcache';

const cache = new AgentCache({
    apiKey: process.env.AGENTCACHE_API_KEY,
    defaultTTL: 604800,
    semanticSimilarityThreshold: 0.9,
    onCacheHit: (key, latency) => {
        console.log(`Cache hit: ${key} in ${latency}ms`);
    },
});

// Manual control
const cacheKey = cache.generateKey(prompt);
const cached = await cache.get(cacheKey);
if (!cached) {
    const response = await llm.chat(prompt);
    await cache.set(cacheKey, response);
}
```

---

## Integration Checklist (What We'll Verify)

- [ ] Install via npm without errors
- [ ] Auto-detect Gemini API from our existing code
- [ ] Create namespaces per user (`user_${userId}`)
- [ ] Cache responses with <50ms retrieval
- [ ] Handle cache misses gracefully (pass-through)
- [ ] Support streaming responses (SSE)
- [ ] Invalidate cache on demand (POST /api/cache/invalidate)
- [ ] Encrypt sensitive data at rest
- [ ] Export metrics (hit rate, latency, cost savings)
- [ ] Work with existing JWT authentication
- [ ] Survive Upstash outages (graceful degradation)
- [ ] Provide TypeScript types
- [ ] Include usage examples for Express
- [ ] Document environment variables
- [ ] Support semantic similarity caching (RAG queries)

---

## Success Metrics (How We'll Measure)

### Phase 1: Integration (Week 1)
- ✅ Plugin installed and configured
- ✅ First cache hit recorded
- ✅ Zero breaking changes to existing endpoints

### Phase 2: Validation (Week 2-4)
- ✅ 70%+ cache hit rate achieved
- ✅ <50ms P95 latency on hits
- ✅ Cost savings validated ($20 → $2/month)
- ✅ Zero production incidents

### Phase 3: Scale (Month 2-3)
- ✅ 10,000 teachers using cached responses
- ✅ 1M+ requests/month
- ✅ 90% cost reduction vs no caching
- ✅ Case study published

---

## Feedback We'll Provide

As your first production user, we'll document:

1. **Installation Pain Points**
   - What steps were confusing?
   - What docs were missing?
   - What errors did we encounter?

2. **Integration Challenges**
   - What code patterns didn't work?
   - What assumptions were wrong?
   - What workarounds did we need?

3. **Performance Results**
   - Actual hit rates vs expected
   - Real latency measurements
   - True cost savings

4. **Developer Experience**
   - Time to first cache hit
   - Code changes required
   - Debugging difficulty

5. **Production Issues**
   - Uptime/reliability
   - Error rates
   - Support response time

---

## Contact & Support

**Project**: SOR Platform (Science of Reading education tool)  
**Tech Stack**: React + Vite, Express + Node.js, Google Gemini, Neon (Postgres), Vercel  
**Team**: JettyThunder Labs  
**Primary Contact**: cspencer@drgnflai.org  

**Integration Timeline**:
- Week 1: Install and basic integration
- Week 2: Testing and validation
- Week 3: Production deployment
- Week 4: Case study and feedback

**We're committed to**:
- Providing detailed integration feedback
- Creating public case study
- Becoming reference customer
- Contributing to documentation

---

## Appendix: Our Current Architecture

**Tech Stack**:
```
Frontend: React 19 + Vite + TailwindCSS
Backend: Express.js + Node.js
Database: Neon (PostgreSQL) + Drizzle ORM + pgvector
LLM: Google Gemini 1.5 Flash
Caching: None (yet - that's why we need AgentCache!)
Auth: JWT
Deployment: Vercel
```

**Key Endpoints**:
- `POST /api/chat` - Authenticated chat (teachers)
- `POST /api/chat/demo` - Guest chat (demo users)
- `POST /api/admin/references/*` - RAG management

**Current Bottleneck**: Every chat request calls Gemini ($0.001 + 1.5s latency)

**Target State**: 70% cache hit rate (P95 <50ms, $0 on hits)

---

**END OF REQUIREMENTS DOCUMENT**

This document will be updated as integration progresses.
