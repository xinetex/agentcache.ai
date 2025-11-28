# Vercel 1-Click Integration Setup

**Status**: ✅ Code Complete - Ready for OAuth App Registration  
**Time to Complete**: ~30 minutes

---

## What We Built

A complete Vercel-style 1-click installation system that:
1. User visits `/integrations/vercel.html`
2. Clicks "Add to Vercel" → OAuth flow
3. Selects their project
4. **Auto-provisions**:
   - Generates unique API key
   - Creates isolated namespace
   - Sets env vars in Vercel project automatically
5. User's code works immediately (env vars already set!)

---

## Files Created

```
/public/integrations/
  └── vercel.html               # Landing page with install button

/src/integrations/
  └── vercel.ts                 # OAuth flow endpoints (install, callback, provision)

/src/services/
  └── provisioning.ts           # API key generation & namespace management

/src/index.ts                   # ✅ Updated with integration routes
/.env.example                   # ✅ Updated with Vercel credentials
```

---

## Step-by-Step Setup

### Step 1: Register OAuth App with Vercel

1. **Go to Vercel Integration Console**
   ```
   https://vercel.com/dashboard/integrations/console
   ```

2. **Create New Integration**
   - Click "Create Integration"
   - Fill in details:

   **Basic Information:**
   - **Name**: AgentCache.ai
   - **Slug**: `agentcache` (must match code)
   - **Description**: "Cognitive Memory OS - Cache your AI agents' intelligence layer"
   - **Website**: https://agentcache.ai
   - **Support Email**: support@agentcache.ai

   **Logo:**
   - Upload 256x256 PNG (create one with your brain emoji 🧠)
   - Square, transparent background preferred

   **Redirect URL:**
   ```
   https://agentcache.ai/api/integrations/vercel/callback
   ```
   
   For local testing, add:
   ```
   http://localhost:3001/api/integrations/vercel/callback
   ```

   **Permissions (Scopes):**
   - ✅ `read:project` - List user's projects
   - ✅ `write:env` - Set environment variables
   - ✅ `read:account` - Get user info

3. **Get Credentials**
   After creating, you'll receive:
   - **Client ID**: `oac_...` (starts with `oac_`)
   - **Client Secret**: Long secret string

   **IMPORTANT**: Save these securely!

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Vercel Integration
VERCEL_CLIENT_ID=oac_your_actual_client_id
VERCEL_CLIENT_SECRET=your_actual_client_secret
PUBLIC_URL=https://agentcache.ai

# For local testing:
# PUBLIC_URL=http://localhost:3001
```

### Step 3: Deploy to Production

```bash
# Make sure all files are committed
git add .
git commit -m "Add Vercel 1-click integration"

# Deploy to Vercel
vercel --prod

# Or push to trigger auto-deploy
git push origin main
```

### Step 4: Test the Integration

#### Option A: Test in Production
```
1. Visit: https://agentcache.ai/integrations/vercel.html
2. Click "Add to Vercel"
3. Grant permissions
4. Select a test project
5. Verify env vars are set
```

#### Option B: Test Locally
```bash
# Start local server
npm run dev

# Visit in browser
open http://localhost:3001/integrations/vercel.html

# Click "Add to Vercel"
# Complete OAuth flow
```

---

## How It Works

### Flow Diagram
```
User clicks "Add to Vercel"
     ↓
GET /api/integrations/vercel/install
  → Generates state (CSRF token)
  → Sets cookie
  → Redirects to: vercel.com/integrations/agentcache/new
     ↓
User grants permissions on Vercel
     ↓
Vercel redirects to: /api/integrations/vercel/callback?code=xxx
     ↓
GET /api/integrations/vercel/callback
  → Verifies state token
  → Exchanges code for access_token
  → Fetches user's projects
  → Shows project selection form
     ↓
User selects project, submits
     ↓
POST /api/integrations/vercel/provision
  → Generates API key (ac_vercel_...)
  → Creates namespace (vercel_projectId)
  → Sets env vars via Vercel API:
     • AGENTCACHE_API_KEY (encrypted)
     • AGENTCACHE_API_URL (plain)
  → Records installation
  → Redirects back to Vercel dashboard
     ↓
✅ Complete! User's next deploy uses AgentCache automatically
```

### API Endpoints

**Public Routes:**
- `GET /integrations/vercel.html` - Landing page
- `GET /api/integrations/vercel/install` - Start OAuth
- `GET /api/integrations/vercel/callback` - Handle OAuth callback
- `POST /api/integrations/vercel/provision` - Provision resources

---

## Vercel Integration Configuration

In Vercel's integration console, configure:

### Configuration Options
```json
{
  "name": "AgentCache.ai",
  "slug": "agentcache",
  "description": "Cognitive Memory OS - Cache your AI agents' intelligence layer",
  "logo": "https://agentcache.ai/logo.png",
  "website": "https://agentcache.ai",
  "support": {
    "email": "support@agentcache.ai",
    "url": "https://agentcache.ai/docs"
  },
  "public": true,
  "verified": false,
  "featured": false
}
```

### Environment Variables Set
When user installs, these are automatically added to their project:

```env
AGENTCACHE_API_KEY=ac_vercel_[64 hex chars]
AGENTCACHE_API_URL=https://agentcache.ai/api
```

---

## Testing Checklist

### Pre-Deployment Tests
- [ ] Landing page renders correctly
- [ ] "Add to Vercel" button redirects to Vercel OAuth
- [ ] CSRF state token is set in cookie
- [ ] OAuth callback receives code parameter
- [ ] Token exchange works (if credentials are set)

### Post-Deployment Tests
- [ ] Complete OAuth flow with test account
- [ ] Project selection shows user's projects
- [ ] Provision creates API key (check logs)
- [ ] Env vars appear in Vercel project settings
- [ ] Redeploy triggers and env vars are available
- [ ] Test API call with generated key

### Integration Tests
```bash
# Test with curl (after deployment)
curl https://agentcache.ai/api/health

# Should return:
# {"status":"healthy","service":"AgentCache.ai",...}
```

---

## Troubleshooting

### "Invalid state parameter"
**Cause**: CSRF token mismatch or cookie not set  
**Fix**: Check cookie domain settings, try in incognito mode

### "Failed to exchange authorization code"
**Cause**: Wrong Client ID/Secret or redirect URI mismatch  
**Fix**: 
1. Verify `.env` credentials match Vercel dashboard
2. Ensure redirect URI exactly matches (including http/https)

### "Failed to fetch projects"
**Cause**: Missing scopes or invalid token  
**Fix**: Check Vercel integration has `read:project` scope

### "Failed to set env var"
**Cause**: Missing `write:env` scope or API error  
**Fix**: 
1. Verify `write:env` scope is granted
2. Check Vercel API status
3. Look at error logs for details

### Env vars not appearing in Vercel
**Cause**: Need to redeploy after setting env vars  
**Fix**: Trigger a new deployment (push to git or manual deploy)

---

## Next Steps

### 1. Submit for Vercel Marketplace (Optional)
Once tested and stable:
1. Go to Integration Console
2. Click "Submit for Review"
3. Fill out marketplace listing
4. Wait for Vercel approval (~1 week)

### 2. Add Analytics
Track installation metrics:
```typescript
// In provision endpoint, add:
await analytics.track({
  event: 'integration_installed',
  platform: 'vercel',
  userId: userId,
  projectId: projectId
});
```

### 3. Build More Integrations
Copy this pattern for:
- Netlify (similar OAuth flow)
- Railway (API token based)
- Fly.io (manual setup)

---

## Security Notes

⚠️ **Important**:
- Never commit `.env` with real credentials
- Use encrypted env vars in Vercel for API keys
- Validate all OAuth state tokens (CSRF protection)
- Store access tokens securely (don't log them)
- Use HTTPS in production (required for OAuth)

---

## Support

**For Users Installing**:
- Documentation: https://agentcache.ai/docs
- Support: support@agentcache.ai

**For Development**:
- Code: `/src/integrations/vercel.ts`
- Logs: Check Vercel function logs
- Debug: Add console.log in provision flow

---

## Success Metrics

Track these after launch:
- **Installation Time**: Target <30 seconds
- **Completion Rate**: Target >90%
- **Time to First API Call**: Target <5 minutes
- **Support Tickets**: Target <5%

---

**Ready to Launch?**

1. Register OAuth app ✅
2. Set env vars ✅
3. Deploy to production ✅
4. Test with JettyThunder ✅
5. Ship it! 🚀
