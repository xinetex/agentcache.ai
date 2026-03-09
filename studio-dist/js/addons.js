(function () {
  const ADDONS = {
    guardrails: {
      id: 'guardrails',
      name: 'Guardrails',
      monthlyPrice: 99,
      yearlyPrice: 990,
      description: 'Policy-safe execution with prompt injection, secret leakage, and compliance checks before agent actions run.',
      highlights: [
        'PII, secret, and policy scanning',
        'Prompt injection and jailbreak detection',
        'Safety control ahead of tool execution',
      ],
    },
    knowledge: {
      id: 'knowledge',
      name: 'Knowledge',
      monthlyPrice: 99,
      yearlyPrice: 990,
      description: 'Workspace docs memory with ingest, chunking, and semantic search for retrieval-driven agent workflows.',
      highlights: [
        'Docs ingest and chunking pipeline',
        'Semantic search across uploaded knowledge',
        'Reusable retrieval context for agent memory',
      ],
    },
  };

  const PLAN_LABELS = {
    free: 'Free',
    starter: 'Free',
    pro: 'Pro',
    professional: 'Pro',
    enterprise: 'Enterprise',
  };

  const state = {
    billing: null,
    selectedAddon: 'guardrails',
    billingPeriod: 'monthly',
    pending: false,
  };

  function getQuery() {
    return new URLSearchParams(window.location.search);
  }

  function getToken() {
    return window.localStorage.getItem('agentcache_token');
  }

  function redirectToLogin() {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `/login.html?next=${next}`;
  }

  function normalizePlan(plan) {
    return PLAN_LABELS[String(plan || 'free').toLowerCase()] || 'Free';
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = value;
    }
  }

  function showAlert(message, tone) {
    const element = document.getElementById('addon-alert');
    if (!element) {
      return;
    }

    const palette = {
      info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
      success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
      warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      error: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    };

    element.className = `rounded-2xl border px-4 py-3 text-sm ${palette[tone] || palette.info}`;
    element.textContent = message;
    element.classList.remove('hidden');
  }

  function clearAlert() {
    const element = document.getElementById('addon-alert');
    if (!element) {
      return;
    }

    element.classList.add('hidden');
    element.textContent = '';
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Number(value || 0) >= 100 ? 0 : 2,
    }).format(Number(value || 0));
  }

  async function fetchJson(url, options) {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return null;
    }

    const headers = new Headers((options && options.headers) || {});
    headers.set('Authorization', `Bearer ${token}`);

    if (options && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...(options || {}),
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (response.status === 401 || response.status === 403) {
      redirectToLogin();
      return null;
    }

    if (response.status === 409 && payload?.onboardingRequired) {
      window.location.href = payload.onboardingUrl || '/onboarding.html';
      return null;
    }

    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function getSelectedAddonState() {
    return state.billing?.addons?.find((addon) => addon.id === state.selectedAddon) || null;
  }

  function syncQuery() {
    const url = new URL(window.location.href);
    url.searchParams.set('addon', state.selectedAddon);
    window.history.replaceState({}, '', url);
  }

  function applyInitialSelection() {
    const queryAddon = String(getQuery().get('addon') || '').toLowerCase();
    if (ADDONS[queryAddon]) {
      state.selectedAddon = queryAddon;
    }
  }

  function updateChoiceButtons() {
    const addonButtons = [
      { id: 'addon-select-guardrails', addon: 'guardrails' },
      { id: 'addon-select-knowledge', addon: 'knowledge' },
    ];
    const billingButtons = [
      { id: 'addon-billing-monthly', period: 'monthly' },
      { id: 'addon-billing-yearly', period: 'yearly' },
    ];

    addonButtons.forEach(({ id, addon }) => {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }

      const selected = state.selectedAddon === addon;
      element.className = selected
        ? 'rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition'
        : 'rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900';
    });

    billingButtons.forEach(({ id, period }) => {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }

      const selected = state.billingPeriod === period;
      element.className = selected
        ? 'rounded-full border border-sky-300/40 bg-slate-950/80 px-3 py-1.5 text-sm font-medium text-sky-100 transition'
        : 'rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-950/50';
    });
  }

  function renderAddonList() {
    const container = document.getElementById('addon-status-list');
    if (!container) {
      return;
    }

    const addons = state.billing?.addons || [];
    if (addons.length === 0) {
      container.innerHTML = `
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
          No add-on state is available for this workspace.
        </div>
      `;
      return;
    }

    container.innerHTML = addons.map((addon) => {
      const label = addon.included
        ? 'Included'
        : addon.active
          ? 'Active'
          : addon.upgradeRequired
            ? 'Upgrade required'
            : 'Available';
      const tone = addon.included
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : addon.active
          ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
          : addon.upgradeRequired
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            : 'border-slate-700 bg-slate-900 text-slate-300';

      return `
        <button
          type="button"
          data-addon-select="${addon.id}"
          class="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-slate-100">${addon.name}</div>
              <div class="mt-1 text-sm text-slate-400">${addon.description}</div>
            </div>
            <span class="rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${tone}">${label}</span>
          </div>
        </button>
      `;
    }).join('');

    container.querySelectorAll('[data-addon-select]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedAddon = button.getAttribute('data-addon-select') || 'guardrails';
        syncQuery();
        render();
      });
    });
  }

  function renderWorkspaceState() {
    const addonState = getSelectedAddonState();
    const subscription = state.billing?.subscription || {};
    const organization = state.billing?.organization || {};
    const addonDefinition = ADDONS[state.selectedAddon];

    setText('addon-current-plan', normalizePlan(subscription.publicPlan || subscription.plan));
    setText('addon-workspace-name', organization.name || 'Workspace');
    setText(
      'addon-workspace-copy',
      organization.name
        ? `${organization.name} can activate add-ons independently of its core cache plan.`
        : 'Workspace details are loading.'
    );

    if (!addonState) {
      setText('addon-current-status', 'Loading...');
      setText('addon-current-status-copy', 'Add-on activation state is loading.');
      return;
    }

    const statusLabel = addonState.included
      ? 'Included in plan'
      : addonState.active
        ? 'Active'
        : addonState.upgradeRequired
          ? 'Upgrade required'
          : 'Available to activate';

    setText('addon-current-status', statusLabel);
    setText(
      'addon-current-status-copy',
      addonState.usageSummary || `${addonDefinition.name} is ready for this workspace.`
    );
  }

  function renderSelectedAddon() {
    const addonDefinition = ADDONS[state.selectedAddon];
    const addonState = getSelectedAddonState();
    const button = document.getElementById('addon-action-button');

    setText('addon-hero-title', `Activate ${addonDefinition.name} for this workspace.`);
    setText('addon-hero-copy', addonDefinition.description);
    setText('addon-name', addonDefinition.name);
    setText(
      'addon-price',
      formatCurrency(state.billingPeriod === 'yearly' ? addonDefinition.yearlyPrice : addonDefinition.monthlyPrice)
    );
    setText('addon-price-copy', state.billingPeriod === 'yearly' ? 'per year' : 'per month');
    setText('addon-description', addonDefinition.description);
    setHtml(
      'addon-highlights',
      addonDefinition.highlights
        .map((highlight) => (
          `<li class="flex items-start gap-3"><span class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-200"></span><span>${highlight}</span></li>`
        ))
        .join('')
    );

    if (!addonState || !button) {
      return;
    }

    let buttonText = 'Continue to secure checkout';
    let meta = 'Stripe checkout will attach this add-on to your current workspace.';

    if (state.pending) {
      buttonText = 'Routing to billing...';
      button.disabled = true;
      button.classList.add('opacity-70');
    } else {
      button.disabled = false;
      button.classList.remove('opacity-70');

      if (addonState.included) {
        buttonText = 'Included in Enterprise';
        meta = `${addonDefinition.name} is already included in the current workspace plan.`;
      } else if (addonState.active) {
        buttonText = 'Manage billing';
        meta = `${addonDefinition.name} is active for this workspace.`;
      } else if (addonState.upgradeRequired) {
        buttonText = 'Upgrade to Pro first';
        meta = `${addonDefinition.name} requires a Pro or Enterprise workspace before activation.`;
      }
    }

    button.textContent = buttonText;
    setText('addon-meta', meta);
  }

  function render() {
    updateChoiceButtons();
    renderAddonList();
    renderWorkspaceState();
    renderSelectedAddon();
  }

  function handleBannerState() {
    const billingState = getQuery().get('billing');

    if (billingState === 'success') {
      showAlert('Add-on billing update confirmed. Stripe may take a few moments to sync the workspace state.', 'success');
      return;
    }

    if (billingState === 'cancel') {
      showAlert('Checkout was canceled. The workspace add-on state has not changed.', 'warning');
      return;
    }

    if (billingState === 'demo') {
      showAlert('Stripe is not configured in this environment. The add-on checkout flow is running in demo mode.', 'info');
      return;
    }

    clearAlert();
  }

  async function loadBillingState() {
    const payload = await fetchJson('/api/billing/usage');
    if (!payload) {
      return;
    }

    state.billing = payload;
    applyInitialSelection();
    syncQuery();
    render();
    handleBannerState();
  }

  async function openBillingPortal() {
    const payload = await fetchJson('/api/billing/portal', { method: 'POST' });
    if (payload?.portalUrl) {
      window.location.href = payload.portalUrl;
      return;
    }

    throw new Error(payload?.error || 'Could not open billing portal');
  }

  async function startCheckout() {
    if (!state.billing || state.pending) {
      return;
    }

    const addonState = getSelectedAddonState();
    if (!addonState) {
      return;
    }

    if (addonState.included) {
      window.location.href = '/portal-dashboard.html';
      return;
    }

    if (addonState.active) {
      state.pending = true;
      render();

      try {
        await openBillingPortal();
      } catch (error) {
        showAlert(error.message, 'error');
      } finally {
        state.pending = false;
        render();
      }
      return;
    }

    if (addonState.upgradeRequired) {
      window.location.href = addonState.upgradeUrl || '/upgrade.html?plan=pro';
      return;
    }

    state.pending = true;
    render();

    try {
      const payload = await fetchJson('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          addonId: state.selectedAddon,
          billingPeriod: state.billingPeriod,
        }),
      });

      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      throw new Error(payload?.error || 'Failed to create add-on checkout');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      state.pending = false;
      render();
    }
  }

  function attachHandlers() {
    document.getElementById('addon-select-guardrails')?.addEventListener('click', () => {
      state.selectedAddon = 'guardrails';
      syncQuery();
      render();
    });

    document.getElementById('addon-select-knowledge')?.addEventListener('click', () => {
      state.selectedAddon = 'knowledge';
      syncQuery();
      render();
    });

    document.getElementById('addon-billing-monthly')?.addEventListener('click', () => {
      state.billingPeriod = 'monthly';
      render();
    });

    document.getElementById('addon-billing-yearly')?.addEventListener('click', () => {
      state.billingPeriod = 'yearly';
      render();
    });

    document.getElementById('addon-action-button')?.addEventListener('click', () => {
      startCheckout();
    });
  }

  if (!getToken()) {
    redirectToLogin();
  } else {
    attachHandlers();
    loadBillingState().catch((error) => {
      showAlert(`Could not load add-on billing: ${error.message}`, 'error');
    });
  }
})();
