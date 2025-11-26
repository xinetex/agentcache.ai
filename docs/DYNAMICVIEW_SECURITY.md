# Dynamic View Security Guidelines

## Overview
This document outlines security measures implemented in the Dynamic View system to prevent malicious activity and token overspend.

## Security Measures Implemented

### 1. XSS Prevention ✅
**Location**: `src/dynamicview/schema.ts` (lines 385-410), `public/dynamicview-renderer.js`

**Protections**:
- ✅ All text rendering uses `textContent` (never `innerHTML`)
- ✅ `<script>` tags stripped via regex: `/<script[^>]*>.*?<\/script>/gi`
- ✅ Inline event handlers stripped: `/on\w+\s*=\s*["'][^"']*["']/gi`
- ✅ No `eval()` or `Function()` constructor usage
- ✅ Event handlers are string IDs only, not executable code

**Example Safe Rendering**:
```javascript
// ❌ UNSAFE (old code)
div.innerHTML = `<p>${userContent}</p>`;

// ✅ SAFE (current implementation)
const p = document.createElement('p');
p.textContent = userContent;
div.appendChild(p);
```

### 2. DoS Protection ✅
**Location**: `src/dynamicview/schema.ts` (lines 257-264)

**Limits**:
```typescript
MAX_DEPTH: 10,           // Prevents infinite recursion
MAX_CHILDREN: 50,        // Prevents DOM explosion (50^10 worst case)
MAX_STRING_LENGTH: 1000, // Prevents memory exhaustion
MAX_DATA_POINTS: 1000,   // Prevents chart rendering attacks
```

**Enforcement**:
- Recursive depth checking in renderer (line 87-89)
- Component validation before rendering
- Array slicing to enforce limits

### 3. CSS Injection Prevention ✅
**Location**: `public/dynamicview-renderer.js` (lines 547-580)

**Protections**:
- ✅ Style value sanitization regex: `/javascript:|expression\(|@import|<|>/gi`
- ✅ Whitelisted CSS properties only
- ✅ ClassName special character stripping: `/[<>"']/g`

**Blocked Attacks**:
```javascript
// ❌ Blocked: javascript: URL
backgroundColor: "javascript:alert('XSS')"

// ❌ Blocked: IE expression
width: "expression(alert('XSS'))"

// ❌ Blocked: @import
backgroundColor: "@import url(evil.css)"
```

### 4. Component Type Whitelisting ✅
**Location**: `src/dynamicview/schema.ts` (lines 10-20)

**Allowed Types**:
- Layout: `container`, `row`, `column`, `grid`
- Interactive: `button`, `input`, `slider`, `toggle`, `select`
- Display: `text`, `heading`, `badge`, `metric`, `card`
- Data Viz: `chart`, `progress`, `sparkline`
- Pipeline: `node-card`, `connection-flow`, `pipeline-diagram`

**Protection**:
- Unknown types trigger fallback warning (line 103-104)
- No dynamic component registration allowed

### 5. Event Handler Safety ✅
**Location**: `src/dynamicview/schema.ts` (lines 262)

**Allowed Handlers**:
```typescript
ALLOWED_EVENT_HANDLERS: ['onClick', 'onChange', 'onSubmit']
```

**Implementation**:
- Handlers are string IDs, not functions
- Validation checks against whitelist (line 356)
- Event delegation through safe callback system

## Token Overspend Prevention

### Rate Limiting Configuration 🔒
**Location**: To be implemented in `/api/dynamicview/generate.js`

**Required Limits**:

```javascript
// Per-user limits
const RATE_LIMITS = {
  demo_users: {
    requests_per_hour: 10,        // 10 AI generations/hour
    max_prompt_length: 500,       // 500 chars max prompt
    templates_unlimited: true,    // Templates are free
  },
  
  paid_users: {
    requests_per_hour: 100,       // 100 AI generations/hour
    max_prompt_length: 2000,      // 2000 chars max prompt
    templates_unlimited: true,
  },
  
  enterprise: {
    requests_per_hour: 1000,
    max_prompt_length: 5000,
    templates_unlimited: true,
  },
};

// Cost tracking
const COST_LIMITS = {
  max_tokens_per_request: 4096,  // OpenAI GPT-4 limit
  estimated_cost_per_gen: 0.03,  // ~$0.03 per schema generation
  daily_budget_alert: 50.00,     // Alert if >$50/day spent
};
```

### Implementation Checklist for `/api/dynamicview/generate` 📋

When implementing the API endpoint, ensure:

- [ ] **Authentication**: Verify API key before processing
- [ ] **Rate Limiting**: Check Redis for user's request count
  - Key: `dynamicview:ratelimit:{userHash}:h:{YYYY-MM-DD-HH}`
  - Increment on each request
  - Return 429 if limit exceeded
- [ ] **Prompt Sanitization**: Strip dangerous characters, limit length
- [ ] **Schema Validation**: Run `validateSchema()` on LLM output
- [ ] **Cost Tracking**: Log token usage per request
  - Key: `dynamicview:cost:{userHash}:d:{YYYY-MM-DD}`
- [ ] **Timeout**: 30s max generation time
- [ ] **Fallback**: Return template on LLM failure
- [ ] **Caching**: Store generated schemas (7-day TTL)
  - Key: `dynamicview:v1:{promptHash}`
  - Include freshness metadata

### Anti-Cache Integration 🟢

The Dynamic View system is designed to work with AgentCache's anti-cache features:

**Cache Key Structure**:
```
dynamicview:v1:{promptHash}        - Generated schema
dynamicview:v1:{promptHash}:meta   - Freshness metadata
```

**Freshness Indicators**:
- 🟢 **Fresh**: < 75% of 7-day TTL (~5 days)
- 🟡 **Stale**: 75-100% of TTL (5-7 days)
- 🔴 **Expired**: > 7 days old

**Cost Savings**:
- 1 LLM generation → N cached renders = **98% cost reduction**
- Prompt: "Show me a dashboard" (first time: $0.03, cached: $0.00)
- Similar prompts use same cached schema

## Testing Attack Vectors

### XSS Test Cases ✅
```javascript
// Test 1: Script tag injection
const maliciousSchema = {
  root: {
    type: 'text',
    content: '<script>alert("XSS")</script>Hello'
  }
};
// Expected: Renders as text "&lt;script&gt;...Hello", no execution

// Test 2: Event handler injection
const maliciousButton = {
  type: 'button',
  label: 'Click me',
  onClick: 'javascript:alert("XSS")'  // String ID, not executable
};
// Expected: Event ID passed to safe callback, no execution

// Test 3: Style injection
const maliciousStyle = {
  style: {
    backgroundColor: "javascript:alert('XSS')"
  }
};
// Expected: Style value blocked by sanitization regex
```

### DoS Test Cases ✅
```javascript
// Test 1: Infinite recursion
function createDeepNesting(depth) {
  if (depth > 100) return { type: 'text', content: 'Deep' };
  return {
    type: 'container',
    children: [createDeepNesting(depth + 1)]
  };
}
// Expected: Throws error at depth 10, rendering stops safely

// Test 2: DOM explosion
const massiveChildren = {
  type: 'container',
  children: Array(1000).fill({ type: 'text', content: 'x' })
};
// Expected: Truncated to 50 children during validation
```

### Token Overspend Test Cases 🔒
```javascript
// Test 1: Rapid-fire requests
// Send 50 requests in 1 minute from same user
// Expected: First 10 succeed (demo tier), rest return 429

// Test 2: Massive prompt
const hugePrompt = 'a'.repeat(10000);
// Expected: Rejected with 400 "Prompt too long"

// Test 3: Concurrent generation spam
// Launch 100 parallel requests
// Expected: Rate limiter blocks after quota, queue the rest
```

## Monitoring & Alerts

### Metrics to Track
1. **Schema generation requests/hour** - Detect abuse patterns
2. **Rate limit 429 responses** - Identify users hitting limits
3. **LLM token usage** - Track costs per user
4. **Schema validation failures** - Detect malicious schemas
5. **Renderer errors** - XSS attempts trigger console warnings

### Alert Thresholds
- ⚠️ **Warning**: User generates >50 schemas/day
- 🚨 **Critical**: Single user >$10 LLM spend/day
- 🚨 **Critical**: >100 validation failures/hour (attack attempt)

## Incident Response

### If XSS Detected
1. Log the malicious schema to Redis: `security:xss:{timestamp}`
2. Block the user's API key temporarily
3. Review schema generation logs
4. Update sanitization regex if needed

### If Token Overspend
1. Auto-pause user's schema generation
2. Send email alert to user
3. Review request patterns for abuse
4. Adjust rate limits if needed

## Security Audit Schedule

- **Daily**: Review cost metrics dashboard
- **Weekly**: Analyze rate limit 429 responses
- **Monthly**: Full security audit of Dynamic View code
- **Quarterly**: Penetration testing with malicious schemas

## Contact

Security concerns: security@agentcache.ai

---

**Last Updated**: 2025-01-26
**Next Review**: 2025-02-26
