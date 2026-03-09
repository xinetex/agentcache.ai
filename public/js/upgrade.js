(function () {
  const PLAN_DETAILS = {
    pro: {
      name: 'Pro',
      monthlyPrice: 99,
      yearlyPrice: 990,
      copy: 'Production-ready request volume, private namespaces, and enough room for a small team.',
      features: [
        '1M cache requests each month',
        '10 namespaces and 10 API keys',
        'Priority support and analytics',
        'Best fit for the first production deployment',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      monthlyPrice: 299,
      yearlyPrice: 2990,
      copy: 'Large-scale request volume plus Guardrails and Knowledge packaged into one workspace plan.',
      features: [
        '10M cache requests each month',
        '100 namespaces and 100 API keys',
        'Guardrails and Knowledge included',
        'Dedicated support and procurement-ready billing',
      ],
    },
  };

  const PLAN_ORDER = {
    free: 0,
    starter: 0,
    pro: 1,
    professional: 1,
    enterprise: 2,
  };

  const state = {
    billing: null,
    selectedPlan: 'pro',
    billingPeriod: 'monthly',
    pending: false,
  };

  function getToken() {
    return window.localStorage.getItem('agentcache_token');
  }

  function redirectToLogin() {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `/login.html?next=${next}`;
  }

  function getQuery() {
    return new URLSearchParams(window.location.search);
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
    const element = document.getElementById('upgrade-alert');
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
    const element = document.getElementById('upgrade-alert');
    if (!element) {
      return;
    }

    element.classList.add('hidden');
    element.textContent = '';
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function formatCompact(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
      notation: amount >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: amount >= 10000 ? 1 : 0,
    }).format(amount);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Number(value || 0) >= 100 ? 0 : 2,
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) {
      return 'Unknown';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function normalizePublicPlan(plan) {
    const value = String(plan || 'free').toLowerCase();
    if (value === 'starter') {
      return 'free';
    }
    if (value === 'professional') {
      return 'pro';
    }
    return value;
  }

  function planRank(plan) {
    return PLAN_ORDER[normalizePublicPlan(plan)] ?? 0;
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
      error.upgradeUrl = payload?.upgradeUrl;
      throw error;
    }

    return payload;
  }

  function syncQueryWithPlan() {
    const url = new URL(window.location.href);
    url.searchParams.set('plan', state.selectedPlan);
    window.history.replaceState({}, '', url);
  }

  function updateChoiceButtons() {
    const planButtons = [
      { id: 'plan-select-pro', plan: 'pro' },
      { id: 'plan-select-enterprise', plan: 'enterprise' },
    ];
    const billingButtons = [
      { id: 'billing-period-monthly', period: 'monthly' },
      { id: 'billing-period-yearly', period: 'yearly' },
    ];

    planButtons.forEach(({ id, plan }) => {
      const button = document.getElementById(id);
      if (!button) {
        return;
      }

      const selected = state.selectedPlan === plan;
      button.className = selected
        ? 'rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition'
        : 'rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900';
    });

    billingButtons.forEach(({ id, period }) => {
      const button = document.getElementById(id);
      if (!button) {
        return;
      }

      const selected = state.billingPeriod === period;
      button.className = selected
        ? 'rounded-full border border-sky-300/40 bg-slate-950/80 px-3 py-1.5 text-sm font-medium text-sky-100 transition'
        : 'rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-950/50';
    });
  }

  function resolveRecommendedPlan() {
    const recommended = state.billing?.recommendations?.upgradeTarget?.publicId;
    return recommended && PLAN_DETAILS[recommended] ? recommended : 'pro';
  }

  function applyInitialSelection() {
    const queryPlan = normalizePublicPlan(getQuery().get('plan'));
    if (PLAN_DETAILS[queryPlan]) {
      state.selectedPlan = queryPlan;
      return;
    }

    state.selectedPlan = resolveRecommendedPlan();
  }

  function renderCurrentWorkspace() {
    const billing = state.billing;
    if (!billing) {
      return;
    }

    const currentPlan = normalizePublicPlan(billing.subscription?.publicPlan || billing.subscription?.plan);
    const displayPlan = billing.subscription?.displayPlan || PLAN_DETAILS[currentPlan]?.name || 'Free';
    const usage = billing.usage || {};
    const resources = billing.resources || {};

    setText('current-plan-badge', displayPlan);
    setText('current-plan-name', displayPlan);
    setText(
      'current-plan-copy',
      `${billing.organization?.name || 'This workspace'} is using ${formatCompact(usage.requestsThisMonth)} of ${formatCompact(usage.quota)} included requests this month.`
    );
    setText(
      'current-plan-usage',
      `${formatCompact(usage.requestsThisMonth)} / ${formatCompact(usage.quota)} requests`
    );
    setText(
      'current-plan-limits',
      `${resources.namespaces?.used || 0}/${resources.namespaces?.limit || 0} namespaces · ${resources.apiKeys?.used || 0}/${resources.apiKeys?.limit || 0} API keys`
    );
  }

  function renderUsagePressure() {
    const usage = state.billing?.usage || {};
    const resources = state.billing?.resources || {};
    const cycle = state.billing?.billingCycle || {};
    const percent = Number(usage.percentUsed || 0);
    const remaining = Number(usage.remaining || 0);

    setText(
      'usage-progress-copy',
      `${formatCompact(remaining)} requests remaining before this workspace hits its current quota.`
    );
    setText('usage-progress-percent', `${percent}%`);
    setText(
      'billing-cycle-copy',
      `Cycle runs through ${formatDate(cycle.end)}. ${cycle.daysRemaining || 0} day${cycle.daysRemaining === 1 ? '' : 's'} remaining in the current month.`
    );

    const progressBar = document.getElementById('usage-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.max(percent, percent > 0 ? 8 : 0)}%`;
    }

    setText('namespace-usage', `${resources.namespaces?.used || 0} / ${resources.namespaces?.limit || 0}`);
    setText('api-key-usage', `${resources.apiKeys?.used || 0} / ${resources.apiKeys?.limit || 0}`);
    setText('user-usage', `${resources.users?.used || 0} / ${resources.users?.limit || 0}`);
    setText('pipeline-usage', `${resources.pipelines?.used || 0}`);
  }

  function renderTargetPlan() {
    const currentPlan = normalizePublicPlan(
      state.billing?.subscription?.publicPlan || state.billing?.subscription?.plan
    );
    const details = PLAN_DETAILS[state.selectedPlan];
    const price = state.billingPeriod === 'yearly' ? details.yearlyPrice : details.monthlyPrice;
    const label = state.billingPeriod === 'yearly' ? 'per year' : 'per month';
    const button = document.getElementById('target-plan-button');
    const alreadyPaid = Boolean(state.billing?.subscription?.stripeSubscriptionId);
    const recommendation = state.billing?.recommendations?.upgradeTarget?.publicId || null;

    setText('target-plan-name', details.name);
    setText('target-plan-price', formatCurrency(price));
    setText('target-plan-price-copy', label);
    setText('target-plan-copy', details.copy);
    setHtml(
      'target-plan-features',
      details.features
        .map((feature) => (
          `<li class="flex items-start gap-3"><span class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-200"></span><span>${feature}</span></li>`
        ))
        .join('')
    );

    if (button) {
      if (state.pending) {
        button.disabled = true;
        button.textContent = 'Routing to billing...';
        button.classList.add('opacity-70');
      } else {
        button.disabled = false;
        button.classList.remove('opacity-70');

        if (planRank(currentPlan) >= planRank(state.selectedPlan)) {
          button.textContent = alreadyPaid ? 'Manage current billing' : 'Return to workspace';
        } else if (alreadyPaid) {
          button.textContent = 'Continue in Stripe billing';
        } else {
          button.textContent = 'Continue to secure checkout';
        }
      }
    }

    const metaLines = [];
    if (recommendation === state.selectedPlan) {
      metaLines.push(`Recommended next plan for this workspace: ${details.name}.`);
    }
    if (alreadyPaid && planRank(currentPlan) < planRank(state.selectedPlan)) {
      metaLines.push('This workspace already has a Stripe subscription, so billing changes route into the Stripe customer portal.');
    }
    if (planRank(currentPlan) >= planRank(state.selectedPlan)) {
      metaLines.push(`This workspace is already on ${state.billing.subscription.displayPlan} or higher.`);
    }

    setText(
      'target-plan-meta',
      metaLines[0] || 'Stripe checkout will attach this upgrade to your current workspace.'
    );
  }

  function render() {
    updateChoiceButtons();
    renderCurrentWorkspace();
    renderUsagePressure();
    renderTargetPlan();
  }

  function handleBannerState() {
    const billingState = getQuery().get('billing');

    if (billingState === 'success') {
      showAlert('Billing update confirmed. Stripe may take a few moments to sync the refreshed workspace limits.', 'success');
      return;
    }

    if (billingState === 'cancel') {
      showAlert('Checkout was canceled. The workspace plan has not changed.', 'warning');
      return;
    }

    if (billingState === 'demo') {
      showAlert('Stripe is not configured in this environment. The upgrade UI is wired, but checkout is running in demo mode.', 'info');
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

    const currentPlan = normalizePublicPlan(payload.subscription?.publicPlan || payload.subscription?.plan);
    if (planRank(currentPlan) > planRank(state.selectedPlan)) {
      state.selectedPlan = currentPlan;
    }

    syncQueryWithPlan();
    render();
    handleBannerState();
  }

  async function startCheckout() {
    if (!state.billing || state.pending) {
      return;
    }

    const currentPlan = normalizePublicPlan(
      state.billing.subscription?.publicPlan || state.billing.subscription?.plan
    );

    if (planRank(currentPlan) >= planRank(state.selectedPlan)) {
      if (state.billing.subscription?.stripeSubscriptionId) {
        state.pending = true;
        render();

        try {
          const payload = await fetchJson('/api/billing/portal', {
            method: 'POST',
          });

          if (payload?.portalUrl) {
            window.location.href = payload.portalUrl;
            return;
          }

          throw new Error(payload?.error || 'Could not open billing portal');
        } catch (error) {
          showAlert(error.message, 'error');
        } finally {
          state.pending = false;
          render();
        }
      } else {
        window.location.href = '/portal-dashboard.html';
      }
      return;
    }

    state.pending = true;
    render();

    try {
      const payload = await fetchJson('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan: state.selectedPlan,
          billingPeriod: state.billingPeriod,
        }),
      });

      if (!payload) {
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      throw new Error(payload.error || 'Failed to create checkout session');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      state.pending = false;
      render();
    }
  }

  function attachHandlers() {
    const selectPro = document.getElementById('plan-select-pro');
    const selectEnterprise = document.getElementById('plan-select-enterprise');
    const monthly = document.getElementById('billing-period-monthly');
    const yearly = document.getElementById('billing-period-yearly');
    const checkoutButton = document.getElementById('target-plan-button');

    if (selectPro) {
      selectPro.addEventListener('click', () => {
        state.selectedPlan = 'pro';
        syncQueryWithPlan();
        render();
      });
    }

    if (selectEnterprise) {
      selectEnterprise.addEventListener('click', () => {
        state.selectedPlan = 'enterprise';
        syncQueryWithPlan();
        render();
      });
    }

    if (monthly) {
      monthly.addEventListener('click', () => {
        state.billingPeriod = 'monthly';
        render();
      });
    }

    if (yearly) {
      yearly.addEventListener('click', () => {
        state.billingPeriod = 'yearly';
        render();
      });
    }

    if (checkoutButton) {
      checkoutButton.addEventListener('click', () => {
        startCheckout();
      });
    }
  }

  if (!getToken()) {
    redirectToLogin();
  } else {
    attachHandlers();
    loadBillingState().catch((error) => {
      showAlert(`Could not load billing details: ${error.message}`, 'error');
    });
  }
})();
