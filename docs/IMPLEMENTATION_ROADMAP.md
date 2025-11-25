# AgentCache Implementation Roadmap
**Status:** Phase 1 Complete ✅ | Next: Interactive Landing Page

---

## ✅ Phase 1 COMPLETE: HPC Sector Integration (Today)

### Completed
- [x] Created 20 research-backed HPC sector scenarios
- [x] Integrated scenarios into wizard UI
- [x] Added compliance badges and savings estimates
- [x] Polished wizard UI with example chips
- [x] Database migrated with 20 edge locations
- [x] Vendor integration guide (JettyThunder reference)
- [x] Product-led growth strategy documented

### Files Created
```
/src/config/sectorScenarios.js (448 lines)
/src/components/WizardModalNew.jsx (updated)
/src/components/WizardModalNew.css (697 lines)
/docs/VENDOR_INTEGRATION_GUIDE.md (536 lines)
/docs/SIGNUP_FUNNEL_STRATEGY.md (416 lines)
/docs/FINAL_STATUS.md
```

---

## 🚀 Phase 2: Interactive Landing Page (Week 1)

### Goal
Turn landing page into interactive demo that drives signups

### Tasks

#### 2.1 Landing Page Hero Section
**File:** `public/index.html` or create `src/pages/LandingPage.jsx`

```jsx
// Interactive Hero
<section className="hero-interactive">
  <h1>Build Your AI Pipeline in 30 Seconds</h1>
  
  {/* Sector Selector */}
  <div className="sector-pills">
    <button onClick={() => loadScenario('healthcare')}>
      🏥 Healthcare
    </button>
    <button onClick={() => loadScenario('finance')}>
      💰 Finance
    </button>
    <button onClick={() => loadScenario('education')}>
      🎓 Education
    </button>
    <button onClick={() => loadScenario('data_lakehouse')}>
      📊 Data Lakehouse
    </button>
  </div>

  {/* Live Pipeline Preview */}
  <div className="pipeline-preview">
    {/* Mini React Flow showing selected scenario */}
    <ReactFlow nodes={demoNodes} edges={demoEdges} />
    
    {/* Metrics Ticker */}
    <div className="metrics-banner">
      <div>💰 Saving: {savings}/mo</div>
      <div>⚡ Latency: {latency}ms</div>
      <div>🔒 Compliance: {compliance.join(', ')}</div>
    </div>
  </div>

  {/* CTA */}
  <div className="cta-row">
    <button className="btn-primary">
      Sign Up to Customize
    </button>
    <span className="cta-hint">
      👆 Click nodes to explore • 3 free test queries
    </span>
  </div>
</section>
```

#### 2.2 Anonymous Interaction Tracking
**File:** `src/utils/anonymousSession.js`

```javascript
// Track landing page activity without signup
export class AnonymousSession {
  constructor() {
    this.sessionId = crypto.randomUUID();
    this.activity = [];
  }

  trackScenarioView(sector, scenarioId) {
    this.activity.push({
      type: 'view_scenario',
      sector,
      scenarioId,
      timestamp: Date.now()
    });
    localStorage.setItem('agentcache_session', JSON.stringify(this));
  }

  trackNodeClick(nodeType) {
    this.activity.push({
      type: 'node_click',
      nodeType,
      timestamp: Date.now()
    });
  }

  trackTestQuery() {
    this.activity.push({
      type: 'test_query',
      timestamp: Date.now()
    });
  }

  getRecommendedSector() {
    // Analyze activity to recommend sector on signup
    const sectorCounts = {};
    this.activity.forEach(a => {
      if (a.sector) {
        sectorCounts[a.sector] = (sectorCounts[a.sector] || 0) + 1;
      }
    });
    return Object.keys(sectorCounts).sort((a,b) => 
      sectorCounts[b] - sectorCounts[a]
    )[0];
  }

  getQueryCount() {
    return this.activity.filter(a => a.type === 'test_query').length;
  }
}
```

#### 2.3 Smart Signup Prompts
**File:** `src/components/SignupPrompt.jsx`

```jsx
function SignupPrompt({ trigger, onClose, onSignup }) {
  const prompts = {
    node_edit: {
      title: '🔒 Sign up to unlock full editing',
      message: 'Customize node configurations and save your changes',
      cta: 'Sign Up - It\'s Free'
    },
    query_limit: {
      title: '🎉 You\'ve tested 3 queries!',
      message: 'Imagine savings at scale: 10K queries = $1,200/mo saved',
      cta: 'Sign Up for Unlimited Tests'
    },
    save_pipeline: {
      title: '💾 Sign up to save this pipeline',
      message: 'Deploy to production and generate API keys',
      cta: 'Create Free Account'
    }
  };

  const prompt = prompts[trigger];

  return (
    <div className="signup-prompt-overlay">
      <div className="signup-prompt-modal">
        <h3>{prompt.title}</h3>
        <p>{prompt.message}</p>
        
        <div className="auth-buttons">
          <button onClick={() => onSignup('google')}>
            <GoogleIcon /> Continue with Google
          </button>
          <button onClick={() => onSignup('github')}>
            <GitHubIcon /> Continue with GitHub
          </button>
          <button onClick={() => onSignup('email')}>
            ✉️ Continue with Email
          </button>
        </div>

        <button className="skip" onClick={onClose}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}
```

---

## 🔐 Phase 3: Authentication System (Week 2)

### Goal
Frictionless signup with social auth

### Tasks

#### 3.1 OAuth Integration
**Dependencies:** `npm install @auth/core @auth/express passport passport-google-oauth20 passport-github2`

**File:** `server/auth/oauth.js`

```javascript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

// Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    // Find or create user
    let user = await db.users.findByEmail(profile.emails[0].value);
    
    if (!user) {
      // New user - create with pre-loaded workspace
      user = await createUserWithWorkspace({
        email: profile.emails[0].value,
        name: profile.displayName,
        avatar: profile.photos[0].value,
        provider: 'google',
        providerId: profile.id
      });
    }
    
    return done(null, user);
  }
));

// GitHub OAuth
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    // Similar to Google
  }
));
```

#### 3.2 Post-Signup Workspace Creation
**File:** `server/services/workspaceService.js`

```javascript
export async function createUserWithWorkspace(userData) {
  // 1. Create user
  const user = await db.users.create(userData);
  
  // 2. Check anonymous session for context
  const session = getAnonymousSession(req);
  const recommendedSector = session?.getRecommendedSector() || 'general';
  
  // 3. Load appropriate HPC scenario
  const scenarios = getSectorScenarios(recommendedSector);
  const starterScenario = scenarios[0]; // Use first scenario as starter
  
  // 4. Create workspace with pre-loaded pipeline
  const workspace = await db.workspaces.create({
    user_id: user.id,
    name: `${user.name}'s Workspace`,
    sector: recommendedSector
  });
  
  // 5. Create starter pipeline from scenario
  const pipeline = await db.pipelines.create({
    workspace_id: workspace.id,
    name: starterScenario.name,
    nodes: starterScenario.nodes,
    // ... full scenario data
    is_starter: true
  });
  
  // 6. Generate API keys
  const apiKey = await generateApiKey(user.id);
  
  // 7. Assign free credits
  await db.credits.create({
    user_id: user.id,
    amount: 500, // $500 free credits
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });
  
  return user;
}
```

#### 3.3 Magic Link Email Auth
**File:** `server/auth/magicLink.js`

```javascript
import { generateToken } from '../utils/jwt.js';
import { sendEmail } from '../services/emailService.js';

export async function sendMagicLink(email) {
  // Generate one-time token
  const token = generateToken({ email }, '15m');
  
  // Store token in Redis with 15min TTL
  await redis.set(`magic:${token}`, email, 'EX', 900);
  
  // Send email
  await sendEmail({
    to: email,
    subject: 'Sign in to AgentCache',
    html: `
      <h2>Welcome to AgentCache!</h2>
      <p>Click below to sign in (link expires in 15 minutes):</p>
      <a href="https://agentcache.ai/auth/verify?token=${token}">
        Sign In
      </a>
    `
  });
}

export async function verifyMagicLink(token) {
  const email = await redis.get(`magic:${token}`);
  
  if (!email) {
    throw new Error('Invalid or expired link');
  }
  
  // Delete token (one-time use)
  await redis.del(`magic:${token}`);
  
  // Find or create user
  let user = await db.users.findByEmail(email);
  if (!user) {
    user = await createUserWithWorkspace({ email });
  }
  
  return user;
}
```

---

## 📊 Phase 4: Analytics & Gating (Week 3)

### Goal
Track conversion funnel and smart gating

### Tasks

#### 4.1 Event Tracking
**File:** `src/utils/analytics.js`

```javascript
export const track = {
  landingPageView() {
    // Track page view
    analytics.track('Landing Page View');
  },

  scenarioViewed(sector, scenarioId) {
    analytics.track('Scenario Viewed', {
      sector,
      scenarioId
    });
  },

  nodeClicked(nodeType) {
    analytics.track('Node Clicked', {
      nodeType,
      intent: 'exploration'
    });
  },

  editAttempt(nodeType) {
    analytics.track('Edit Attempt', {
      nodeType,
      gated: true
    });
    // Trigger signup prompt
    showSignupPrompt('node_edit');
  },

  testQuery(queryNumber) {
    analytics.track('Test Query', {
      queryNumber
    });
    
    if (queryNumber >= 3) {
      // Hit query limit
      showSignupPrompt('query_limit');
    }
  },

  signupStarted(method) {
    analytics.track('Signup Started', {
      method // 'google', 'github', 'email'
    });
  },

  signupCompleted(user) {
    analytics.track('Signup Completed', {
      userId: user.id,
      sector: user.workspace.sector
    });
  }
};
```

#### 4.2 Feature Gating
**File:** `src/utils/featureGates.js`

```javascript
export class FeatureGate {
  static canEditNodes(user) {
    return !!user; // Requires signup
  }

  static canSavePipeline(user) {
    return !!user;
  }

  static canRunQuery(user, queryCount) {
    if (!user) {
      return queryCount < 3; // 3 free queries
    }
    // Check credits
    return user.credits > 0;
  }

  static canDeployPipeline(user) {
    return user && user.tier !== 'free';
  }

  static canAccessAnalytics(user) {
    return user && ['pro', 'business', 'enterprise'].includes(user.tier);
  }
}
```

---

## 🎨 Phase 5: UI Polish (Week 4)

### Goal
Smooth animations and delightful UX

### Tasks

#### 5.1 Pipeline Animation
- Animated data flow through nodes
- Particle effects on cache hits
- Smooth transitions between scenarios

#### 5.2 Metrics Counter
- Animated cost savings ticker
- Real-time latency updates
- Cache hit rate visualization

#### 5.3 Onboarding Tooltips
- First-time user hints
- Interactive tutorial
- Progress indicators

---

## 📈 Success Metrics

### Week 1-2 Targets
- Landing page demo engagement: >60%
- Signup conversion rate: >15%
- Time to first pipeline: <2 minutes

### Week 3-4 Targets
- Day 7 retention: >40%
- API key generation: >80% of signups
- First query run: >90% of signups

---

## 🚧 Known Gaps to Address

### Technical Debt
- [ ] Add error boundaries for React components
- [ ] Implement loading skeletons
- [ ] Add retry logic for API calls
- [ ] Optimize bundle size (code splitting)

### Features Not Yet Built
- [ ] Team collaboration (multi-user workspaces)
- [ ] Pipeline versioning/history
- [ ] Cost allocation dashboard
- [ ] Compliance audit logs UI

---

## 🎯 Next Immediate Actions (Pick One)

### Option A: Quick Win (2-3 hours)
1. Add sector selector to landing page hero
2. Show live pipeline preview on selection
3. Deploy to Vercel for feedback

### Option B: Solid Foundation (1-2 days)
1. Implement Google OAuth completely
2. Build post-signup workspace creation
3. Test full funnel end-to-end

### Option C: Maximum Impact (3-5 days)
1. Rebuild landing page with interactive demo
2. Add all 3 OAuth providers
3. Implement smart gating and prompts
4. Launch with analytics tracking

---

**Recommended: Start with Option A for quick validation, then move to Option C for production launch**
