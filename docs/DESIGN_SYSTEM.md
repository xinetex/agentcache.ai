# AgentCache Design System

**Version:** 1.0  
**Last Updated:** November 2024

## Overview

This document defines the unified design system for AgentCache, ensuring consistency across all pages: Dashboard, Studio, Cognitive Universe, Analytics, and Settings.

---

## 🎨 Color Palette

### Primary Colors
```css
/* Background */
--bg-primary: #020617    /* slate-950 - Main background */
--bg-secondary: #0f172a  /* slate-900 - Secondary panels */
--bg-tertiary: #1e293b   /* slate-800 - Hover states */

/* Text */
--text-primary: #f1f5f9   /* slate-100 - Primary text */
--text-secondary: #cbd5e1 /* slate-300 - Secondary text */
--text-muted: #64748b     /* slate-500 - Muted/placeholder */

/* Borders */
--border-primary: #334155/80  /* slate-700/80 - Standard borders */
--border-secondary: #1e293b   /* slate-800 - Subtle dividers */
```

### Accent Colors
```css
/* Sky (Primary Actions) */
--accent-sky-50: #f0f9ff
--accent-sky-400: #38bdf8
--accent-sky-500: #0ea5e9  /* Primary buttons */
--accent-sky-600: #0284c7  /* Primary buttons hover */

/* Emerald (Success) */
--accent-emerald-300: #6ee7b7
--accent-emerald-400: #34d399
--accent-emerald-500: #10b981

/* Amber (Warning) */
--accent-amber-400: #fbbf24
--accent-amber-500: #f59e0b

/* Rose (Error/Danger) */
--accent-rose-400: #fb7185
--accent-rose-500: #f43f5e
--accent-rose-600: #e11d48

/* Purple (AI/Premium) */
--accent-purple-400: #c084fc
--accent-purple-500: #a855f7
```

---

## 📝 Typography

### Font Families
```css
/* Primary: Inter/Geist */
--font-sans: 'Inter', 'Geist', system-ui, -apple-system, sans-serif;

/* Monospace: JetBrains Mono/Geist Mono */
--font-mono: 'JetBrains Mono', 'Geist Mono', 'Courier New', monospace;
```

### Type Scale
```css
/* Headings */
--text-3xl: 1.875rem  /* 30px - h1 */
--text-2xl: 1.5rem    /* 24px - h2 */
--text-xl: 1.25rem    /* 20px - h3 */
--text-lg: 1.125rem   /* 18px - h4 */
--text-base: 1rem     /* 16px - h5, body */
--text-sm: 0.875rem   /* 14px - h6, small text */
--text-xs: 0.75rem    /* 12px - captions */

/* Font Weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Usage Examples
```html
<!-- Page Title -->
<h1 class="text-2xl font-semibold tracking-tight text-slate-50">Page Title</h1>

<!-- Section Heading -->
<h2 class="text-lg font-semibold text-slate-100">Section Heading</h2>

<!-- Body Text -->
<p class="text-sm text-slate-300">Body text content</p>

<!-- Small Label -->
<span class="text-xs uppercase tracking-wide text-slate-500">Label</span>
```

---

## 📐 Spacing & Layout

### Spacing Scale (Tailwind)
```
gap-1  = 0.25rem (4px)
gap-2  = 0.5rem  (8px)
gap-3  = 0.75rem (12px)
gap-4  = 1rem    (16px)
gap-6  = 1.5rem  (24px)
gap-8  = 2rem    (32px)

p-3  = 0.75rem padding
p-4  = 1rem padding
p-5  = 1.25rem padding
p-6  = 1.5rem padding
```

### Border Radius
```css
--radius-sm: 0.375rem  /* 6px - small elements */
--radius-md: 0.5rem    /* 8px - buttons, inputs */
--radius-lg: 0.75rem   /* 12px - cards */
--radius-xl: 1rem      /* 16px - modal */
```

### Container Max Widths
```css
max-w-sm: 24rem   /* 384px */
max-w-md: 28rem   /* 448px */
max-w-lg: 32rem   /* 512px */
max-w-xl: 36rem   /* 576px */
max-w-2xl: 42rem  /* 672px */
max-w-6xl: 72rem  /* 1152px */
```

---

## 🧩 Components

### Buttons

#### Primary Button
```html
<button class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/50 hover:bg-sky-500 disabled:opacity-50">
  <i data-lucide="plus" class="w-4 h-4"></i>
  Button Text
</button>
```

#### Secondary Button
```html
<button class="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/80 hover:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100">
  Button Text
</button>
```

#### Danger Button
```html
<button class="inline-flex items-center gap-2 rounded-md bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-semibold text-white">
  Delete
</button>
```

### Cards

#### Standard Card
```html
<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
  <h3 class="text-lg font-semibold text-slate-100 mb-4">Card Title</h3>
  <!-- Content -->
</div>
```

#### Elevated Card
```html
<div class="rounded-lg border border-slate-800 bg-slate-900 shadow-lg p-6">
  <!-- Content -->
</div>
```

### Badges

```html
<!-- Success -->
<span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
  Success
</span>

<!-- Warning -->
<span class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
  Warning
</span>

<!-- Error -->
<span class="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300">
  Error
</span>
```

### Inputs

```html
<input 
  type="text" 
  placeholder="Enter text..." 
  class="w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
/>
```

### Metrics Display

```html
<div class="flex flex-col gap-1">
  <span class="text-xs uppercase tracking-wide text-slate-500">Metric Label</span>
  <div class="text-3xl font-bold text-slate-50">94.2%</div>
  <div class="text-xs text-emerald-400">+3.2% from last period</div>
</div>
```

---

## 🎭 Icons

**Icon Library:** Lucide Icons  
**CDN:** `https://unpkg.com/lucide@latest/dist/umd/lucide.js`

### Icon Sizes
```html
<i data-lucide="icon-name" class="w-4 h-4"></i>  <!-- 16px - standard -->
<i data-lucide="icon-name" class="w-5 h-5"></i>  <!-- 20px - medium -->
<i data-lucide="icon-name" class="w-6 h-6"></i>  <!-- 24px - large -->
```

### Common Icons
- **Dashboard:** `layout-dashboard`
- **Studio:** `workflow`
- **Cognitive Universe:** `brain`
- **Analytics:** `activity`
- **Settings:** `sliders`
- **Add/Plus:** `plus`
- **Check/Success:** `check-circle`
- **Warning:** `alert-triangle`
- **Error:** `alert-circle`

### Icon Initialization
```javascript
// Initialize all Lucide icons on page load
lucide.createIcons();
```

---

## 🧭 Navigation

### Sidebar Navigation (Dashboard, Settings, Cognitive Universe)
```html
<aside class="hidden lg:flex lg:flex-col lg:w-64 border-r border-slate-800/80 bg-slate-950/90 backdrop-blur">
  <!-- Logo -->
  <div class="flex items-center justify-between px-6 py-5 border-b border-slate-800/80">
    <div class="flex items-center gap-2">
      <div class="h-7 w-7 rounded-md bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
        <span class="text-sm font-semibold tracking-tight text-sky-300">AC</span>
      </div>
      <div class="flex flex-col">
        <span class="text-base font-semibold text-slate-50 tracking-tight">AgentCache</span>
        <span class="text-xs font-medium text-slate-500 tracking-tight">Inference Control</span>
      </div>
    </div>
  </div>

  <!-- Navigation Links -->
  <nav class="flex-1 overflow-y-auto">
    <div class="px-3 pt-4 pb-6 space-y-2 text-sm">
      <div class="px-3 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-slate-500">Main</div>
      
      <!-- Active Link -->
      <a href="/dashboard.html" class="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium bg-slate-900 text-slate-50">
        <i data-lucide="layout-dashboard" class="w-4 h-4 stroke-[1.5] text-sky-300"></i>
        <span>Dashboard</span>
      </a>
      
      <!-- Inactive Link -->
      <a href="/studio.html" class="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-900/80 hover:text-slate-100">
        <i data-lucide="workflow" class="w-4 h-4 stroke-[1.5] text-slate-500"></i>
        <span>Studio</span>
      </a>
    </div>
  </nav>
</aside>
```

### Header Navigation (Studio - horizontal variant)
```html
<header class="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-6 py-3 backdrop-blur">
  <!-- Logo + Nav -->
  <div class="flex items-center gap-4">
    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-lg">
      AC
    </div>
    <div class="flex items-center gap-2 ml-4 pl-4 border-l border-slate-700">
      <a href="/dashboard.html" class="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-900/50 rounded-md">
        Dashboard
      </a>
    </div>
  </div>
</header>
```

---

## 📊 Data Visualization

### Chart Colors (Chart.js compatible)
```javascript
const chartColors = {
  primary: 'rgb(14, 165, 233)',     // sky-500
  success: 'rgb(16, 185, 129)',     // emerald-500
  warning: 'rgb(251, 146, 60)',     // amber-400
  error: 'rgb(244, 63, 94)',        // rose-500
  info: 'rgb(56, 189, 248)',        // sky-400
  purple: 'rgb(168, 85, 247)'       // purple-500
};
```

### Chart Theme
```javascript
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#e2e8f0' } }  // slate-200
  },
  scales: {
    x: { 
      ticks: { color: '#94a3b8' },              // slate-400
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    },
    y: { 
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    }
  }
};
```

---

## 🎬 Animation & Transitions

### Standard Transitions
```css
/* Hover transitions */
transition: all 0.2s;

/* Background fade */
transition: background-color 0.2s ease-in-out;

/* Transform */
transition: transform 0.2s, box-shadow 0.2s;
```

### Loading Spinner
```html
<div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
```

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

## 🌐 Responsive Breakpoints

```css
/* Tailwind Breakpoints */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Responsive Patterns
```html
<!-- Hide on mobile, show on desktop -->
<div class="hidden lg:flex">Desktop only</div>

<!-- Stack on mobile, grid on desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>

<!-- Responsive padding -->
<div class="px-4 sm:px-6 lg:px-8"></div>
```

---

## ✅ Accessibility

### Color Contrast
- All text meets WCAG AA standards (4.5:1 minimum)
- Primary text on dark background: `#f1f5f9` on `#020617` = 16:1
- Links/interactive elements clearly distinguishable

### Focus States
```css
/* Standard focus ring */
focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:ring-offset-2 focus:ring-offset-slate-950

/* Button focus */
focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50
```

### ARIA Labels
```html
<!-- Icon-only buttons -->
<button aria-label="Close modal">
  <i data-lucide="x" class="w-4 h-4"></i>
</button>

<!-- Loading states -->
<div role="status" aria-live="polite">
  <span class="sr-only">Loading...</span>
  <div class="spinner"></div>
</div>
```

---

## 🛠 Implementation Checklist

When creating new pages/components:

- [ ] Use slate-950 as main background
- [ ] Use slate-800 borders with 80% opacity
- [ ] Use sky-500/600 for primary actions
- [ ] Include Lucide icons and call `lucide.createIcons()`
- [ ] Follow spacing scale (gap-4, p-5, etc.)
- [ ] Use consistent typography (text-sm, font-semibold, etc.)
- [ ] Add hover states to interactive elements
- [ ] Include loading/disabled states for buttons
- [ ] Test responsive breakpoints (mobile, tablet, desktop)
- [ ] Verify color contrast ratios
- [ ] Add appropriate ARIA labels

---

## 📦 Dependencies

```json
{
  "cdn": {
    "tailwind": "https://cdn.tailwindcss.com",
    "lucide": "https://unpkg.com/lucide@latest/dist/umd/lucide.js",
    "chartjs": "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
  },
  "fonts": {
    "inter": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    "geist": "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap",
    "jetbrains-mono": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
  }
}
```

---

## 🔄 Version History

**v1.0** (November 2024)
- Initial design system release
- Unified Dashboard, Studio, Cognitive Universe, Settings
- Dynamic View component patterns
- Complete color palette and typography scale

---

**Maintained by:** AgentCache Design Team  
**Contact:** For questions or contributions, open an issue in the repository
