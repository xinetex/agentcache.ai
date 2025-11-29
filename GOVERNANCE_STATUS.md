# AgentCache.ai - Platform Governance Status

**Last Updated**: November 28, 2025  
**Status**: ✅ Fully Wired and Ready

---

## 🎯 Complete Governance System

Your platform has a comprehensive multi-tenant governance system with role-based access control (RBAC).

### Database Schema ✅

#### Organizations (Multi-Tenant)
- Organization management with sectors
- Plan tiers: `free`, `starter`, `professional`, `enterprise`
- Stripe integration for billing
- Status management: `active`, `suspended`, `canceled`

#### Users with Roles
```sql
role: owner | admin | member | viewer
```

**Role Hierarchy** (defined in `lib/auth-middleware.js`):
1. `viewer` - Read-only access
2. `member` - Standard user access
3. `admin` - Org admin privileges
4. `owner` - Full org control

#### Organization Features
- **Namespaces**: Multi-tenant cache isolation
- **API Keys**: Org-scoped with permission scopes
- **Pipelines**: Org-scoped pipeline management
- **Usage Metrics**: Aggregated org-level analytics

---

## 🔐 Authentication & Authorization

### Middleware Functions (lib/auth-middleware.js)

1. **`requireAuth(req)`**
   - Verify JWT token
   - Returns user object with org and role
   
2. **`requireOrgAccess(req, orgId)`**
   - Verify user belongs to organization
   - Enforce org-level access control

3. **`requireRole(req, minRole)`**
   - Enforce minimum role level
   - Example: `requireRole(req, 'admin')` blocks viewers and members

4. **`getUserOrganization(userId)`**
   - Fetch full org details with namespaces
   - Includes API key counts

5. **`withAuth(handler)`**
   - Wrapper for route handlers
   - Automatic error handling

---

## 👨‍💼 Admin Access

### Admin Dashboard
**URL**: `/admin.html`

**Features**:
- Platform statistics
- Admin-only operations
- Requires `ADMIN_TOKEN` environment variable

### Creating Admin User

Run the script:
```bash
node scripts/create_admin.js
```

This creates an admin user in Redis:
- Email: `admin@agentcache.ai`
- Role: `admin`
- Plan: `business`
- API Key: `ac_admin_master_key_999`

---

## 🏢 Organization Management

### Organization Table Structure
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sector TEXT NOT NULL,
  plan_tier TEXT DEFAULT 'starter',
  max_namespaces INTEGER DEFAULT 5,
  max_api_keys INTEGER DEFAULT 3,
  max_users INTEGER DEFAULT 5,
  stripe_customer_id TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  ...
)
```

### Namespace Isolation
Each organization can have multiple namespaces:
- `standard` - Regular namespaces
- `tenant_template` - Templates for multi-customer orgs
- `global` - Shared across org

Example: JettyThunder with namespaces:
- `jt_storage` - File storage caching
- `jt_cdn` - CDN caching
- `jt_customer_123` - Individual customer namespace

---

## 📊 Usage Tracking

### Organization Metrics
```sql
organization_usage_metrics (
  organization_id,
  namespace_id,
  cache_requests,
  cache_hits,
  tokens_processed,
  cost_baseline,
  cost_saved
)
```

### Built-in Functions
1. **`get_org_current_month_usage(org_id)`**
   - Total requests, hits, hit rate, cost saved
   
2. **`get_namespace_usage(org_id, days)`**
   - Breakdown by namespace
   - Last N days of usage

### Views
**`organization_summary`** - Quick org overview:
- Total namespaces, users, API keys, pipelines
- Status and plan tier

---

## 🔑 API Key Management

### Key Structure
```sql
api_keys (
  user_id UUID,
  organization_id UUID,
  key_hash TEXT,
  key_prefix TEXT,
  scopes JSONB,  -- ["cache:read", "cache:write"]
  allowed_namespaces JSONB,  -- ["jt_*", "shared"]
  is_active BOOLEAN
)
```

### Permission Scopes
- `cache:read` - Read from cache
- `cache:write` - Write to cache
- `cache:delete` - Delete cache entries
- `org:admin` - Org admin operations

### Namespace Patterns
API keys can be scoped to specific namespaces:
```json
{
  "allowed_namespaces": [
    "jt_storage",
    "jt_cdn",
    "jt_customer_*"  // Wildcard pattern
  ]
}
```

---

## 🚀 Current Setup

### What's Deployed
✅ Database schema with organizations  
✅ Role-based access control  
✅ Auth middleware (JWT validation)  
✅ Organization isolation  
✅ Namespace multi-tenancy  
✅ Usage tracking per org  
✅ Admin dashboard UI  

### What's Working on Vercel
- User signup/login (JWT tokens)
- Dashboard with org context
- Settings page
- Studio (pipeline builder)
- Cognitive Universe

---

## 👤 Your Login Info

### Finding Your Account

Your account was created when you signed up. To access:

1. **Visit**: Your Vercel deployment URL
2. **Login at**: `/login.html`
3. **Email**: The email you used during signup
4. **Password**: The password you set

### If You Don't Have an Account

Create one at `/signup.html`:
1. Enter your email
2. Set a password (min 8 chars)
3. Provide your name
4. Account is created instantly
5. Redirects to dashboard

### Forgot Password?

Use `/forgot-password.html` to reset

---

## 🔧 Admin Operations

### Create Your Admin Account

1. **Set environment variable** (in Vercel):
   ```
   ADMIN_TOKEN=<generate-random-secure-token>
   ```

2. **Run admin creation script**:
   ```bash
   node scripts/create_admin.js
   ```

3. **Access admin dashboard**:
   - Visit `/admin.html`
   - Paste your `ADMIN_TOKEN`
   - Click "Load stats"

### Admin API Endpoints
- `GET /api/admin-stats` - Platform statistics
- `POST /api/drip-run` - Run drip campaigns
- (More admin endpoints in `api/admin/` directory)

---

## 🏗️ Migration Status

### Applied Migrations ✅
- `001_add_organizations.sql` - Organizations and namespaces
- `002_add_password_reset_tokens.sql` - Password reset
- `003_add_oauth_connections.sql` - OAuth support
- `004_cognitive_universe.sql` - Intelligence layer
- `005_add_workspaces.sql` - Workspace support
- `006_pipelines_v2.sql` - Enhanced pipelines

### To Deploy Migrations

If database is fresh:
```bash
# Connect to Neon via psql or run via scripts
psql $DATABASE_URL -f db/schema.sql
psql $DATABASE_URL -f db/migrations/001_add_organizations.sql
psql $DATABASE_URL -f db/migrations/002_add_password_reset_tokens.sql
# ... etc
```

Or use the setup script:
```bash
node scripts/setup-database.js
```

---

## 📋 Next Steps

1. **Create your account** at `/signup.html`
2. **Login** at `/login.html`
3. **Explore dashboard** at `/dashboard.html`
4. **Manage API keys** at `/settings.html`
5. **Build pipelines** at `/studio.html`

### For Admin Access
1. Set `ADMIN_TOKEN` in Vercel environment variables
2. Run `node scripts/create_admin.js` (optional - for Redis admin user)
3. Access admin features via `/admin.html`

---

## 🆘 Troubleshooting

### Can't login?
- Check Vercel logs for auth errors
- Verify `DATABASE_URL` is set in Vercel
- Verify `JWT_SECRET` is set in Vercel
- Check if migrations are applied to Neon database

### No organizations showing?
- Organizations are created when users sign up
- Check database: `SELECT * FROM organizations;`
- Verify migration 001 was applied

### API keys not working?
- Check `api_keys` table in database
- Verify key has correct `organization_id`
- Check key is `is_active = true`

---

## 📚 Related Files

- `lib/auth-middleware.js` - Auth & RBAC functions
- `lib/jwt.js` - JWT token handling
- `db/migrations/001_add_organizations.sql` - Org schema
- `scripts/create_admin.js` - Admin user creation
- `public/admin.html` - Admin dashboard
- `api/auth/*.js` - Auth endpoints

---

## ✨ Summary

Your platform governance is **completely wired up**:

✅ Multi-tenant organization system  
✅ Role-based access control (4 levels)  
✅ Namespace isolation for multi-customer support  
✅ API key scoping with permissions  
✅ Organization usage tracking  
✅ Admin dashboard and operations  
✅ All migrations ready to deploy  

**You just need to create your account and start using it!**
