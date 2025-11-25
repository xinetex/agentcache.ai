# 🚀 Landing Page Demo Integration Guide

## Overview
This guide explains how to integrate the AgentCache Studio demo into your landing page with the "Launch Studio Demo" button.

## 🔗 Demo URL

### Production URL
```
https://studio.agentcache.ai/?demo=true
```

### Local Development URL
```
http://localhost:3000/?demo=true
```

The `?demo=true` parameter triggers automatic loading of 5 example pipelines across different sectors.

---

## 📸 Screenshot Recommendations

### Option 1: Dashboard View (Recommended)
**Shows:** Grid of 5-6 pipeline cards with metrics

**Why:** Demonstrates workspace management, multiple sectors, active/inactive states

**How to capture:**
1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:3000/?demo=true`
3. Wait for sector selector → choose "Healthcare" or "Finance"
4. Dashboard loads with example pipelines
5. Take screenshot (full browser window)

**Best practices:**
- Use 1920x1080 resolution
- Show 4-6 pipeline cards
- Include filter/sort controls at top
- Capture active status indicators

---

### Option 2: Builder Canvas (Most Impressive)
**Shows:** Node-based visual pipeline with connections

**Why:** Demonstrates the visual builder, node variety, professional UI

**How to capture:**
1. Navigate to dashboard with demo data
2. Click "HIPAA-Compliant RAG" pipeline card
3. Canvas loads with 7 connected nodes
4. Zoom to fit (use React Flow controls bottom-left)
5. Take screenshot

**Best practices:**
- Show 6-8 nodes connected
- Include sidebar with node palette
- Show metrics panel on right (if space allows)
- Capture animated edges between nodes

---

### Option 3: Preset Gallery
**Shows:** Modal with sector-specific templates

**Why:** Demonstrates ease of use, one-click deployment

**How to capture:**
1. From builder view
2. Click "📁 Load Preset" button
3. Gallery modal opens
4. Take screenshot with modal open

---

## 🎨 Landing Page HTML Example

Replace your current placeholder screenshot with:

```html
<!-- Hero Section -->
<section class="hero">
  <h1>Manage your cognitive architecture like a pro.</h1>
  <p>The AgentCache Studio gives you granular control over memory, constraints, and integrations.</p>
  
  <!-- Screenshot -->
  <div class="studio-preview">
    <img 
      src="/images/studio-dashboard.png" 
      alt="AgentCache Studio Dashboard showing pipeline workspaces"
      width="1200"
      height="700"
    />
  </div>
  
  <!-- CTA Button -->
  <a href="https://studio.agentcache.ai/?demo=true" class="btn-launch-demo">
    Launch Studio Demo →
  </a>
</section>
```

---

## 🎯 Demo Experience Flow

When users click "Launch Studio Demo":

### 1️⃣ **Sector Selection** (First-time)
- Modal appears: "Choose Your Industry"
- 6 options: Healthcare, Finance, Legal, E-commerce, SaaS, General
- User selects sector → stored in localStorage

### 2️⃣ **Dashboard Loads**
- Shows 5 pre-loaded example pipelines
- Mix of active/inactive states
- Different sectors represented
- Realistic metrics displayed

### 3️⃣ **User Can Explore**
- **View pipelines**: Click any card → opens in builder
- **Toggle status**: Click ▶/⏸ to activate/deactivate
- **Filter/Sort**: Use controls to organize pipelines
- **Switch views**: Toggle between Grid and List
- **Create new**: Click "➕ New Pipeline" → blank canvas
- **Load preset**: Click "📁 Load Preset" → browse templates

### 4️⃣ **Build Pipeline** (Optional)
- Drag nodes from sidebar
- Connect nodes with edges
- Configure node settings
- Save with custom name
- See it appear in dashboard

---

## 📊 Pre-loaded Demo Data

The demo includes **5 example pipelines**:

| Pipeline | Sector | Status | Savings | Nodes |
|----------|--------|--------|---------|-------|
| HIPAA-Compliant RAG | Healthcare | Active | $4,200/mo | 7 |
| Real-Time Fraud Detection | Finance | Active | $6,500/mo | 6 |
| Legal Contract Analysis | Legal | Inactive | $5,200/mo | 5 |
| E-commerce Recommendations | E-commerce | Active | $4,100/mo | 5 |
| Multi-Tenant SaaS Cache | SaaS | Inactive | $3,800/mo | 6 |

**Total value demonstrated**: $23,800/mo in estimated savings

---

## 🎨 Screenshot Specs

### Recommended Dimensions
- **Desktop**: 1920x1080 (16:9)
- **Tablet**: 1024x768 (4:3)
- **Mobile**: 375x667 (iPhone)

### File Format
- **PNG** (lossless, best quality)
- Compress with TinyPNG for web

### Naming Convention
```
studio-dashboard.png
studio-builder.png
studio-gallery.png
studio-mobile.png
```

---

## 🔧 Technical Implementation

### Demo Mode Detection
```javascript
// Automatically loads demo data if ?demo=true in URL
if (window.location.search.includes('demo=true')) {
  loadDemoData(true); // Force load 5 example pipelines
}
```

### Data Persistence
- Demo data stored in `localStorage`
- Persists across page refreshes
- User can modify/save/delete demo pipelines
- Reset by clearing localStorage or closing browser

### Clearing Demo Data
```javascript
// Users can clear demo data and start fresh
localStorage.removeItem('savedPipelines');
```

---

## 🚀 Deployment Checklist

- [ ] Capture high-quality screenshots (1920x1080)
- [ ] Compress images for web (< 500KB each)
- [ ] Upload to landing page assets folder
- [ ] Update landing page HTML with new images
- [ ] Update "Launch Studio Demo" button URL
- [ ] Test demo URL opens correctly
- [ ] Verify demo data loads automatically
- [ ] Test on desktop, tablet, mobile
- [ ] Add analytics tracking to demo button
- [ ] Monitor demo usage metrics

---

## 📈 Analytics Recommendations

Track these events:
```javascript
// Button click
gtag('event', 'demo_launched', {
  'event_category': 'engagement',
  'event_label': 'studio_demo_button'
});

// Sector selected
gtag('event', 'sector_selected', {
  'event_category': 'demo',
  'event_label': sector_name
});

// Pipeline created
gtag('event', 'pipeline_created', {
  'event_category': 'demo',
  'event_label': 'user_pipeline'
});
```

---

## 🎯 Marketing Copy Suggestions

### Headline
- "Build AI pipelines visually, no code required"
- "See your cache architecture come to life"
- "Professional pipeline builder for enterprise AI"

### Subheading
- "Drag, drop, and deploy production-ready caching pipelines in minutes"
- "Visual workspace with compliance built-in"
- "From idea to production in 5 minutes"

### CTA Button Text Options
- "Launch Studio Demo →" (current)
- "Try Studio for Free →"
- "Build Your First Pipeline →"
- "See It In Action →"

---

## 🐛 Troubleshooting

### Demo data doesn't load
- Check browser console for errors
- Verify `?demo=true` in URL
- Clear localStorage and try again
- Check if localStorage is disabled (private mode)

### Sector modal doesn't appear
- Demo forces "healthcare" sector by default
- Can be changed in `demoData.js`

### Images not loading on landing page
- Check file paths are correct
- Verify images are in correct folder
- Test in incognito mode (cache issues)

---

## 📞 Support

**Demo URL**: https://studio.agentcache.ai/?demo=true  
**Docs**: `/docs` folder in repo  
**Issues**: GitHub Issues or Slack

---

**Status**: ✅ Ready for Production  
**Last Updated**: 2024-01-15  
**Version**: 1.0
