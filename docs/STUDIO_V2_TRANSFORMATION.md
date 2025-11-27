# Studio V2 Transformation Plan

## Objective
Transform studio.html (1,806 lines) into studio-v2.html with:
- ✅ **Keep ALL existing features**: Pipeline Wizard, Project Scanner, canvas, sector nodes, billing
- ✅ **Add console aesthetics**: Theme selector (Console/Corporate/Tactical)
- ✅ **Integrate live data**: 8 APIs, 5 scenarios, real-time metrics
- ✅ **Gaming-quality polish**: HUD overlays, status bars, session stats

## What We're Preserving (Demo Mode)
1. **Pipeline Wizard** - 3-step pipeline creation
2. **Project Scanner** - GitHub/manual tech stack scanning
3. **Canvas** - Visual pipeline builder with nodes
4. **Sector Nodes** - Healthcare, Finance, etc. sector-specific components
5. **Billing Enforcement** - Demo mode limits, upgrade modals
6. **Workspace Management** - Save/load pipelines from sessionStorage

## What We're Adding
1. **Theme System** - Header theme selector (Console/Corporate/Tactical)
2. **Live Demo Tab** - New tab with 8 data sources, real-time fetching
3. **Scenario Runner** - 5 pre-built scenarios with live execution
4. **Session Stats HUD** - Footer bar with calls/hit rate/savings
5. **Activity Feed** - Right panel showing real-time cache events
6. **Console Aesthetics** - Apply console-base.css styling throughout

## File Strategy
**Option A: In-Place Enhancement** (Recommended)
- Copy studio.html → studio-v2.html
- Add `<link rel="stylesheet" href="/css/console-base.css">`
- Add script tags for live data modules
- Insert new UI sections (theme selector, Live Demo tab, stats bar)
- Apply `data-theme="console"` attribute
- **Time**: 2-3 hours | **Risk**: Low (original untouched)

**Option B: Gradual Migration**
- Keep studio.html as-is
- Build studio-v2.html section by section
- Test each section independently
- **Time**: 4-6 hours | **Risk**: Very low but slower

## Implementation Steps (Option A)

### Step 1: File Setup (5 min)
```bash
cp public/studio.html public/studio-v2.html
```

### Step 2: Add Theme System (10 min)
**In `<head>`:**
```html
<!-- Theme CSS -->
<link rel="stylesheet" href="/css/console-base.css">

<!-- Live Data Modules -->
<script src="/js/live-data-sources.js"></script>
<script src="/js/demo-scenarios.js"></script>
<script src="/js/live-metrics.js"></script>
```

**In `<body>`:**
```html
<body class="scanlines noise" data-theme="console">
```

**In header (after sector badge):**
```html
<!-- Theme Selector -->
<div class="theme-selector">
  <button class="theme-btn active" data-theme="console">Console</button>
  <button class="theme-btn" data-theme="corporate">Corporate</button>
  <button class="theme-btn" data-theme="tactical">Tactical</button>
</div>
```

### Step 3: Add Live Demo Tab (30 min)
**After existing canvas content div, add new tab:**
```html
<!-- Tab: Live Demo -->
<div id="liveDemoTab" class="tab-content">
  <div class="grid grid-cols-2 gap-6 p-6">
    <!-- Left: Data Source Selector -->
    <div class="glass-elevated p-6 rounded-lg">
      <h3 class="font-display text-lg mb-4 glow-text">Data Sources</h3>
      <select id="dataSourceSelect" class="...">
        <!-- Populated by LIVE_DATA_SOURCES -->
      </select>
      <button id="fetchDataBtn" class="...">Fetch Data</button>
      <button id="fetch10xBtn" class="...">Run 10x</button>
    </div>
    
    <!-- Right: Metrics HUD -->
    <div class="glass-elevated p-6 rounded-lg">
      <h3 class="font-display text-lg mb-4">Real-Time Metrics</h3>
      <div id="metricsDisplay">
        <!-- Populated by LiveMetricsTracker -->
      </div>
    </div>
    
    <!-- Bottom: Response Viewer -->
    <div class="glass p-6 rounded-lg col-span-2">
      <h3 class="font-display text-sm mb-2">Response</h3>
      <pre id="responseViewer" class="font-data text-xs">...</pre>
    </div>
  </div>
</div>
```

**Tab button in header:**
```html
<button class="tab-btn" data-tab="liveDemoTab">
  <span class="glow-text">⚡</span> Live Demo
</button>
```

### Step 4: Add Scenario Runner Section (20 min)
**New tab after Live Demo:**
```html
<!-- Tab: Scenarios -->
<div id="scenariosTab" class="tab-content">
  <div class="grid grid-cols-3 gap-4 p-6">
    <!-- Scenario cards populated by DEMO_SCENARIOS -->
  </div>
  <div id="scenarioProgress" class="hidden">
    <!-- Progress bar + live metrics -->
  </div>
</div>
```

### Step 5: Add Session Stats Footer (15 min)
**Before closing `</body>`:**
```html
<!-- Session Stats Footer -->
<footer class="fixed bottom-0 left-0 right-0 glass border-t border-base h-10 flex items-center justify-between px-6 text-xs font-data">
  <div class="flex gap-6">
    <span>SYS</span>
    <span>SESSION: <span id="sessionTime">0m 0s</span></span>
    <span>CALLS: <span id="sessionCalls">0</span>/50</span>
    <span>HIT RATE: <span id="hitRate" class="text-success">0%</span> ⚡</span>
    <span>SAVINGS: $<span id="savings">0.00</span> 💰</span>
  </div>
  <div>
    <button id="viewReportBtn" class="...">📊 View Report</button>
  </div>
</footer>
```

### Step 6: Wire Up JavaScript (30 min)
**In `<script>` section, add after DOMContentLoaded:**
```javascript
// Initialize live data system
let liveDataFetcher;
let metricsTracker;
let sessionReport;
let scenarioRunner;

async function initializeLiveData() {
  if (!window.LiveDataFetcher) return;
  
  liveDataFetcher = new LiveDataFetcher();
  metricsTracker = new LiveMetricsTracker(liveDataFetcher);
  sessionReport = new SessionReport(liveDataFetcher, metricsTracker);
  scenarioRunner = new ScenarioRunner(liveDataFetcher, updateScenarioUI);
  
  // Populate data source dropdown
  populateDataSources();
  
  // Populate scenario cards
  populateScenarios();
  
  // Start session timer
  startSessionTimer();
}

// Call in initializeStudio()
await initializeLiveData();
```

### Step 7: Add Theme Switcher Logic (10 min)
```javascript
// Theme switching
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.body.dataset.theme = theme;
    
    // Update active state
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Save to localStorage
    localStorage.setItem('agentcache_theme', theme);
  });
});

// Load saved theme
const savedTheme = localStorage.getItem('agentcache_theme') || 'console';
document.body.dataset.theme = savedTheme;
```

### Step 8: Apply Console Styling (30 min)
**Replace utility classes with console variants:**
- `bg-slate-950` → `glass`
- `border-slate-800` → `border-base`
- `text-slate-400` → `text-secondary`
- Add `glow` class to accent elements
- Add `font-display` to headers
- Add `font-data` to metrics

## Testing Checklist
- [ ] Theme selector switches themes without breaking layout
- [ ] Live Demo tab fetches real data from APIs
- [ ] Metrics update in real-time
- [ ] Scenario runner executes and shows progress
- [ ] Session stats footer updates live
- [ ] All original features still work (wizard, scanner, canvas)
- [ ] Demo mode limits enforced
- [ ] Responsive on desktop (1920x1080, 1440x900)
- [ ] Corporate theme looks professional (no gaming effects)
- [ ] Console theme looks epic (glows, scanlines working)

## Rollout Plan
1. **Dev**: Test studio-v2.html at `/studio-v2.html?demo=true`
2. **Canary**: Redirect 10% of demo traffic to v2
3. **Production**: Make studio-v2.html default, keep v1 as `/studio-legacy.html`

## File Size Impact
- **Before**: studio.html = 1,806 lines
- **After**: studio-v2.html = ~2,200 lines (+400 for new features)
- **External CSS**: console-base.css = 459 lines
- **External JS**: 3 modules = 1,064 lines

**Total**: 2,200 HTML + 459 CSS + 1,064 JS = **3,723 lines** (modular!)

## Success Metrics
- Demo session duration: 3min → 6min (2x engagement)
- Feature discovery: 40% try live data, 25% run scenarios
- Theme preference: Track Console vs Corporate usage
- Conversion: Demo → signup rate increases 15%+

---

**Next Action**: Execute Step 1-3 to get foundation working, then iterate.
