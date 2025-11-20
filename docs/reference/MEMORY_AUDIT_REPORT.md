# AgentCache.ai Memory Leak Audit Report
**Date**: 2025-11-17  
**Status**: ⚠️ 1 Memory Leak Found + 3 Performance Issues

---

## 🔴 Critical Issues

### 1. **Memory Leak: Canvas Animation Not Cleaned Up**
**Location**: `/public/index.html` (lines 1057-1081)  
**Severity**: HIGH  
**Impact**: Continuous memory growth on homepage

**Problem**:
```javascript
let animationId = null;
function animate() {
  // ... animation logic ...
  animationId = requestAnimationFrame(animate);
}
animate(); // Never stops!
```

The particle animation on the homepage runs indefinitely using `requestAnimationFrame()` but is **never cancelled** when the user navigates away or the page is hidden. This causes:
- Continuous CPU usage even when tab is not visible
- Memory accumulation from canvas operations
- Battery drain on mobile devices

**Fix**:
```javascript
// Add Page Visibility API to pause animation
let animationId = null;
let isPaused = false;

function animate() {
  if (isPaused) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  // ... rest of animation ...
  animationId = requestAnimationFrame(animate);
}

// Pause when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isPaused = true;
    if (animationId) cancelAnimationFrame(animationId);
  } else {
    isPaused = false;
    animate();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (animationId) cancelAnimationFrame(animationId);
  particles = [];
});

animate();
```

---

## 🟡 Performance Issues

### 2. **Aggressive Polling: Dashboard Refresh Every 30 Seconds**
**Location**: `/public/dashboard-new.html` (line 236)  
**Severity**: MEDIUM  
**Impact**: Unnecessary API calls, quota burn

**Problem**:
```javascript
setInterval(loadDashboard, 30000); // Polls every 30s forever
```

The dashboard polls the API every 30 seconds, even when:
- User switches tabs (continues in background)
- User is idle (wastes quota)
- Stats haven't changed

**Fix**:
```javascript
let refreshInterval = null;

function startPolling() {
  refreshInterval = setInterval(() => {
    if (!document.hidden) { // Only refresh if visible
      loadDashboard();
    }
  }, 60000); // Reduce to 60s
}

// Pause polling when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (refreshInterval) clearInterval(refreshInterval);
  } else {
    loadDashboard(); // Refresh immediately when returning
    startPolling();
  }
});

startPolling();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});
```

---

### 3. **IntersectionObserver Leaks**
**Location**: `/public/index.html` (lines 1149-1210)  
**Severity**: LOW  
**Impact**: Observers not disconnected

**Problem**:
```javascript
const observer = new IntersectionObserver((entries) => {
  // ... animation logic ...
}, observerOptions);

document.querySelectorAll('section').forEach(section => {
  observer.observe(section);
});
// Never calls observer.disconnect()
```

Multiple `IntersectionObserver` instances created but never cleaned up. While browsers usually handle this, it's best practice to disconnect.

**Fix**:
```javascript
// Store observer reference globally
let sectionObserver = null;

document.addEventListener('DOMContentLoaded', () => {
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        
        // Animate numbers...
        
        // Disconnect after first intersection (one-time animation)
        sectionObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe all sections
  document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    sectionObserver.observe(section);
  });
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (sectionObserver) sectionObserver.disconnect();
});
```

---

### 4. **Code Typing Animation Creates Multiple Timers**
**Location**: `/public/index.html` (lines 1184-1210)  
**Severity**: LOW  
**Impact**: Multiple `setTimeout` chains not cancelled

**Problem**:
```javascript
codeBlocks.forEach(block => {
  const typeChar = () => {
    if (charIndex < originalText.length) {
      block.textContent += originalText.charAt(charIndex);
      charIndex++;
      setTimeout(typeChar, 2); // Recursive setTimeout
    }
  };
  setTimeout(typeChar, 300);
});
```

Recursive `setTimeout` calls are used for typing animation but never explicitly cancelled. If user navigates away mid-animation, the chain continues.

**Fix**:
```javascript
const typingTimers = [];

codeBlocks.forEach(block => {
  let timerId = null;
  const originalText = block.textContent;
  block.textContent = '';
  let charIndex = 0;
  
  const typeChar = () => {
    if (charIndex < originalText.length) {
      block.textContent += originalText.charAt(charIndex);
      charIndex++;
      timerId = setTimeout(typeChar, 2);
      typingTimers.push(timerId);
    }
  };
  
  // Start typing when visible
  const codeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        timerId = setTimeout(typeChar, 300);
        typingTimers.push(timerId);
        codeObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });
  
  codeObserver.observe(block.closest('pre'));
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  typingTimers.forEach(id => clearTimeout(id));
});
```

---

## ✅ No Issues Found (Good Practices)

### Redis Connection Handling
**All API endpoints** use **Upstash Redis REST API** via `fetch()`:
- ✅ No persistent connections (serverless-friendly)
- ✅ No connection pooling leaks
- ✅ Edge runtime compatible
- ✅ Auto-cleaned by Vercel after request

**Example** (`/api/cache.js`, `/api/v1/chat/completions.js`):
```javascript
async function redis(command, ...args) {
  const response = await fetch(`${UPSTASH_URL}/${command}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const data = await response.json();
  return data.result;
}
```

This is **perfect for edge functions** - no cleanup needed.

---

### Event Listeners
**Checked**:
- ✅ No global `addEventListener` leaks
- ✅ All listeners attached in `DOMContentLoaded` scope
- ✅ Single-page app, no dynamic route cleanup needed

---

### Fetch Calls
**Checked**:
- ✅ All `fetch()` calls properly awaited
- ✅ Error handling prevents hanging promises
- ✅ No unresolved promise chains

---

## 📊 Summary

| Issue | Severity | Fixed? | Priority |
|-------|----------|--------|----------|
| Canvas animation leak | HIGH | ❌ No | P0 |
| Dashboard polling | MEDIUM | ❌ No | P1 |
| IntersectionObserver cleanup | LOW | ❌ No | P2 |
| Typing animation timers | LOW | ❌ No | P3 |

---

## 🔧 Recommended Actions

### Immediate (P0)
1. **Fix canvas animation leak** in `/public/index.html`
   - Add Page Visibility API pause/resume
   - Cancel animation on tab switch

### Short-term (P1)
2. **Optimize dashboard polling** in `/public/dashboard-new.html`
   - Increase interval to 60s
   - Pause when tab hidden
   - Add manual refresh button

### Optional (P2-P3)
3. **Add cleanup handlers** for observers and timers
   - Mostly cosmetic, browsers handle these well
   - Good for production polish

---

## 🧪 Testing Recommendations

### Memory Leak Detection
```bash
# Chrome DevTools Memory Profiler
1. Open homepage (index.html)
2. Start memory recording
3. Let run for 5 minutes with tab hidden
4. Check if memory increases > 50MB
```

### Dashboard Performance
```bash
# Network panel
1. Open dashboard-new.html
2. Switch to another tab for 2 minutes
3. Check if API calls continue (should pause)
```

---

## 🚀 Deployment Notes

These fixes can be deployed incrementally:
1. Canvas fix first (biggest impact)
2. Dashboard polling next
3. Observer/timer cleanup when time permits

All fixes are **backwards compatible** and require **no API changes**.
