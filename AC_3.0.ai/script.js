/* AgentCache.ai — Interactive JS */
(function () {
  'use strict';

  /* ─── THEME TOGGLE ─── */
  (function () {
    const html = document.documentElement;
    const btn = document.querySelector('[data-theme-toggle]');
    let theme = html.getAttribute('data-theme') || 
                (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    function applyTheme(t) {
      theme = t;
      html.setAttribute('data-theme', t);
      if (btn) {
        btn.innerHTML = t === 'dark'
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }
    
    applyTheme(theme);
    if (btn) btn.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));
  })();

  /* ─── TICKER ANIMATION ─── */
  (function () {
    const el = document.getElementById('tickerA');
    if (!el) return;
    const chars = ['────', '═══', '▓▓▒░', '////'];
    let i = 0;
    setInterval(() => {
      el.textContent = chars[i % chars.length];
      i++;
    }, 800);
  })();

  /* ─── LIVE CLOCK (last event) ─── */
  (function () {
    const el = document.getElementById('lastEvent');
    if (!el) return;
    let secs = 3;
    setInterval(() => {
      secs++;
      if (secs >= 120) secs = 1;
      if (secs < 60) {
        el.textContent = secs + 's AGO';
      } else {
        el.textContent = Math.floor(secs / 60) + 'm AGO';
      }
    }, 1000);
  })();

  /* ─── FEATURE PANEL TABS ─── */
  (function () {
    const tabs = document.querySelectorAll('.pdl-tab');
    const panels = document.querySelectorAll('.pdl-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.panel;

        tabs.forEach(t => {
          t.classList.remove('pdl-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach(p => {
          p.classList.remove('pdl-panel-active');
          p.hidden = true;
        });

        tab.classList.add('pdl-tab-active');
        tab.setAttribute('aria-selected', 'true');

        const panel = document.getElementById('panel-' + target);
        if (panel) {
          panel.classList.add('pdl-panel-active');
          panel.hidden = false;
          panel.style.animation = 'none';
          panel.offsetHeight; // reflow
          panel.style.animation = 'panel-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both';
        }
      });
    });
  })();

  /* ─── MOCKUP SIDE TABS ─── */
  (function () {
    const tabs = document.querySelectorAll('.st-tab');
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('st-active'));
        tab.classList.add('st-active');
      });
    });
  })();

  /* ─── HUD TOGGLES ─── */
  (function () {
    document.querySelectorAll('.hud-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('hud-toggle-on');
        // respect cyan class
      });
    });
  })();

  /* ─── WAITLIST FORM ─── */
  (function () {
    const form = document.querySelector('.cta-form');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('.cta-input');
      const btn = form.querySelector('button[type="submit"]');
      if (!input || !input.value.includes('@')) {
        input && (input.style.borderColor = 'var(--c-orange)');
        return;
      }
      btn.textContent = 'ACCESS QUEUED ✓';
      btn.style.background = 'var(--c-green)';
      btn.style.boxShadow = '0 0 16px rgba(0,255,136,0.3)';
      input.value = '';
      setTimeout(() => {
        btn.textContent = 'INITIALIZE ACCESS';
        btn.style.background = '';
        btn.style.boxShadow = '';
      }, 3000);
    });
  })();

  /* ─── ANIMATED PROGRESS BAR (hero mockup) ─── */
  (function () {
    const bar = document.querySelector('.ar-bar:not(.ar-bar-idle):not(.ar-bar-done)');
    if (!bar) return;
    let pct = 72;
    setInterval(() => {
      if (pct >= 100) pct = 0;
      else pct += Math.random() * 2;
      const v = Math.min(100, pct).toFixed(0);
      bar.style.setProperty('--w', v + '%');
      const pctEl = bar.closest('.agent-row')?.querySelector('.ar-pct');
      if (pctEl) pctEl.textContent = v + '%';
    }, 1200);
  })();

  /* ─── NAV ACTIVE LINK ─── */
  (function () {
    const sections = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.nav-link');
    if (!sections.length || !links.length) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.style.color = '');
          const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
          if (active) active.style.color = 'var(--c-orange)';
        }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });

    sections.forEach(s => obs.observe(s));
  })();

})();

/* Panel slide-in keyframe (injected dynamically) */
const style = document.createElement('style');
style.textContent = `
  @keyframes panel-slide-in {
    from { opacity: 0; clip-path: inset(8px 8px 8px 8px); }
    to   { opacity: 1; clip-path: inset(0 0 0 0); }
  }
`;
document.head.appendChild(style);
