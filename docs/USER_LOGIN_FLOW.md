# User Login Flow

## Overview
After successful login, users land on **Studio v2** with a personalized workspace configured for their organization's sector and live data.

## Login Experience

### 1. Login Page
**URL**: `https://agentcache.ai/login.html`

Users enter:
- Email: `verdoni@gmail.com`
- Password: `temppass123` (temporary)

### 2. Post-Login Redirect
**Destination**: `/studio-v2.html`

The login handler (`/api/auth/login`) returns a JWT token containing:
- User ID
- Email
- Organization ID
- Role (owner/admin/member/viewer)

### 3. Studio v2 Initialization

When Studio v2 loads for an authenticated user:

1. **Load User Profile** (`/api/auth/me`)
   - Fetches user details
   - Loads organization with sector
   - Retrieves namespaces

2. **Configure Workspace**
   - Set `currentSector` from organization.sector
   - Update UI with sector icon and name
   - Display compliance badges (HIPAA, PCI-DSS, SOC2, etc.)

3. **Load Live Data**
   - Real metrics from user's cache usage
   - Organization-specific pipelines
   - Sector-specific node palette

## Sector Configuration

Each sector has specific UI elements:

| Sector | Icon | Name | Compliance Badges |
|--------|------|------|-------------------|
| healthcare | 🏥 | Healthcare | HIPAA |
| finance | 💰 | Finance | PCI-DSS, SOC2 |
| filestorage | 💾 | File Storage | SOC2 |
| legal | ⚖️ | Legal | SOC2 |
| ecommerce | 🛒 | E-Commerce | PCI-DSS |
| education | 🎓 | Education | FERPA |
| enterprise | 🏢 | Enterprise | SOC2 |
| developer | 👨‍💻 | Developer | - |
| datascience | 📊 | Data Science | - |
| general | ⚡ | General | - |

## Platform Admin Access

**verdoni@gmail.com** has been configured as platform admin with:

- **Organization**: AgentCache Platform
- **Slug**: agentcache-platform
- **Sector**: enterprise
- **Role**: owner
- **Plan**: enterprise
- **Limits**: 999 namespaces, 999 API keys, 999 users

### Default Namespaces
- `production` - Production environment
- `staging` - Staging environment
- `development` - Development environment

### Platform Features
- Multi-tenant support
- Custom nodes
- Lab access (Scientific Caching Laboratory)
- Full analytics dashboard

## Demo Mode vs Authenticated Mode

### Demo Mode
- URL: `/studio-v2.html?demo=true`
- Shows demo banner: "Sign up to save pipelines"
- Limited features
- No persistent storage
- Generic healthcare sector

### Authenticated Mode
- URL: `/studio-v2.html` (auto-redirect from login)
- No demo banner
- Full features unlocked
- User's organization sector
- Live metrics and data
- Persistent pipelines

## Key Files

### Frontend
- `public/login.html` - Login page (redirects to Studio v2)
- `public/studio-v2.html` - Main workspace
  - Loads user profile on init
  - Configures sector UI
  - Connects to live data

### Backend APIs
- `api/auth/login.js` - Authentication endpoint
- `api/auth/me.js` - User profile with organization
- `api/billing/usage.js` - Billing and quota info

### Database
- `organizations` - Organization details with sector
- `users.organization_id` - Links users to orgs
- `namespaces` - Org-scoped cache namespaces
- `organization_settings` - Feature flags and preferences

### Scripts
- `scripts/create-admin-org.js` - Create platform admin organization

## Next Steps

For additional users/customers:

1. **Create Organization**
   ```javascript
   await sql`
     INSERT INTO organizations (name, slug, sector, contact_email, plan_tier)
     VALUES ('Company Name', 'company-slug', 'healthcare', 'admin@company.com', 'professional')
   `;
   ```

2. **Assign User**
   ```javascript
   await sql`
     UPDATE users
     SET organization_id = ${orgId}, role = 'admin'
     WHERE email = 'user@company.com'
   `;
   ```

3. **User logs in** → Sees Studio v2 with their sector

## Platform Governance

As platform admin, you can:

1. **Test All Screens**
   - Switch sectors in Studio v2
   - View all sector-specific nodes
   - Access Lab visualizations
   - Monitor platform-wide analytics

2. **Manage Organizations**
   - Create new customer orgs
   - Assign users to orgs
   - Configure namespaces
   - Set quotas and limits

3. **Marketplace**
   - Access validated cache strategies from Lab
   - View adoption metrics
   - Fork and customize strategies
