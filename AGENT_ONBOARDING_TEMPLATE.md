# Agent Onboarding Template

## Purpose
This document serves as a template for AI agents working on AgentCache.ai and integrating with customer platforms. It documents the process, patterns, and best practices established during initial development.

---

## Phase 1: Understanding the Project

### Step 1: Read Core Documentation
**Priority Order:**
1. `WARP.md` - Development guide and architecture overview
2. `AGENT_ROADMAP.md` - Strategic vision and roadmap
3. `README.md` - Project overview
4. `PHASE1_SUMMARY.md` - Current deployment status

**Key Questions to Answer:**
- What is the current architecture?
- What are the production endpoints?
- What is already deployed vs. planned?
- What are the user's deployment constraints?

### Step 2: Analyze User Context
**From user rules, identify:**
- Deployment workflow (e.g., GitHub → Vercel auto-deploy)
- Testing approach (e.g., production-only, no localhost)
- Database setup (e.g., Neon PostgreSQL)
- Tech stack preferences (e.g., Edge functions, no Node.js APIs in `/api`)

**Example from AgentCache.ai:**
```
- Deployment: GitHub push → Vercel
- Testing: Vercel deployments only
- Backend: Dual architecture (/api for production, /src for dev)
- Database: Neon (configured but not fully integrated)
- No localhost testing
```

### Step 3: Check Current Status
**Commands to run:**
```bash
git status                    # Check for uncommitted changes
git log --oneline -5          # Recent commits
ls -la                        # Project structure
cat package.json              # Dependencies and scripts
```

**Understand:**
- What was last worked on?
- Are there pending changes?
- What's the build/deploy process?

---

## Phase 2: Planning the Work

### Step 1: Break Down the Request
**User Request:** "Implement feature X"

**Ask yourself:**
1. Is this a simple task (1-2 steps) or complex (3+ steps)?
2. Does it require new files or editing existing ones?
3. Are there dependencies on other features?
4. What documentation needs updating?

**If complex (3+ steps), create a TODO list:**
```typescript
create_todo_list([
  { title: "Step 1", details: "What specifically to do" },
  { title: "Step 2", details: "Dependencies and approach" },
  // ...
]);
```

### Step 2: Research Similar Patterns
**Look for existing code patterns:**
```bash
# Find similar endpoints
ls -la api/

# Search for similar functionality
grep -r "pattern_name" .

# Check how auth is done
grep -r "async function auth" api/
```

**Maintain consistency:**
- Copy error handling patterns
- Use same response format
- Follow existing naming conventions
- Match code style (tabs vs spaces, etc.)

### Step 3: Consider User's Environment
**From AgentCache.ai experience:**
- User has multiple projects (JettyThunder, agentcache-ai)
- User prefers markdown documentation
- User wants reusable templates
- User values agent-to-agent communication

**Adapt approach:**
- Create integration guides for customer platforms
- Document webhook patterns for agent communication
- Build reusable components

---

## Phase 3: Implementation

### Step 1: Start with Documentation
**Best practice: Document first, then code**

**Why?**
1. Clarifies requirements
2. Gets user feedback early
3. Serves as specification
4. Becomes user-facing docs

**Example from webhook implementation:**
1. Created `WEBHOOKS_AND_KIMI_GUIDE.md` first
2. Outlined API design
3. Showed usage examples
4. Then implemented to match

### Step 2: Implement Incrementally
**Pattern:**
1. Create new files (if needed)
2. Edit existing files (maintain compatibility)
3. Test locally (if possible) or document test plan
4. Commit with descriptive messages
5. Deploy
6. Verify

**Example commit message structure:**
```
Phase X.Y: Feature name

- Add specific change 1
- Implement specific change 2
- Update documentation

Technical details:
- New endpoints: /api/x, /api/y
- Events supported: event1, event2
- Breaking changes: none

Foundation for: future feature
```

### Step 3: Maintain Backward Compatibility
**Critical for production systems:**
- Add new features, don't break existing ones
- Use optional parameters
- Version APIs if breaking changes needed
- Document migration paths

**Example from namespace support:**
```javascript
// Added namespace support WITHOUT breaking existing calls
const namespace = req.headers.get('x-cache-namespace') || null;
// null = works like before, string = new functionality
```

---

## Phase 4: Integration with Customer Platforms

### Pattern: Webhook Integration (JettyThunder Example)

#### Step 1: Understand Customer's Platform
```bash
# Find customer project
ls -la /Users/letstaco/Documents | grep -i jetty

# Check structure
ls -la /path/to/customer-project

# Identify framework (Next.js, Express, etc.)
cat package.json | grep "next\|express\|fastify"
```

#### Step 2: Create Webhook Endpoint
**For Next.js App Router:**
```
/src/app/api/webhooks/agentcache/route.ts
```

**Pattern:**
```typescript
// POST /api/webhooks/agentcache
export async function POST(req: Request) {
  // 1. Extract signature and event
  const signature = req.headers.get('x-agentcache-signature');
  const event = req.headers.get('x-agentcache-event');
  const body = await req.text();
  
  // 2. Verify signature (ALWAYS)
  const valid = await verifySignature(body, signature);
  if (!valid) return new Response('Unauthorized', { status: 401 });
  
  // 3. Handle event
  const payload = JSON.parse(body);
  await handleWebhookEvent(event, payload.data);
  
  // 4. Respond quickly
  return new Response('OK', { status: 200 });
}
```

#### Step 3: Add Event Handlers
**Pattern: Separate concerns**
```typescript
// /src/lib/webhooks/agentcache-handler.ts
export async function handleWebhookEvent(event: string, data: any) {
  switch (event) {
    case 'quota.warning':
      await handleQuotaWarning(data);
      break;
    case 'quota.exceeded':
      await handleQuotaExceeded(data);
      break;
    // ...
  }
}

async function handleQuotaWarning(data: any) {
  // Send Slack alert
  await notifySlack(`⚠️ AgentCache at ${data.percent}%`);
  
  // Update dashboard metrics
  await updateMetrics({ quotaPercent: data.percent });
  
  // Log event
  console.log('[AgentCache] Quota warning:', data);
}
```

#### Step 4: Dashboard Integration
**Pattern: Real-time metrics display**
```typescript
// /src/components/dashboard/AgentCacheMetrics.tsx
'use client';

export function AgentCacheMetrics() {
  const [metrics, setMetrics] = useState({
    hitRate: 0,
    costSaved: '$0',
    quotaPercent: 0
  });
  
  useEffect(() => {
    // Poll stats API
    const interval = setInterval(async () => {
      const stats = await fetch('/api/agentcache/stats');
      const data = await stats.json();
      setMetrics({
        hitRate: data.metrics.hit_rate,
        costSaved: data.metrics.cost_saved,
        quotaPercent: data.quota.usage_percent
      });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard 
        label="Cache Hit Rate" 
        value={`${metrics.hitRate}%`}
      />
      <MetricCard 
        label="Cost Saved Today" 
        value={metrics.costSaved}
      />
      <MetricCard 
        label="Quota Used" 
        value={`${metrics.quotaPercent}%`}
        alert={metrics.quotaPercent > 80}
      />
    </div>
  );
}
```

#### Step 5: Register Webhook
**After deployment, register:**
```bash
curl -X POST https://agentcache.ai/api/webhooks \
  -H "X-API-Key: ${AGENTCACHE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://customer.com/api/webhooks/agentcache",
    "events": ["quota.warning", "quota.exceeded"],
    "secret": "${WEBHOOK_SECRET}"
  }'
```

---

## Phase 5: Documentation

### What to Document

#### 1. User-Facing Docs
**Create guides for:**
- Quick start (5-minute integration)
- API reference (all endpoints)
- Integration examples (real code)
- Best practices (security, performance)
- Troubleshooting (common issues)

**Example files created:**
- `JETTYTHUNDER_INTEGRATION.md` - Customer integration guide
- `WEBHOOKS_AND_KIMI_GUIDE.md` - Webhook system docs
- `CONTEXT_CACHING_PROPOSAL.md` - Future feature design

#### 2. Internal Docs
**Update for future agents:**
- `WARP.md` - Add new features to architecture section
- `AGENT_ROADMAP.md` - Mark completed items, add new plans
- `PHASE1_DEPLOYMENT.md` - Document deployment steps
- `PHASE1_SUMMARY.md` - Executive summary of changes

#### 3. Integration Templates
**Create reusable templates:**
- Webhook endpoint boilerplate
- Dashboard component examples
- Test scripts
- Deployment checklists

---

## Phase 6: Testing & Deployment

### Pre-Deployment Checklist
```markdown
- [ ] All files created/edited
- [ ] Code follows existing patterns
- [ ] Backward compatible (no breaking changes)
- [ ] Documentation updated
- [ ] Commit message descriptive
- [ ] Git status clean (no accidental files)
```

### Deployment Steps
```bash
# 1. Review changes
git status
git diff

# 2. Stage files
git add path/to/file1 path/to/file2

# 3. Commit with good message
git commit -m "Phase X: Feature name

- Specific change 1
- Specific change 2

Technical details and context"

# 4. Push (triggers auto-deploy for Vercel)
git push origin main

# 5. Monitor deployment
# Check Vercel dashboard or wait 2-3 minutes
```

### Verification Steps
```bash
# 1. Health check
curl https://api.example.com/health

# 2. Test new endpoint
curl -X POST https://api.example.com/new-endpoint \
  -H "Authorization: Bearer test_key" \
  -d '{"test": true}'

# 3. Verify documentation
# Open README, guides, etc. in browser

# 4. Mark todos complete
mark_todo_as_done(['todo_id_1', 'todo_id_2'])
```

---

## Best Practices Learned

### 1. Ask Before Assuming
**Always check:**
- User's deployment constraints
- Testing approach
- Preferred patterns
- Documentation style

**Don't assume:**
- Localhost testing available
- Standard build process
- Specific frameworks
- User's knowledge level

### 2. Document Everything
**What we learned:**
- Documentation is code's best friend
- Users share docs with teammates
- Docs prevent repeated questions
- Good docs = good onboarding

**Pattern:**
```
For every feature:
1. Design doc (proposal)
2. Implementation
3. User guide
4. Integration example
5. Update roadmap
```

### 3. Think in Phases
**Break work into deployable phases:**
- Phase 1: Core features (MVP)
- Phase 1.5: Quick wins (webhooks)
- Phase 2: Extended features (context caching)
- Phase 3: Advanced features (semantic caching)

**Why?**
- Incremental value delivery
- Easier to test/verify
- User can give feedback earlier
- Less risk per deployment

### 4. Build for Agents
**Agent-friendly patterns:**
- Webhook notifications (agent-to-agent communication)
- JSON APIs (machine-readable)
- Deterministic behavior (predictable outcomes)
- Clear error messages (debuggable)

**Example: Webhook events enable:**
- Proactive monitoring
- Auto-scaling
- Multi-agent orchestration
- Event-driven workflows

### 5. Maintain Context
**Use TODO lists for complex tasks:**
```typescript
create_todo_list([
  { title: "Task 1", details: "Why and how" },
  { title: "Task 2", details: "Dependencies" }
]);

// Work on tasks...

mark_todo_as_done(['task_1_id']);
```

**Why?**
- Keeps you on track
- Shows progress
- Handles interruptions
- Documents process

---

## Common Patterns

### Pattern 1: Edge Function (Vercel)
```javascript
export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store' 
    }
  });
}

export default async function handler(req) {
  try {
    // 1. Auth
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Unauthorized' }, 401);
    
    // 2. Parse body
    const body = await req.json();
    
    // 3. Business logic
    const result = await doSomething(body);
    
    // 4. Return response
    return json({ success: true, data: result });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
```

### Pattern 2: Webhook Signature Verification
```javascript
async function verifySignature(payload, signature, secret) {
  const expectedSig = await createHMAC(payload, secret);
  return signature === `sha256=${expectedSig}`;
}

async function createHMAC(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC', 
    key, 
    encoder.encode(data)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Pattern 3: Rate Limiting
```javascript
// Check rate limit
const rateLimitKey = `ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`;
const limit = 100; // requests per minute

const result = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 120); // 2 minutes

if (result > limit) {
  return json({ error: 'Rate limit exceeded' }, 429);
}
```

### Pattern 4: Namespace Support (Multi-Tenancy)
```javascript
// Extract namespace from header
const namespace = req.headers.get('x-cache-namespace') || null;

// Generate namespaced cache key
const cacheKey = namespace 
  ? `agentcache:v1:${namespace}:${hash}`
  : `agentcache:v1:${hash}`;
```

---

## Integration Checklist

### When Integrating with Customer Platform

#### Discovery Phase
- [ ] Identify customer's tech stack
- [ ] Find existing API structure
- [ ] Check authentication patterns
- [ ] Review error handling style
- [ ] Understand deployment process

#### Implementation Phase
- [ ] Create webhook endpoint
- [ ] Add signature verification
- [ ] Implement event handlers
- [ ] Add dashboard component
- [ ] Write integration tests

#### Documentation Phase
- [ ] Update customer README
- [ ] Create integration guide
- [ ] Add code examples
- [ ] Document environment variables
- [ ] Provide test scripts

#### Deployment Phase
- [ ] Test webhook locally (if possible)
- [ ] Deploy to staging/preview
- [ ] Register webhook with production
- [ ] Verify webhook delivery
- [ ] Monitor for errors

---

## Lessons Learned

### From AgentCache.ai Development

1. **Dual architecture matters**
   - `/api` for production (edge functions)
   - `/src` for development (Node.js)
   - Keep them conceptually aligned

2. **Documentation drives quality**
   - Write docs before code
   - Docs catch design issues early
   - Users appreciate good docs

3. **Incremental deployment wins**
   - Phase 1: Core features
   - Phase 1.5: Quick wins (webhooks)
   - User gets value faster

4. **Security first**
   - Always verify webhook signatures
   - Use HTTPS only
   - Rate limit everything
   - Validate all inputs

5. **Think agent-native**
   - Webhooks enable agent communication
   - JSON APIs for machine consumption
   - Deterministic behavior
   - Clear error messages

---

## Template Usage

### For Future Agents

**When you start working on AgentCache.ai or customer integration:**

1. Read this document first
2. Review current documentation (WARP.md, roadmap)
3. Check git status and recent commits
4. Understand user's deployment workflow
5. Plan in phases
6. Document as you go
7. Test thoroughly (on Vercel for AgentCache)
8. Commit with descriptive messages
9. Update this template with new learnings!

**When helping with integration:**

1. Identify customer's platform
2. Find similar integration examples
3. Follow patterns from WEBHOOKS_AND_KIMI_GUIDE.md
4. Create endpoint + handlers + dashboard
5. Document integration steps
6. Test webhook delivery
7. Monitor for issues

---

## Resources

### Key Files to Reference
- `WARP.md` - Architecture and patterns
- `AGENT_ROADMAP.md` - Strategic direction
- `WEBHOOKS_AND_KIMI_GUIDE.md` - Integration examples
- `JETTYTHUNDER_INTEGRATION.md` - Customer guide
- `PHASE1_SUMMARY.md` - Current status

### Commands Reference
```bash
# Check status
git status
git log --oneline -5

# Search codebase
grep -r "pattern" path/
ls -la path/

# Deploy
git add .
git commit -m "message"
git push origin main

# Verify
curl https://api.example.com/health
```

---

## Continuous Improvement

**Add to this template when you:**
- Discover new patterns
- Solve tricky problems
- Learn user preferences
- Find better approaches
- Encounter edge cases

**This template grows with each agent's experience.**

---

Built with ❤️ by agents, for agents 🤖
