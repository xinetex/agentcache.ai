# Deployment Checklist - AgentCache.ai

## Pre-Deployment

### 1. Environment Variables
Set these in Vercel project settings:

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Authentication
JWT_SECRET=<generate-random-32-char-string>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Redis
UPSTASH_REDIS_URL=rediss://default:password@host:6379

# Application
PUBLIC_URL=https://agentcache.ai
NODE_ENV=production
```

### 2. Database Setup
- [ ] Neon database created
- [ ] Schema deployed (`db/schema.sql`)
- [ ] Migrations applied (`db/migrations/*.sql`)
- [ ] Connection tested

### 3. Secrets Verification
- [ ] All `.env*` files in `.gitignore`
- [ ] No hardcoded secrets in tracked files
- [ ] Vercel environment variables set

### 4. Stripe Setup
- [ ] Live mode API keys
- [ ] Webhook endpoint configured
- [ ] Products and prices created

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy: [description]"
   git push origin main
   ```

2. **Vercel Auto-Deploy**
   - Vercel detects push
   - Builds and deploys
   - Environment variables from Vercel settings

3. **Post-Deploy Verification**
   - [ ] `/api/health` returns 200
   - [ ] Signup flow works
   - [ ] Login flow works
   - [ ] Dashboard loads
   - [ ] API keys work

## Rollback Plan

If deployment fails:
1. Revert git commit: `git revert HEAD`
2. Push to trigger redeploy
3. Check Vercel logs for errors

## Security Notes

- NEVER commit `.env` files
- NEVER commit files with real secrets
- Use Vercel environment variables for all secrets
- Rotate secrets immediately if exposed
