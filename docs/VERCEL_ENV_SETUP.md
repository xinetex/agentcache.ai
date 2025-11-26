# Vercel Environment Variables Setup

## 🎯 Quick Setup

Your application needs these 5 environment variables in Vercel to work in production:

### 1. Database Connection
```
DATABASE_URL=postgresql://neondb_owner:npg_eplH4UbciL5k@ep-small-poetry-advcfzn7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 2. Redis Cache (Upstash)
```
UPSTASH_REDIS_REST_URL=https://frank-buzzard-35556.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYrkAAIncDIxZjMxMDVkMzBkMzg0ZDMzOTBjYmJmZWU4NWZmMjVjZXAyMzU1NTY=
```

### 3. Authentication Secret
```
JWT_SECRET=agentcache-secret-2025
```

### 4. Environment
```
NODE_ENV=production
```

---

## 📝 How to Add in Vercel

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/xinetex/agentcache-ai/settings/environment-variables
2. For each variable above:
   - Click "Add New"
   - Paste the **Name** (e.g., `DATABASE_URL`)
   - Paste the **Value** (the part after the `=`)
   - Select all environments: Production, Preview, Development
   - Click "Save"
3. After adding all 5, go to "Deployments" tab
4. Click "..." on latest deployment → "Redeploy"

### Option 2: Via Vercel CLI
```bash
cd /Users/letstaco/Documents/agentcache-ai

# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Add environment variables
vercel env add DATABASE_URL production
# (paste the value when prompted)

vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add JWT_SECRET production
vercel env add NODE_ENV production

# Trigger redeploy
vercel --prod
```

---

## 🔍 What Each Variable Does

| Variable | Purpose | Used By |
|----------|---------|---------|
| `DATABASE_URL` | Connects to Neon PostgreSQL | User signup, login, org management |
| `UPSTASH_REDIS_REST_URL` | Redis server address | All cache operations |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication | All cache operations |
| `JWT_SECRET` | Signs authentication tokens | Login, session validation |
| `NODE_ENV` | Tells app it's in production | Logging, error handling |

---

## ✅ How to Verify It Works

After adding variables and redeploying:

1. **Check deployment logs:**
   - Go to Vercel → Deployments → Latest
   - Click on the deployment
   - Look for any errors about missing env vars

2. **Test the portal:**
   ```bash
   # Open in browser:
   https://agentcache-ai.vercel.app/portal/signup.html
   
   # Try to create an account
   # If it works → env vars are set correctly
   # If you see errors → check Vercel Function logs
   ```

3. **Check Function logs:**
   - Vercel Dashboard → Logs tab
   - Look for any "Environment variable not set" errors

---

## 🔒 Security Notes

- These variables are **already in your local `.env` file** - we're just copying them to Vercel
- Vercel encrypts environment variables - they're safe
- Never commit `.env` to Git (it's already in `.gitignore`)
- JWT_SECRET should be random - consider generating a stronger one for production:
  ```bash
  openssl rand -base64 32
  ```

---

## 🚨 Troubleshooting

**"Cannot read property 'query' of undefined"**
→ DATABASE_URL is missing or incorrect

**"Redis connection failed"**
→ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is wrong

**"jwt must be provided"**
→ JWT_SECRET is missing

**"Database connection failed"**
→ DATABASE_URL format is wrong (check for special characters)

---

**Status:** Ready to add to Vercel  
**Next Step:** Add these 5 variables to Vercel, then test signup page
