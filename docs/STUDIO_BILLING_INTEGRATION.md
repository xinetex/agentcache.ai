# Studio Billing Integration

## Overview
Studio currently serves as both a demo and authenticated workspace. This document outlines the billing integration requirements and enforcement points.

## Current State

### studio.html
- **Demo Mode**: Accessible at `https://agentcache.ai/studio.html?demo=true`
- **Authenticated Mode**: Accessible at `https://agentcache.ai/studio.html` (with login)
- **Storage**: Uses localStorage for workspace persistence (client-side only)

### Existing Billing Infrastructure
- ✅ Stripe integration (`api/billing.js`)
- ✅ Subscription management (`subscriptions` table)
- ✅ Usage tracking (`usage_metrics` table)
- ✅ Pipeline complexity calculator (`lib/complexity-calculator.js`)
- ✅ Invoice history
- ✅ Three tiers: Starter ($49), Professional ($149), Enterprise ($499)

## Required Changes

### 1. Demo vs Authenticated Mode Detection

**File**: `public/studio.html`

Add at initialization:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const isDemoMode = urlParams.get('demo') === 'true';
const isAuthenticated = !!localStorage.getItem('agentcache_token');

// If not demo and not authenticated, redirect to login
if (!isDemoMode && !isAuthenticated) {
  window.location.href = '/login.html?redirect=/studio.html';
}
```

### 2. Demo Mode Restrictions

When `isDemoMode = true`:
- ❌ Cannot save workspaces permanently (localStorage only, cleared on refresh)
- ❌ Cannot generate API keys
- ❌ Cannot deploy pipelines to production
- ✅ Can use all Studio features (drag-drop, AI generation, metrics preview)
- ✅ Show banner: "Demo Mode - Sign up to save your work"

**UI Changes**:
```html
<!-- Add banner at top of Studio -->
<div id="demoBanner" class="hidden bg-amber-500/20 border-b border-amber-500/40 px-6 py-3">
  <div class="flex items-center justify-between">
    <p class="text-sm text-amber-200">
      🎭 Demo Mode - Your work won't be saved. 
      <a href="/signup.html" class="underline font-semibold">Sign up</a> to create production pipelines.
    </p>
    <button onclick="dismissDemoBanner()" class="text-amber-300 hover:text-amber-100">×</button>
  </div>
</div>
```

### 3. Billing Enforcement Points

#### A. Pipeline Creation Limits (Starter Plan)
```javascript
async function checkPipelineLimit() {
  if (isDemoMode) return true; // No limits in demo
  
  const response = await fetch('/api/billing/usage', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Starter: 3 pipelines max
  // Professional: 25 pipelines max
  // Enterprise: unlimited
  const limits = {
    starter: 3,
    professional: 25,
    enterprise: Infinity
  };
  
  const currentCount = data.pipelines.length;
  const userPlan = data.subscription.plan;
  
  if (currentCount >= limits[userPlan]) {
    showUpgradeModal('pipeline_limit', userPlan);
    return false;
  }
  
  return true;
}
```

#### B. Complexity-Based Billing
```javascript
async function calculatePipelineCost(pipeline) {
  const response = await fetch('/api/billing/calculate', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pipeline })
  });
  
  const data = await response.json();
  
  if (!data.included_in_plan) {
    // Show cost warning
    showCostWarning({
      complexity: data.complexity,
      monthlyCost: data.monthly_cost,
      requiresUpgrade: data.requires_upgrade,
      currentPlan: data.user_plan
    });
  }
  
  return data;
}
```

#### C. Scan Project Feature (New)
```javascript
async function scanProject() {
  // Free in demo mode (limited to 1 scan per session)
  if (isDemoMode) {
    const scans = sessionStorage.getItem('demo_scans') || 0;
    if (scans >= 1) {
      alert('Demo limit: 1 scan per session. Sign up for unlimited scans!');
      return;
    }
    sessionStorage.setItem('demo_scans', parseInt(scans) + 1);
  }
  
  // Authenticated: check quota
  if (isAuthenticated) {
    const response = await fetch('/api/billing/usage', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    // Scans are free, but pipelines created count against limit
    const quota = {
      starter: 3,
      professional: 25,
      enterprise: Infinity
    };
    
    if (data.pipelines.length >= quota[data.subscription.plan]) {
      showUpgradeModal('pipeline_quota', data.subscription.plan);
      return;
    }
  }
  
  // Proceed with scan...
}
```

### 4. Usage Metrics Integration

Track Studio actions:
```javascript
async function trackUsageMetric(action, metadata = {}) {
  if (isDemoMode) return; // Don't track demo usage
  
  await fetch('/api/metrics/track', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action, // 'pipeline_created', 'scan_completed', 'pipeline_deployed'
      metadata,
      timestamp: new Date().toISOString()
    })
  });
}
```

### 5. Upgrade Prompts

**File**: `public/studio.html` (add modal)
```html
<div id="upgradeModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
  <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
    <h2 class="text-xl font-semibold mb-4">Upgrade Required</h2>
    <div id="upgradeContent">
      <!-- Dynamic content based on limit type -->
    </div>
    <div class="flex gap-3 mt-6">
      <button onclick="closeUpgradeModal()" class="flex-1 px-4 py-2 border border-slate-700 rounded-lg">
        Cancel
      </button>
      <a id="upgradeLink" href="/pricing.html" class="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-sky-600 rounded-lg text-center">
        View Plans
      </a>
    </div>
  </div>
</div>
```

### 6. Workspace Persistence

**Demo Mode**: 
- localStorage only, cleared on session end
- No server sync
- No API key generation

**Authenticated Mode**:
- Sync to database via `/api/workspace/save`
- Retrieve via `/api/workspace/list`
- Cross-device access

```javascript
async function saveWorkspace(workspace) {
  if (isDemoMode) {
    // Demo: localStorage only
    const workspaces = JSON.parse(localStorage.getItem('agentcache_demo_workspaces') || '[]');
    workspaces.push(workspace);
    localStorage.setItem('agentcache_demo_workspaces', JSON.stringify(workspaces));
    return { success: true, demo: true };
  }
  
  // Authenticated: save to database
  const response = await fetch('/api/workspace/save', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workspace)
  });
  
  return await response.json();
}
```

## Subscription Limits

| Feature | Starter ($49/mo) | Professional ($149/mo) | Enterprise ($499/mo) |
|---------|------------------|------------------------|---------------------|
| Pipelines | 3 | 25 | Unlimited |
| Project Scans | Unlimited | Unlimited | Unlimited |
| Complexity | Simple only | Simple + Moderate | All tiers |
| API Requests | 100K/mo | 1M/mo | 10M/mo |
| Workspace Storage | 10 | 100 | Unlimited |
| Multi-tenant | ❌ | ❌ | ✅ |

## API Endpoints to Create

### `/api/workspace/save` (POST)
Save workspace to database (authenticated users only)
```json
{
  "workspace": {
    "id": "ws_123",
    "name": "JettyThunder Pipeline",
    "sector": "filestorage",
    "pipeline": { ... }
  }
}
```

### `/api/workspace/list` (GET)
Get user's workspaces
```json
{
  "workspaces": [
    {
      "id": "ws_123",
      "name": "JettyThunder Pipeline",
      "sector": "filestorage",
      "createdAt": "2025-11-27T10:00:00Z"
    }
  ]
}
```

### `/api/metrics/track` (POST)
Track user actions in Studio
```json
{
  "action": "pipeline_created",
  "metadata": {
    "pipelineId": "ws_123",
    "complexity": "moderate",
    "nodeCount": 8
  }
}
```

## Implementation Priority

1. **Phase 1** (Immediate):
   - Add demo mode detection
   - Add demo banner
   - Implement localStorage vs database persistence switch

2. **Phase 2** (This Week):
   - Add billing limit checks
   - Implement upgrade modals
   - Add usage metric tracking

3. **Phase 3** (Next Week):
   - Create `/api/workspace/*` endpoints
   - Sync workspaces to database
   - Add billing dashboard link to Studio

## Testing

### Demo Mode
```bash
# Open Studio in demo mode
open https://agentcache.ai/studio.html?demo=true

# Verify:
✓ Banner shows "Demo Mode"
✓ Workspaces saved to localStorage only
✓ Cannot deploy pipelines
✓ Scan limit: 1 per session
```

### Authenticated Mode
```bash
# Login and open Studio
open https://agentcache.ai/studio.html

# Verify:
✓ No demo banner
✓ Workspaces sync to database
✓ Pipeline limits enforced based on plan
✓ Usage metrics tracked
```

## Next Steps

1. Implement demo mode detection (30 min)
2. Add billing limit checks to scan feature (1 hour)
3. Create workspace sync API endpoints (2 hours)
4. Add upgrade modals and CTAs (1 hour)
5. Test end-to-end flow (1 hour)

**Total: ~5-6 hours of development**
