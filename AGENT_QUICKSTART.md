# Agent Quickstart - Frictionless Onboarding

**⚡ Get up to speed in 2 minutes. Executable commands, zero guesswork.**

---

## 🚀 Instant Context (Run This First)

```bash
# Where am I?
pwd  # Should be: /Users/letstaco/Documents/agentcache-ai

# What's the status?
git status && git log --oneline -3

# What's deployed?
curl -s https://agentcache.ai/api/health | jq .

# What's the structure?
tree -L 2 -I node_modules
```

---

## 📋 30-Second Briefing

**What is AgentCache.ai?**
- Edge caching service for AI API calls
- 90% cost reduction, 10x faster responses
- Works with OpenAI, Anthropic, Claude, Moonshot AI (Kimi K2)
- **Unique**: Reasoning token caching (98% savings on Kimi K2)

**Tech Stack:**
- Backend: Vercel Edge Functions (`/api/*.js`)
- Cache: Upstash Redis (global edge)
- Deploy: GitHub push → Vercel auto-deploy
- Testing: **Production only** (no localhost)

**Key Endpoints:**
- `POST /api/cache/get` - Check cache
- `POST /api/cache/set` - Store response
- `POST /api/moonshot` - Moonshot AI with reasoning caching
- `POST /api/webhooks` - Register webhooks
- `GET /api/stats` - Analytics

**First Customer:**
- JettyThunder.app (multi-agent platform)
- Uses webhooks for quota monitoring
- Namespace: `jettythunder`

---

## 🎯 Quick Commands Reference

### Get Context
```bash
# Read the essentials (in this order)
cat WARP.md | head -200            # Architecture overview
cat AGENT_ROADMAP.md | head -100   # Strategic vision  
cat README.md                      # Project overview
cat DEPLOY_MOONSHOT.md             # Latest deployment status
```

### Check What's Live
```bash
# Test demo key
curl -X POST https://agentcache.ai/api/cache/get \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","model":"gpt-4","messages":[{"role":"user","content":"test"}]}'

# Check Moonshot endpoint
curl -X POST https://agentcache.ai/api/moonshot \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{"model":"moonshot-v1-128k","messages":[{"role":"user","content":"Hello"}],"cache_reasoning":true}'

# Health check
curl https://agentcache.ai/api/health
```

### Find Things Fast
```bash
# Find all API endpoints
ls -la api/

# Search for a pattern
grep -r "function_name" api/

# Find authentication code
grep -r "async function auth" api/

# Find Redis operations
grep -r "upstash" api/
```

---

## 🏗️ Common Development Patterns

### 1. Create New API Endpoint

**File:** `/api/your-endpoint.js`

```javascript
export const config = { runtime: 'edge' };

// Helper: JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    },
  });
}

// Helper: Authenticate
async function authenticate(req) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key' };
  }
  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', hash: 'demo' };
  }
  // Verify live key via Redis...
  return { ok: true, kind: 'live', hash: keyHash };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return json({ error: 'Unauthorized' }, 401);
    
    // Your logic here
    
    return json({ success: true, data: result });
  } catch (err) {
    console.error('Error:', err);
    return json({ error: 'Internal error', details: err.message }, 500);
  }
}
```

### 2. Access Redis

```javascript
// Get environment
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// GET
const res = await fetch(`${url}/get/key`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
const value = data.result;

// SET with TTL
await fetch(`${url}/set/key`, {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ value: 'data', ex: 3600 }) // 1 hour TTL
});

// INCR
await fetch(`${url}/incr/counter`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 3. Hash for Cache Keys

```javascript
async function hash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Usage
const cacheKey = `agentcache:v1:${namespace}:${provider}:${model}:${await hash(data)}`;
```

### 4. Verify Webhook Signature

```javascript
async function verifySignature(payload, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return expectedSignature === signature.replace('sha256=', '');
}
```

---

## 📝 Deployment Workflow

### 1. Make Changes
```bash
# Edit files (never commit secrets!)
code api/your-file.js

# Stage changes
git add api/your-file.js docs/YOUR_DOC.md

# Commit with clear message
git commit -m "feat: Add X feature

- Implement Y
- Add Z documentation
- No breaking changes"
```

### 2. Deploy
```bash
# Push to GitHub (triggers Vercel auto-deploy)
git push origin main

# Monitor deployment
vercel logs --follow
# Or watch at: https://vercel.com/your-project
```

### 3. Test on Production
```bash
# Test new endpoint
curl -X POST https://agentcache.ai/api/your-endpoint \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check logs
vercel logs --tail=50
```

---

## 🔧 Environment Variables

**View current:**
```bash
vercel env ls
```

**Add new:**
```bash
vercel env add YOUR_VAR_NAME production
# Enter value when prompted
```

**Required vars:**
- `UPSTASH_REDIS_REST_URL` - Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis auth token
- `SENDGRID_API_KEY` - Email service (optional)
- `MOONSHOT_API_KEY` - Moonshot AI (optional)
- `ADMIN_TOKEN` - Admin access (optional)

---

## 🚨 Critical Rules

### ✅ DO
- Use Vercel Edge Runtime (`export const config = { runtime: 'edge' }`)
- Use Web APIs (fetch, crypto.subtle, etc.)
- Maintain backward compatibility
- Test on production (no localhost)
- Document everything
- Use consistent error responses
- Verify webhook signatures

### ❌ DON'T
- Use Node.js APIs in `/api` (fs, path, etc.)
- Use `import` from npm in edge functions (use native fetch)
- Break existing endpoints
- Commit secrets or API keys
- Add localhost testing
- Use complex build tools
- Make breaking changes without versioning

---

## 📚 Documentation Index

**Must Read (Priority Order):**
1. `WARP.md` - Complete development guide
2. `AGENT_ROADMAP.md` - Strategic vision
3. `MOONSHOT_INTEGRATION.md` - Kimi K2 reasoning cache
4. `WEBHOOKS_AND_KIMI_GUIDE.md` - Webhook system
5. `DEPLOY_MOONSHOT.md` - Latest deployment guide

**Integration Guides:**
- `JETTYTHUNDER_INTEGRATION.md` - Customer integration example
- `AGENT_ONBOARDING_TEMPLATE.md` - Full template (detailed)

**Reference:**
- `README.md` - Project overview
- `PHASE1_SUMMARY.md` - Phase 1 deployment recap
- `.env.example` - Environment variables

---

## 🎓 Common Tasks

### Task: Add New Feature
```bash
# 1. Read WARP.md for patterns
cat WARP.md | grep -A 20 "pattern_name"

# 2. Find similar code
grep -r "similar_function" api/

# 3. Create new file
code api/new-feature.js

# 4. Document it
code docs/NEW_FEATURE.md

# 5. Deploy
git add api/new-feature.js docs/NEW_FEATURE.md
git commit -m "feat: Add new feature"
git push origin main

# 6. Test
curl https://agentcache.ai/api/new-feature
```

### Task: Integrate with Customer Platform
```bash
# 1. Find customer project
ls /Users/letstaco/Documents | grep -i customer

# 2. Check framework
cat /path/to/customer/package.json | grep "next\|express"

# 3. Create webhook endpoint
code /path/to/customer/api/webhooks/agentcache/route.ts

# 4. Add setup script
code /path/to/customer/scripts/setup-agentcache.sh
chmod +x /path/to/customer/scripts/setup-agentcache.sh

# 5. Test webhook registration
curl -X POST https://agentcache.ai/api/webhooks \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"url":"https://customer.app/api/webhooks/agentcache","events":["quota.warning"]}'
```

### Task: Debug Issue
```bash
# Check recent deployments
vercel deployments

# View logs
vercel logs --tail=100

# Test endpoint
curl -v https://agentcache.ai/api/endpoint

# Check Redis
# (Use Upstash console: https://console.upstash.com/)

# Review recent commits
git log --oneline -10

# Check for errors in code
grep -r "TODO\|FIXME\|XXX" api/
```

---

## 🤝 Working with Other Agents

### When You Start
```bash
# Check for existing TODO list
cat TODOS.md 2>/dev/null || echo "No TODO list"

# Read conversation summary
cat CONVERSATION_SUMMARY.md 2>/dev/null || echo "No summary"

# Check recent work
git log --oneline --since="1 week ago"
```

### When You Finish
```bash
# Update memory.md with your work
echo "## $(date): Completed X feature
- Added Y
- Updated Z
- See commit: $(git rev-parse --short HEAD)" >> memory.md

# Commit everything
git add -A
git commit -m "Your summary"
git push origin main
```

---

## 🆘 Get Unstuck

**Problem:** Can't find something
```bash
# Search everywhere
grep -r "search_term" .

# Find files by name
find . -name "*pattern*" -type f | grep -v node_modules
```

**Problem:** Endpoint not working
```bash
# Check if deployed
curl -I https://agentcache.ai/api/endpoint

# View logs
vercel logs --tail=50

# Test locally (if possible)
# Note: Edge functions may not work locally - deploy to test
```

**Problem:** Environment variable missing
```bash
# Check Vercel
vercel env ls

# Add if missing
vercel env add VAR_NAME production
```

---

## ✅ Checklist Before Deploying

- [ ] Code follows existing patterns
- [ ] No Node.js APIs in `/api` files
- [ ] Backward compatible (or versioned)
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] Error handling present
- [ ] CORS headers if needed
- [ ] Commit message clear
- [ ] Ready to test on production

---

**🚀 You're ready! Start with `cat WARP.md` for deep dive, or jump right into coding.**

**💡 Pro tip:** Bookmark this file - you'll reference it constantly.
