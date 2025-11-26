# OAuth Deployment Checklist

Before deploying and testing the OAuth functionality, ensure the following steps are completed:

## 1. Database Migration

Run the OAuth connections migration in your Neon database:

```sql
-- Execute this SQL in your Neon database console
CREATE TABLE IF NOT EXISTS oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_username VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON oauth_connections(provider, provider_user_id);
```

Or use the migration file:
```bash
# Connect to your Neon database and run:
\i db/migrations/003_add_oauth_connections.sql
```

## 2. GitHub OAuth App Setup

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Configure:
   - Application name: `AgentCache`
   - Homepage URL: `https://agentcache.ai`
   - Authorization callback URL: `https://agentcache.ai/api/auth/github/callback`
4. Save the Client ID and Client Secret

## 3. Google OAuth App Setup

1. Go to https://console.cloud.google.com/
2. Create/select project
3. Enable Google+ API
4. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
5. Configure OAuth consent screen
6. Create Web application:
   - Name: `AgentCache`
   - Authorized redirect URIs: `https://agentcache.ai/api/auth/google/callback`
7. Save the Client ID and Client Secret

## 4. Vercel Environment Variables

Add these environment variables in Vercel project settings:

```env
# Existing variables (should already be set)
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
JWT_SECRET=YLxoiac+t2YH9hlv8rfVnY6D1PdemhsKma1pLNEQl7E=
RESEND_API_KEY=...
NODE_ENV=production

# New OAuth variables (add these)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 5. Deploy to Vercel

Push code to GitHub to trigger automatic deployment:

```bash
git add .
git commit -m "Add OAuth authentication (GitHub and Google)"
git push origin main
```

## 6. Test OAuth Flow

### Test GitHub OAuth:
1. Visit https://agentcache.ai/login.html
2. Click "GitHub" button
3. Authorize the app on GitHub
4. Should redirect back to Studio with user logged in

### Test Google OAuth:
1. Visit https://agentcache.ai/login.html
2. Click "Google" button
3. Authorize the app on Google
4. Should redirect back to Studio with user logged in

### Test from Signup page:
1. Visit https://agentcache.ai/signup.html
2. Click "GitHub" or "Google" button
3. Same flow as above

## 7. Verify Database Records

After successful OAuth login, check your Neon database:

```sql
-- Check users table for OAuth user
SELECT id, email, full_name, password_hash, created_at 
FROM users 
WHERE email = 'your_oauth_email@example.com';

-- Check oauth_connections table
SELECT * FROM oauth_connections 
WHERE user_id = 'user_id_from_above';
```

OAuth users should have `password_hash` set to either:
- `oauth_github` for GitHub users
- `oauth_google` for Google users

## 8. Check Vercel Logs

If OAuth fails, check Vercel function logs:
1. Go to Vercel dashboard
2. Select AgentCache project
3. Click "Functions" tab
4. Look for `/api/auth/github/callback` or `/api/auth/google/callback`
5. Check for error messages

## Common Issues

### GitHub OAuth fails
- Verify callback URL matches exactly in GitHub app settings
- Check that GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set in Vercel
- Ensure your GitHub app is not restricted to specific organizations

### Google OAuth fails
- Ensure Google+ API is enabled
- Verify callback URL matches exactly in Google Cloud Console
- Check that app is published (not in testing mode) or test users are added
- Confirm GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Vercel

### Database errors
- Ensure `oauth_connections` table exists
- Check that `users` table has correct schema
- Verify DATABASE_URL is correct in Vercel

### Redirect issues
- Check that VERCEL_URL environment variable is available
- Verify login.html has token handling code
- Check browser console for JavaScript errors

## Files Modified/Created

### New API Endpoints:
- `api/auth/github/login.js` - Initiates GitHub OAuth
- `api/auth/github/callback.js` - Handles GitHub callback
- `api/auth/google/login.js` - Initiates Google OAuth
- `api/auth/google/callback.js` - Handles Google callback

### Modified Frontend:
- `public/login.html` - Added OAuth buttons and token handling
- `public/signup.html` - Added OAuth buttons

### Database:
- `db/migrations/003_add_oauth_connections.sql` - OAuth connections table

### Documentation:
- `docs/oauth-setup.md` - Detailed OAuth setup guide
- `docs/deployment-checklist.md` - This file

## Success Criteria

✅ OAuth buttons appear on login and signup pages
✅ Clicking GitHub button redirects to GitHub authorization
✅ Clicking Google button redirects to Google authorization
✅ After authorization, user is redirected back and logged in
✅ JWT token is stored in localStorage
✅ User can access Studio after OAuth login
✅ Database records created in `users` and `oauth_connections` tables
