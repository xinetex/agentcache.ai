# Environment Variables Checklist

**For**: AgentCache.ai Production Deployment (Vercel)  
**Critical for**: JettyThunder Onboarding & Enterprise Customers

## Status Check

Run this in Vercel dashboard → Settings → Environment Variables to verify what's set.

## 🔴 Critical (Required for JettyThunder)

### Database
```bash
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
# Neon Postgres connection string
# Get from: https://console.neon.tech
```

### Authentication (MISSING - BLOCKER)
```bash
JWT_SECRET=                    # 32-byte random string
# Generate: openssl rand -base64 32
# Used by: /api/auth/*, customer portal login
```

### Redis (for API key caching)
```bash
REDIS_URL=redis://default:password@host:port
# Upstash Redis or similar
# Used by: API key validation, rate limiting
# Get from: https://console.upstash.com
```

## 🟡 Important (Needed for Full Features)

### Stripe (Billing)
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Get from: https://dashboard.stripe.com/apikeys
# Used by: Subscription management, checkout
```

### OpenAI (AI Features)
```bash
OPENAI_API_KEY=sk-...
# Get from: https://platform.openai.com/api-keys
# Used by: Wizard AI, pipeline generation, semantic search
```

### Email (Transactional)
```bash
SENDGRID_API_KEY=SG....
# OR
RESEND_API_KEY=re_...
# Used by: Welcome emails, password resets, notifications
```

## 🟢 Optional (Enhanced Features)

### OAuth (Social Login)
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### Monitoring
```bash
SENTRY_DSN=https://...@sentry.io/...
# Error tracking
```

### Analytics
```bash
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com
```

## Verification Commands

### 1. Check what's currently set in Vercel:
```bash
vercel env ls
```

### 2. Pull Vercel env vars locally (for testing):
```bash
vercel env pull .env.local
```

### 3. Test database connection:
```bash
# Create test file: test-db.js
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const result = await sql`SELECT NOW()`;
console.log('DB Connected:', result);

# Run: node test-db.js
```

### 4. Generate JWT secret:
```bash
openssl rand -base64 32
# Copy output and add to Vercel env vars
```

## How to Add Missing Variables

### Via Vercel Dashboard:
1. Go to https://vercel.com/your-team/agentcache-ai
2. Settings → Environment Variables
3. Add each variable:
   - Name: `JWT_SECRET`
   - Value: `<paste generated secret>`
   - Environment: Production, Preview, Development
4. Save
5. Redeploy: Deployments → Latest → Redeploy

### Via CLI:
```bash
# Add one variable
vercel env add JWT_SECRET production

# Add from file
vercel env add < .env.production
```

## JettyThunder Blocker Analysis

Based on your notebooks, these are **blocking JettyThunder onboarding**:

### Phase 1 Blockers (Must Fix Now)
- [ ] `DATABASE_URL` - Already set? (verify tables exist)
- [ ] `JWT_SECRET` - **MISSING** - Needed for customer portal login
- [ ] `REDIS_URL` - Needed for API key validation

### Phase 2 (Can manual workaround)
- [ ] `STRIPE_SECRET_KEY` - Can bill manually initially
- [ ] `OPENAI_API_KEY` - Wizard AI features degraded without it
- [ ] Email service - Can send emails manually

## Testing After Adding Variables

### 1. Test Auth System:
```bash
# Should return JWT token
curl -X POST https://agentcache.ai/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","full_name":"Test User"}'
```

### 2. Test Database:
```bash
# Should return organization list
curl https://agentcache.ai/api/portal/provision \
  -H "Content-Type: application/json"
```

### 3. Test Redis (API key):
```bash
# Should validate API key
curl https://agentcache.ai/api/cache/get?key=test \
  -H "X-API-Key: ac_live_..." \
  -H "X-Cache-Namespace: default"
```

## Security Best Practices

### ✅ DO:
- Use different secrets for production vs preview
- Rotate JWT_SECRET every 90 days
- Use Vercel's encrypted environment variables
- Add secrets via Vercel dashboard (encrypted at rest)
- Use strong random values (not "secret123")

### ❌ DON'T:
- Commit secrets to git (.env files in .gitignore)
- Share secrets in Slack/email
- Use same secret across multiple services
- Use predictable secrets (company name, etc.)

## Next Steps for JettyThunder Launch

1. **Immediate** (15 min):
   ```bash
   # Generate and add JWT secret
   openssl rand -base64 32 | pbcopy
   # → Paste in Vercel env vars as JWT_SECRET
   ```

2. **Set up Redis** (30 min):
   - Sign up: https://console.upstash.com
   - Create database
   - Copy REDIS_URL
   - Add to Vercel

3. **Verify database** (5 min):
   ```bash
   # Check if organizations table exists
   psql $DATABASE_URL -c "\dt organizations"
   ```

4. **Test deployment** (10 min):
   - Redeploy on Vercel
   - Test /api/auth/register endpoint
   - Verify no 500 errors in logs

5. **Onboard JettyThunder** (1 hour):
   - Run onboarding script
   - Send portal invitation
   - Monitor first API calls

## Current Variable Audit

Run this to see what you have:

```bash
# Check Vercel
vercel env ls production

# Should see:
# DATABASE_URL (set)
# JWT_SECRET (MISSING - add this!)
# REDIS_URL (check if set)
# STRIPE_SECRET_KEY (optional for now)
# OPENAI_API_KEY (optional for now)
```

---

**Bottom Line**: You need `JWT_SECRET` and `REDIS_URL` at minimum to unblock JettyThunder. Add these two now, redeploy, then proceed with customer onboarding.
