# 1-Click Installation System for AgentCache.ai

**Goal**: Make it as easy as Vercel integrations - click "Add Integration" → Auto-provision → Done in 30 seconds

---

## How Vercel Integrations Work (The Model)

### User Experience
```
1. Click "Add Integration" button on marketplace
2. OAuth: Grant permissions (read projects, write env vars)
3. Select project(s) to integrate
4. Auto-provision: Integration creates resources + sets env vars
5. Done! Start using immediately
```

### Technical Flow
```
User clicks "Add"
     ↓
Vercel OAuth (grants access to their account)
     ↓
Redirect to integration server with code
     ↓
Exchange code for access_token
     ↓
Use Vercel API to:
  - Read user's projects
  - Create env variables
  - Set up webhooks
     ↓
Redirect back to Vercel
     ↓
User sees "Integration installed ✅"
```

### Key Components
1. **OAuth App** - Registered with Vercel
2. **Callback Server** - Handles OAuth exchange
3. **Provisioning API** - Auto-creates resources
4. **Vercel API Client** - Sets env vars automatically

---

## AgentCache.ai 1-Click Installation

### Architecture

```
┌─────────────────────────────────────────────────────┐
│          AgentCache.ai Installation Flow             │
├─────────────────────────────────────────────────────┤
│                                                       │
│  User Journey:                                       │
│                                                       │
│  1. Visit agentcache.ai/integrations                │
│     - Click "Install for Vercel"                     │
│     - Click "Install for Netlify"                    │
│     - Click "Manual Setup" (API key only)            │
│                                                       │
│  2. OAuth Flow (Vercel example):                     │
│     User → Vercel OAuth → Grant permissions          │
│            ↓                                          │
│     Redirect: agentcache.ai/api/integrations/vercel/ │
│               callback?code=xxx                      │
│            ↓                                          │
│     Exchange code → Vercel access_token              │
│            ↓                                          │
│     AgentCache provisions:                           │
│       - Generate API key                             │
│       - Create namespace                             │
│       - Set env vars in Vercel project               │
│            ↓                                          │
│     Redirect: vercel.com → "Integration complete ✅" │
│                                                       │
│  3. Developer uses AgentCache:                       │
│     - Env vars already set (AGENTCACHE_API_KEY)      │
│     - Import SDK: npm install agentcache-client      │
│     - Start caching immediately                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Vercel Integration (Primary)

**Why Vercel First**: 
- Largest user base
- JettyThunder already on Vercel
- Best-documented integration API

#### 1.1 Register OAuth App with Vercel

**Steps**:
1. Go to https://vercel.com/dashboard/integrations/console
2. Create new integration
3. Fill in details:
   - **Name**: AgentCache.ai
   - **Slug**: `agentcache`
   - **Description**: "Cognitive Memory OS - Cache your AI agents' intelligence layer"
   - **Logo**: Upload 256x256 PNG
   - **Redirect URL**: `https://agentcache.ai/api/integrations/vercel/callback`
   - **Scopes**: 
     - `read:project` (list projects)
     - `write:env` (set environment variables)
     - `read:account` (get user info)

4. Get credentials:
   - **Client ID**: `oac_xyz...`
   - **Client Secret**: `secret_abc...`

#### 1.2 Create Integration Landing Page

**File**: `/public/integrations/vercel.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>AgentCache for Vercel - 1-Click Install</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
    }
    .hero {
      text-align: center;
      margin-bottom: 50px;
    }
    .hero h1 {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .hero p {
      font-size: 20px;
      color: #666;
    }
    .install-btn {
      background: #000;
      color: #fff;
      padding: 15px 30px;
      font-size: 18px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
    }
    .install-btn:hover {
      background: #333;
    }
    .feature {
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #0070f3;
      background: #f5f5f5;
    }
    .steps {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 40px 0;
    }
    .step {
      text-align: center;
      padding: 20px;
      background: #fff;
      border: 1px solid #eaeaea;
      border-radius: 8px;
    }
    .step-number {
      width: 40px;
      height: 40px;
      background: #0070f3;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 15px;
      font-size: 20px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🧠 AgentCache for Vercel</h1>
    <p>Cache your AI intelligence layer. Install in 30 seconds.</p>
    <a href="/api/integrations/vercel/install" class="install-btn">
      Add to Vercel →
    </a>
  </div>

  <div class="steps">
    <div class="step">
      <div class="step-number">1</div>
      <h3>Click Install</h3>
      <p>Grant AgentCache access to your Vercel account</p>
    </div>
    <div class="step">
      <div class="step-number">2</div>
      <h3>Select Project</h3>
      <p>Choose which project to integrate</p>
    </div>
    <div class="step">
      <div class="step-number">3</div>
      <h3>Start Caching</h3>
      <p>API key auto-configured. Start coding!</p>
    </div>
  </div>

  <div class="feature">
    <h3>✨ What Gets Installed</h3>
    <ul>
      <li><strong>Environment Variables:</strong> AGENTCACHE_API_KEY, AGENTCACHE_API_URL</li>
      <li><strong>API Key:</strong> Production-ready key auto-generated</li>
      <li><strong>Namespace:</strong> Isolated cache for your project</li>
      <li><strong>Free Tier:</strong> 100,000 requests/month included</li>
    </ul>
  </div>

  <div class="feature">
    <h3>📦 Next Steps After Install</h3>
    <pre><code>npm install agentcache-client

import { AgentCache } from 'agentcache-client';

const cache = new AgentCache(
  process.env.AGENTCACHE_API_KEY
);

const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});</code></pre>
  </div>

  <div class="feature">
    <h3>💰 Pricing</h3>
    <p><strong>Free:</strong> 100k requests/month</p>
    <p><strong>Pro:</strong> $20/month - 1M requests</p>
    <p><strong>Enterprise:</strong> Custom - Unlimited</p>
  </div>
</body>
</html>
```

#### 1.3 Create OAuth Install Endpoint

**File**: `src/integrations/vercel.ts` (new)

```typescript
import { Hono } from 'hono';
import { generateApiKey, createNamespace } from '../services/provisioning';

const app = new Hono();

// Step 1: Redirect to Vercel OAuth
app.get('/api/integrations/vercel/install', (c) => {
  const clientId = process.env.VERCEL_CLIENT_ID!;
  const redirectUri = 'https://agentcache.ai/api/integrations/vercel/callback';
  const state = crypto.randomUUID(); // CSRF protection
  
  // Store state in session/cookie
  c.cookie('vercel_oauth_state', state, {
    httpOnly: true,
    secure: true,
    maxAge: 600 // 10 minutes
  });
  
  const authUrl = `https://vercel.com/integrations/agentcache/new?state=${state}`;
  
  return c.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/api/integrations/vercel/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const configurationId = c.req.query('configurationId'); // Vercel installation ID
  
  // Verify CSRF token
  const savedState = c.cookie('vercel_oauth_state');
  if (state !== savedState) {
    return c.text('Invalid state parameter', 400);
  }
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code!,
      client_id: process.env.VERCEL_CLIENT_ID!,
      client_secret: process.env.VERCEL_CLIENT_SECRET!,
      redirect_uri: 'https://agentcache.ai/api/integrations/vercel/callback'
    })
  });
  
  const { access_token, user_id, team_id } = await tokenResponse.json();
  
  // Get user's projects
  const projectsResponse = await fetch('https://api.vercel.com/v9/projects', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  const { projects } = await projectsResponse.json();
  
  // Show project selection page
  return c.html(`
    <html>
      <head><title>Select Vercel Project</title></head>
      <body>
        <h1>Select Project to Integrate</h1>
        <form action="/api/integrations/vercel/provision" method="POST">
          <input type="hidden" name="access_token" value="${access_token}" />
          <input type="hidden" name="user_id" value="${user_id}" />
          <input type="hidden" name="config_id" value="${configurationId}" />
          <select name="project_id">
            ${projects.map(p => `
              <option value="${p.id}">${p.name}</option>
            `).join('')}
          </select>
          <button type="submit">Install AgentCache</button>
        </form>
      </body>
    </html>
  `);
});

// Step 3: Provision resources
app.post('/api/integrations/vercel/provision', async (c) => {
  const body = await c.req.parseBody();
  const accessToken = body.access_token as string;
  const projectId = body.project_id as string;
  const userId = body.user_id as string;
  const configId = body.config_id as string;
  
  // 1. Generate AgentCache API key
  const apiKey = await generateApiKey({
    user_id: userId,
    integration: 'vercel',
    project_id: projectId
  });
  
  // 2. Create namespace
  const namespace = await createNamespace({
    name: `vercel_${projectId}`,
    user_id: userId
  });
  
  // 3. Set environment variables in Vercel project
  await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'AGENTCACHE_API_KEY',
      value: apiKey,
      type: 'encrypted',
      target: ['production', 'preview', 'development']
    })
  });
  
  await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'AGENTCACHE_API_URL',
      value: 'https://agentcache.ai/api',
      type: 'plain',
      target: ['production', 'preview', 'development']
    })
  });
  
  // 4. Store installation in database
  await db.insert(installations).values({
    user_id: userId,
    platform: 'vercel',
    project_id: projectId,
    config_id: configId,
    api_key_id: apiKey,
    namespace: namespace,
    installed_at: new Date()
  });
  
  // 5. Redirect back to Vercel with success
  return c.redirect(
    `https://vercel.com/dashboard/integrations/agentcache/${configId}?success=true`
  );
});

export default app;
```

#### 1.4 Add Provisioning Service

**File**: `src/services/provisioning.ts` (new)

```typescript
import crypto from 'crypto';
import { db, apiKeys, namespaces } from '../db';

export async function generateApiKey(params: {
  user_id: string;
  integration: string;
  project_id: string;
}) {
  const key = `ac_${params.integration}_${crypto.randomBytes(32).toString('hex')}`;
  
  await db.insert(apiKeys).values({
    key: key,
    user_id: params.user_id,
    integration: params.integration,
    project_id: params.project_id,
    rate_limit: 100000, // Free tier
    created_at: new Date()
  });
  
  return key;
}

export async function createNamespace(params: {
  name: string;
  user_id: string;
}) {
  await db.insert(namespaces).values({
    name: params.name,
    user_id: params.user_id,
    created_at: new Date()
  });
  
  return params.name;
}
```

---

### Phase 2: Other Platform Integrations

#### 2.1 Netlify Integration

**Same flow as Vercel**:
- Register OAuth app: https://app.netlify.com/applications
- Callback URL: `https://agentcache.ai/api/integrations/netlify/callback`
- Set env vars via Netlify API

#### 2.2 Railway Integration

**Flow**:
- Railway OAuth
- Set env vars via Railway API

#### 2.3 Fly.io Integration

**Flow**:
- Manual API token
- Set secrets via `fly secrets set`

#### 2.4 Generic "Manual Setup"

**For platforms without OAuth**:
```
1. Generate API key
2. Copy key
3. Add to your .env file:
   AGENTCACHE_API_KEY=ac_...
   AGENTCACHE_API_URL=https://agentcache.ai/api
4. Done!
```

---

### Phase 3: Launch Wizard (Self-Service)

**File**: `/public/launch-wizard.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>AgentCache Launch Wizard</title>
</head>
<body>
  <div id="wizard">
    <!-- Step 1: Choose Sector -->
    <div id="step1">
      <h2>What are you building?</h2>
      <div class="sectors">
        <button onclick="selectSector('filestorage')">
          📁 File Storage / CDN
        </button>
        <button onclick="selectSector('healthcare')">
          🏥 Healthcare RAG
        </button>
        <button onclick="selectSector('finance')">
          💰 Financial Trading
        </button>
        <button onclick="selectSector('ecommerce')">
          🛍️ E-commerce
        </button>
        <button onclick="selectSector('other')">
          🔧 Other
        </button>
      </div>
    </div>

    <!-- Step 2: Use Case -->
    <div id="step2" style="display:none;">
      <h2>What's your primary use case?</h2>
      <div id="use-cases"></div>
    </div>

    <!-- Step 3: Platform -->
    <div id="step3" style="display:none;">
      <h2>Where are you deploying?</h2>
      <button onclick="installPlatform('vercel')">
        ▲ Vercel (1-Click)
      </button>
      <button onclick="installPlatform('netlify')">
        🔷 Netlify (1-Click)
      </button>
      <button onclick="installPlatform('railway')">
        🚂 Railway (1-Click)
      </button>
      <button onclick="installPlatform('manual')">
        📋 Manual Setup (Copy API Key)
      </button>
    </div>

    <!-- Step 4: Complete -->
    <div id="step4" style="display:none;">
      <h2>✅ You're all set!</h2>
      <p>Your API key: <code id="api-key"></code></p>
      <p>Namespace: <code id="namespace"></code></p>
      
      <h3>Quick Start Code</h3>
      <pre><code id="quickstart-code"></code></pre>
      
      <button onclick="window.location='/dashboard'">
        Go to Dashboard →
      </button>
    </div>
  </div>

  <script>
    let sector, useCase, platform;

    async function selectSector(s) {
      sector = s;
      document.getElementById('step1').style.display = 'none';
      
      // Load use cases for sector
      const useCases = await fetch(`/api/wizard/use-cases?sector=${s}`).then(r => r.json());
      
      document.getElementById('use-cases').innerHTML = useCases.map(uc => `
        <button onclick="selectUseCase('${uc.id}')">${uc.name}</button>
      `).join('');
      
      document.getElementById('step2').style.display = 'block';
    }

    function selectUseCase(uc) {
      useCase = uc;
      document.getElementById('step2').style.display = 'none';
      document.getElementById('step3').style.display = 'block';
    }

    async function installPlatform(p) {
      platform = p;
      
      if (p === 'manual') {
        // Generate API key immediately
        const response = await fetch('/api/wizard/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sector, useCase, platform })
        });
        
        const { api_key, namespace, quickstart } = await response.json();
        
        document.getElementById('api-key').textContent = api_key;
        document.getElementById('namespace').textContent = namespace;
        document.getElementById('quickstart-code').textContent = quickstart;
        
        document.getElementById('step3').style.display = 'none';
        document.getElementById('step4').style.display = 'block';
      } else {
        // Redirect to OAuth flow
        window.location = `/api/integrations/${p}/install?sector=${sector}&useCase=${useCase}`;
      }
    }
  </script>
</body>
</html>
```

---

## User Flows

### Flow 1: JettyThunder Developer (Vercel)
```
1. Visit agentcache.ai/integrations/vercel
2. Click "Add to Vercel"
3. Vercel OAuth: Grant permissions
4. Select "jettythunder-v2" project
5. Click "Install"
   → API key generated
   → Env vars set automatically
   → Namespace created: vercel_jettythunder
6. Redeploy triggers automatically
7. Code already works! (process.env.AGENTCACHE_API_KEY)
```

**Time**: 30 seconds

### Flow 2: New User (Manual)
```
1. Visit agentcache.ai
2. Click "Launch Wizard"
3. Select "File Storage"
4. Select "File Management" use case
5. Click "Manual Setup"
6. Copy API key
7. Add to .env file
8. npm install agentcache-client
9. Start coding
```

**Time**: 2 minutes

---

## Database Schema

```typescript
// installations table
{
  id: string;
  user_id: string;
  platform: 'vercel' | 'netlify' | 'railway' | 'manual';
  project_id: string;
  config_id: string; // Platform's integration ID
  api_key_id: string;
  namespace: string;
  installed_at: Date;
  last_used_at: Date;
}

// api_keys table
{
  key: string;
  user_id: string;
  integration: string;
  project_id: string;
  rate_limit: number;
  usage_count: number;
  created_at: Date;
}

// namespaces table
{
  name: string;
  user_id: string;
  sector: string;
  use_case: string;
  created_at: Date;
}
```

---

## Next Steps

### Week 1: Vercel Integration
- [ ] Register OAuth app with Vercel
- [ ] Build integration landing page
- [ ] Implement OAuth callback flow
- [ ] Test with JettyThunder project
- [ ] Deploy to production

### Week 2: Launch Wizard
- [ ] Build sector selection UI
- [ ] Add use case recommendations
- [ ] Implement manual setup flow
- [ ] Add quickstart code generator

### Week 3: Other Platforms
- [ ] Netlify integration
- [ ] Railway integration
- [ ] Fly.io integration

### Week 4: Polish & Launch
- [ ] Add analytics tracking
- [ ] Write documentation
- [ ] Create demo video
- [ ] Launch on Product Hunt

---

## Success Metrics

- **Installation time**: <30 seconds (Vercel) vs <2 minutes (Manual)
- **Completion rate**: >90% (users who start finish)
- **Time to first API call**: <5 minutes
- **Support tickets**: <5% (self-service)
- **Activation rate**: >80% (install → usage within 24h)

---

**Ready to build?** Start with Vercel integration for JettyThunder! 🚀
