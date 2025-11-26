# OAuth Setup Guide

This guide explains how to set up GitHub and Google OAuth authentication for AgentCache.

## Prerequisites

Before setting up OAuth, ensure you have:
- Database migration `003_add_oauth_connections.sql` has been run
- Environment variables configured in Vercel

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: AgentCache
   - **Homepage URL**: `https://agentcache.ai`
   - **Authorization callback URL**: `https://agentcache.ai/api/auth/github/callback`
4. Click "Register application"
5. Copy the **Client ID**
6. Generate a new **Client Secret** and copy it

### 2. Configure Environment Variables in Vercel

Add these environment variables to your Vercel project:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Google OAuth Setup

### 1. Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth client ID"
6. Configure the OAuth consent screen if prompted:
   - User Type: External
   - App name: AgentCache
   - User support email: your email
   - Developer contact: your email
7. Select "Web application" as application type
8. Fill in the details:
   - **Name**: AgentCache
   - **Authorized redirect URIs**: `https://agentcache.ai/api/auth/google/callback`
9. Click "Create"
10. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables in Vercel

Add these environment variables to your Vercel project:

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Database Migration

Run the OAuth connections migration:

```sql
-- This should be run in your Neon database
\i db/migrations/003_add_oauth_connections.sql
```

Or manually execute the SQL from `db/migrations/003_add_oauth_connections.sql`.

## Testing OAuth Flow

### For GitHub:
1. Visit `https://agentcache.ai/login.html`
2. Click the "GitHub" button
3. You'll be redirected to GitHub for authorization
4. After authorizing, you'll be redirected back and logged in

### For Google:
1. Visit `https://agentcache.ai/login.html`
2. Click the "Google" button
3. You'll be redirected to Google for authorization
4. After authorizing, you'll be redirected back and logged in

## How OAuth Works

### Flow Overview:
1. User clicks GitHub/Google button on login or signup page
2. User is redirected to `/api/auth/{provider}/login`
3. API redirects to OAuth provider (GitHub/Google)
4. User authorizes the application
5. Provider redirects to `/api/auth/{provider}/callback` with authorization code
6. API exchanges code for access token
7. API fetches user info (email, name, profile)
8. API finds or creates user in database
9. API stores OAuth connection in `oauth_connections` table
10. API generates JWT token
11. User is redirected to `/login.html?token={jwt}&auth=success`
12. Frontend stores token in localStorage and redirects to `/studio.html`

### Database Schema

**oauth_connections table:**
- `id` - UUID primary key
- `user_id` - Reference to users table
- `provider` - 'github' or 'google'
- `provider_user_id` - OAuth provider's user ID
- `provider_username` - Username/email from provider
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Constraint:** UNIQUE(user_id, provider) - One connection per provider per user

### OAuth Users
- OAuth users are created with `password_hash='oauth_github'` or `'oauth_google'` as a placeholder
- They cannot log in with email/password (unless they set one later)
- Same email can be used for both email/password and OAuth authentication

## Troubleshooting

### "GitHub authentication failed"
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set in Vercel
- Verify the callback URL matches exactly in GitHub app settings
- Check Vercel function logs for detailed error messages

### "Google authentication failed"
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Vercel
- Verify the callback URL matches exactly in Google Cloud Console
- Ensure Google+ API is enabled for your project
- Check Vercel function logs for detailed error messages

### Database Errors
- Ensure migration `003_add_oauth_connections.sql` has been run
- Check that `users` table exists and has the expected schema
- Verify database connection string (`DATABASE_URL`) is correct

## Security Notes

- OAuth secrets should NEVER be committed to git
- Always use environment variables for sensitive credentials
- JWT tokens expire after 7 days (configured in `lib/jwt.js`)
- OAuth tokens are not stored - only user info and connection records
