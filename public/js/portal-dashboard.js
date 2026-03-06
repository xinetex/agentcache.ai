(function () {
  const state = {
    me: null,
    dashboard: null,
    pipelines: [],
    latestApiKeySecret: null,
    pipelineError: null,
  };

  function readStoredJson(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getToken() {
    return window.localStorage.getItem('agentcache_token');
  }

  function clearAuth() {
    window.localStorage.removeItem('agentcache_token');
    window.localStorage.removeItem('agentcache_user');
    window.localStorage.removeItem('agentcache_workspace');
  }

  function redirectToLogin() {
    clearAuth();
    const next = encodeURIComponent('/portal-dashboard.html');
    window.location.href = `/login.html?next=${next}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function titleCase(value) {
    return String(value || 'General')
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function humanizePlan(plan) {
    const value = String(plan || 'free').toLowerCase();
    const planMap = {
      starter: 'Free',
      free: 'Free',
      pro: 'Pro',
      professional: 'Pro',
      enterprise: 'Enterprise',
    };

    return planMap[value] || titleCase(value);
  }

  function getInitials(name, email) {
    const source = String(name || email || 'AC').trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function formatCompactNumber(value) {
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
      return 'Unknown date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatRelativeDate(value) {
    if (!value) {
      return 'Never used';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    const deltaMs = date.getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const minutes = Math.round(deltaMs / 60000);

    if (Math.abs(minutes) < 60) {
      return rtf.format(minutes, 'minute');
    }

    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return rtf.format(hours, 'hour');
    }

    const days = Math.round(hours / 24);
    return rtf.format(days, 'day');
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

  function showAlert(message, type) {
    const alert = document.getElementById('dashboard-alert');
    if (!alert) {
      return;
    }

    const palette = {
      info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
      success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
      warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      error: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    };

    alert.className = `rounded-2xl border px-4 py-3 text-sm ${palette[type] || palette.info}`;
    alert.textContent = message;
    alert.classList.remove('hidden');
  }

  function hideAlert() {
    const alert = document.getElementById('dashboard-alert');
    if (alert) {
      alert.classList.add('hidden');
      alert.textContent = '';
    }
  }

  async function copyToClipboard(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      showAlert(successMessage, 'success');
    } catch (error) {
      showAlert('Clipboard access failed. Copy manually from the panel.', 'warning');
    }
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

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }
    } else {
      try {
        payload = await response.text();
      } catch (error) {
        payload = null;
      }
    }

    if (response.status === 401 || response.status === 403) {
      showAlert('Your portal session expired. Redirecting to login...', 'warning');
      window.setTimeout(redirectToLogin, 900);
      return null;
    }

    if (response.status === 409 && payload && payload.onboardingRequired) {
      window.location.href = payload.onboardingUrl || '/onboarding.html';
      return null;
    }

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function getWorkspace() {
    const storedUser = readStoredJson('agentcache_user');
    const storedWorkspace = readStoredJson('agentcache_workspace');
    const apiUser = state.me && state.me.user ? state.me.user : null;
    const dashboardOrg = state.dashboard && state.dashboard.organization ? state.dashboard.organization : null;
    const apiOrg = apiUser && apiUser.organization ? apiUser.organization : null;

    return {
      user: apiUser || storedUser || null,
      organization: dashboardOrg || apiOrg || storedWorkspace || null,
    };
  }

  function updateWorkspaceHeader() {
    const workspace = getWorkspace();
    const user = workspace.user;
    const organization = workspace.organization;

    const userName = user && (user.full_name || user.name) ? user.full_name || user.name : 'Workspace User';
    const userEmail = user && user.email ? user.email : 'No email available';
    const organizationName = organization && organization.name ? organization.name : 'AgentCache workspace';
    const sector = titleCase(organization && (organization.sector || organization.industry));
    const plan = humanizePlan(
      organization && (organization.planTier || organization.plan_tier || organization.plan)
    );
    const namespaceCount = state.dashboard && Array.isArray(state.dashboard.namespaces)
      ? state.dashboard.namespaces.length
      : Array.isArray(organization && organization.namespaces)
        ? organization.namespaces.length
        : 0;
    const apiKeyCount = state.dashboard && Array.isArray(state.dashboard.apiKeys)
      ? state.dashboard.apiKeys.length
      : organization && organization.api_keys_count
        ? Number(organization.api_keys_count)
        : 0;

    setText('sidebar-user-avatar', getInitials(userName, userEmail));
    setText('sidebar-user-name', userName);
    setText('sidebar-user-email', userEmail);
    setText('organization-sector', sector);
    setText('organization-plan-badge', plan);
    setText('workspace-summary-name', organizationName);
    setText(
      'workspace-summary-meta',
      `${plan} plan · ${sector} · ${namespaceCount} namespace${namespaceCount === 1 ? '' : 's'}`
    );

    const subtitle = organization
      ? `${organizationName} on the ${plan} plan with ${namespaceCount} namespace${namespaceCount === 1 ? '' : 's'} and ${apiKeyCount} API key${apiKeyCount === 1 ? '' : 's'}.`
      : 'Finish onboarding to activate namespaces, keys, and starter pipelines.';

    setText('organization-subtitle', subtitle);

    if (organization && organization.createdAt) {
      document.title = `${organizationName} | AgentCache`;
    }
  }

  function updateMetricStatus(hitRate) {
    const badge = document.getElementById('metric-hit-rate-status');
    if (!badge) {
      return;
    }

    let label = 'Warming up';
    let className = 'rounded-full border px-2.5 py-1 text-[0.72rem] font-medium ';

    if (hitRate >= 85) {
      label = 'Optimal';
      className += 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    } else if (hitRate >= 60) {
      label = 'Healthy';
      className += 'border-sky-500/30 bg-sky-500/10 text-sky-200';
    } else if (hitRate > 0) {
      label = 'Needs tuning';
      className += 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    } else {
      className += 'border-slate-700 bg-slate-900 text-slate-300';
    }

    badge.className = className;
    badge.textContent = label;
  }

  function updateMetrics() {
    const metrics = state.dashboard ? state.dashboard.metrics || {} : {};
    const totalRequests = Number(metrics.totalRequests || 0);
    const cacheHits = Number(metrics.cacheHits || 0);
    const cacheMisses = Number(metrics.cacheMisses || 0);
    const hitRate = Number(metrics.hitRate || 0);
    const costSavings = Number(metrics.costSavings || 0);
    const bandwidthSaved = metrics.bandwidthSaved || '0.00 GB';

    setText('metric-total-requests', formatCompactNumber(totalRequests));
    setText(
      'metric-total-requests-subtext',
      totalRequests > 0
        ? `${formatInteger(cacheHits)} cache hits recorded in the last 24 hours`
        : 'No cache traffic recorded yet'
    );
    setText('metric-requests-meta-label', 'Cache hits');
    setText('metric-requests-meta-value', formatInteger(cacheHits));

    setText('metric-hit-rate', totalRequests > 0 ? `${hitRate}%` : '--');
    setText(
      'metric-hit-rate-subtext',
      totalRequests > 0
        ? `${formatInteger(cacheHits)} hits out of ${formatInteger(totalRequests)} total requests`
        : 'Traffic will appear after your first cache call'
    );
    setText('metric-hit-rate-meta-label', 'Cache misses');
    setText('metric-hit-rate-meta-value', formatInteger(cacheMisses));

    setText('metric-cost-savings', formatCurrency(costSavings));
    setText(
      'metric-cost-savings-subtext',
      costSavings > 0
        ? 'Estimated savings from repeated responses served from cache'
        : 'Savings grow once repeated prompts start hitting the cache'
    );
    setText('metric-cost-savings-meta-label', 'Bandwidth saved');
    setText('metric-cost-savings-meta-value', bandwidthSaved);
    setText('savings-badge-value', formatCurrency(costSavings));

    updateMetricStatus(hitRate);
  }

  function renderNamespaces() {
    const namespaces = state.dashboard && Array.isArray(state.dashboard.namespaces)
      ? state.dashboard.namespaces
      : [];

    setText(
      'namespace-summary',
      namespaces.length > 0
        ? `Use these namespaces to separate workloads, environments, or customers.`
        : 'No namespaces provisioned yet.'
    );
    setText('namespace-count', String(namespaces.length));

    if (namespaces.length === 0) {
      setHtml(
        'namespace-list',
        '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">Your workspace will receive a default namespace during onboarding.</div>'
      );
      return;
    }

    const markup = namespaces
      .map((namespace) => {
        const createdAt = formatDate(namespace.created_at || namespace.createdAt);
        const name = escapeHtml(namespace.name);
        const displayName = escapeHtml(namespace.display_name || namespace.name);
        const metadata = Array.isArray(namespace.sector_nodes) && namespace.sector_nodes.length > 0
          ? `${namespace.sector_nodes.length} sector nodes`
          : 'Ready for cache traffic';

        return `
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-slate-100">${displayName}</span>
                ${namespace.name === 'default'
                  ? '<span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-medium text-emerald-200">Primary</span>'
                  : ''}
              </div>
              <div class="mt-1 text-xs text-slate-500">${escapeHtml(metadata)} · Created ${createdAt}</div>
            </div>
            <code class="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-sky-100">${name}</code>
          </div>
        `;
      })
      .join('');

    setHtml('namespace-list', markup);
  }

  function buildQuickstartSnippet() {
    const namespaces = state.dashboard && Array.isArray(state.dashboard.namespaces)
      ? state.dashboard.namespaces
      : [];
    const namespaceName = namespaces.length > 0 ? namespaces[0].name : 'default';
    const apiKey = state.latestApiKeySecret || 'YOUR_API_KEY';
    const baseUrl = window.location.origin;

    return [
      `curl -X POST "${baseUrl}/api/cache/set" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "X-API-Key: ${apiKey}" \\`,
      `  -H "X-Cache-Namespace: ${namespaceName}" \\`,
      `  -d '{`,
      `    "provider": "openai",`,
      `    "model": "gpt-4o-mini",`,
      `    "messages": [{"role":"user","content":"What is 2+2?"}],`,
      `    "response": "4"`,
      `  }'`,
    ].join('\n');
  }

  function renderApiKeys() {
    const apiKeys = state.dashboard && Array.isArray(state.dashboard.apiKeys)
      ? state.dashboard.apiKeys
      : [];

    setText(
      'api-key-summary',
      apiKeys.length > 0
        ? 'Preview existing keys below or issue a fresh secret for immediate use.'
        : 'No visible keys yet. Generate one to start sending cache requests.'
    );

    if (apiKeys.length === 0) {
      setHtml(
        'api-key-list',
        '<div class="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">No API keys found for this workspace.</div>'
      );
    } else {
      const markup = apiKeys
        .map((key) => {
          const preview = escapeHtml(key.preview || 'hidden');
          const name = escapeHtml(key.name || 'API Key');
          const requests = formatInteger(key.requestCount || 0);
          const lastUsed = key.lastUsedAt ? formatRelativeDate(key.lastUsedAt) : 'Never used';
          const statusTone = key.isActive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            : 'border-slate-700 bg-slate-900 text-slate-400';
          const statusLabel = key.isActive ? 'Active' : 'Inactive';

          return `
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-100">${name}</span>
                  <span class="rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${statusTone}">${statusLabel}</span>
                </div>
                <div class="mt-1 text-xs text-slate-500">${requests} requests · ${escapeHtml(lastUsed)}</div>
              </div>
              <code class="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-sky-100">${preview}</code>
            </div>
          `;
        })
        .join('');

      setHtml('api-key-list', markup);
    }

    setText('quickstart-snippet', buildQuickstartSnippet());
  }

  function getPipelineStatusTone(status) {
    const value = String(status || 'draft').toLowerCase();

    if (value === 'active') {
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    }
    if (value === 'paused') {
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    }

    return 'border-slate-700 bg-slate-900 text-slate-300';
  }

  function getPipelineHealthTone(hitRate) {
    if (hitRate >= 85) {
      return 'text-emerald-200';
    }
    if (hitRate >= 60) {
      return 'text-sky-200';
    }
    if (hitRate > 0) {
      return 'text-amber-200';
    }

    return 'text-slate-400';
  }

  function renderPipelines() {
    const container = document.getElementById('pipeline-list');
    if (!container) {
      return;
    }

    if (state.pipelineError) {
      container.innerHTML = `
        <div class="px-5 py-6 text-sm text-slate-400">
          Pipeline data is not available yet. ${escapeHtml(state.pipelineError)}
        </div>
      `;
      return;
    }

    if (!state.pipelines || state.pipelines.length === 0) {
      container.innerHTML = `
        <div class="px-5 py-6 text-sm text-slate-400">
          Your starter pipeline will appear here after onboarding finishes provisioning.
        </div>
      `;
      return;
    }

    const copy = state.pipelines.length === 1
      ? '1 pipeline currently attached to this workspace.'
      : `${state.pipelines.length} pipelines currently attached to this workspace.`;
    setText('recent-pipelines-copy', copy);

    container.innerHTML = state.pipelines
      .slice(0, 6)
      .map((pipeline) => {
        const metrics = pipeline.metrics24h || {};
        const requests = Number(metrics.requests || 0);
        const hitRate = Number(metrics.hitRate || 0);
        const savings = Number(metrics.costSaved || 0);
        const description = escapeHtml(pipeline.description || 'No description provided');
        const name = escapeHtml(pipeline.name || 'Untitled pipeline');
        const sector = escapeHtml(titleCase(pipeline.sector || 'general'));
        const status = escapeHtml(titleCase(pipeline.status || 'draft'));
        const statusTone = getPipelineStatusTone(pipeline.status);
        const hitRateTone = getPipelineHealthTone(hitRate);

        return `
          <a href="/pipelines.html" class="block px-5 py-4 transition hover:bg-slate-900/60">
            <div class="grid gap-3 md:grid-cols-12 md:items-center">
              <div class="md:col-span-5">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-100">${name}</span>
                  <span class="rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${statusTone}">${status}</span>
                </div>
                <div class="mt-1 text-sm text-slate-500">${description}</div>
              </div>
              <div class="md:col-span-2">
                <span class="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[0.72rem] font-medium text-slate-300">${sector}</span>
              </div>
              <div class="text-sm text-slate-200 md:col-span-2">${formatInteger(requests)}</div>
              <div class="text-sm font-medium md:col-span-1 ${hitRateTone}">${requests > 0 ? `${hitRate}%` : '--'}</div>
              <div class="text-right text-sm font-medium text-slate-100 md:col-span-2">${formatCurrency(savings)}</div>
            </div>
          </a>
        `;
      })
      .join('');
  }

  function persistUserData() {
    if (state.me && state.me.user) {
      window.localStorage.setItem('agentcache_user', JSON.stringify(state.me.user));
      if (state.me.user.organization) {
        window.localStorage.setItem('agentcache_workspace', JSON.stringify(state.me.user.organization));
      }
    }
  }

  function render() {
    persistUserData();
    updateWorkspaceHeader();
    updateMetrics();
    renderNamespaces();
    renderApiKeys();
    renderPipelines();
  }

  async function refreshDashboard() {
    const refreshButton = document.getElementById('refresh-dashboard-button');
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.classList.add('opacity-70');
    }

    state.pipelineError = null;
    hideAlert();

    const [meResult, dashboardResult, pipelineResult] = await Promise.allSettled([
      fetchJson('/api/auth/me'),
      fetchJson('/api/portal/dashboard'),
      fetchJson('/api/pipelines/list?limit=6'),
    ]);
    const hasPrimaryLoadError = meResult.status === 'rejected' || dashboardResult.status === 'rejected';

    if (meResult.status === 'fulfilled' && meResult.value) {
      state.me = meResult.value;
    } else if (meResult.status === 'rejected') {
      showAlert(`Could not load user profile: ${meResult.reason.message}`, 'warning');
    }

    if (dashboardResult.status === 'fulfilled' && dashboardResult.value) {
      state.dashboard = dashboardResult.value;
    } else if (dashboardResult.status === 'rejected') {
      showAlert(`Could not load workspace dashboard: ${dashboardResult.reason.message}`, 'error');
    }

    if (pipelineResult.status === 'fulfilled' && pipelineResult.value) {
      state.pipelines = Array.isArray(pipelineResult.value.pipelines) ? pipelineResult.value.pipelines : [];
    } else if (pipelineResult.status === 'rejected') {
      state.pipelineError = pipelineResult.reason.message;
    }

    render();

    const apiKeys = state.dashboard && Array.isArray(state.dashboard.apiKeys) ? state.dashboard.apiKeys : [];
    const namespaces = state.dashboard && Array.isArray(state.dashboard.namespaces) ? state.dashboard.namespaces : [];

    if (!hasPrimaryLoadError && apiKeys.length === 0) {
      showAlert('No API keys are visible for this workspace yet. Generate one below to make your first cache call.', 'info');
    } else if (!hasPrimaryLoadError && namespaces.length > 0 && !state.latestApiKeySecret) {
      showAlert('Use the starter request below with one of your existing keys, or generate a fresh secret if you need a new credential.', 'info');
    }

    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.classList.remove('opacity-70');
    }
  }

  async function generateApiKey() {
    const button = document.getElementById('generate-api-key-button');
    if (!button) {
      return;
    }

    button.disabled = true;
    button.classList.add('opacity-70');

    try {
      const payload = await fetchJson('/api/portal/keys', {
        method: 'POST',
      });

      if (!payload) {
        return;
      }

      state.latestApiKeySecret = payload.secret || null;
      setText('new-api-key-message', payload.message || 'Copy this secret now. It will not be shown again.');
      setText('new-api-key-secret', payload.secret || '');
      document.getElementById('new-api-key-panel').classList.remove('hidden');

      await refreshDashboard();
      showAlert('New API key generated. Copy it now and run the starter request.', 'success');
    } catch (error) {
      showAlert(`Could not generate API key: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.classList.remove('opacity-70');
    }
  }

  function attachEventHandlers() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        redirectToLogin();
      });
    }

    const refreshButton = document.getElementById('refresh-dashboard-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        refreshDashboard();
      });
    }

    const generateButton = document.getElementById('generate-api-key-button');
    if (generateButton) {
      generateButton.addEventListener('click', () => {
        generateApiKey();
      });
    }

    const copyKeyButton = document.getElementById('copy-new-api-key-button');
    if (copyKeyButton) {
      copyKeyButton.addEventListener('click', () => {
        const secret = document.getElementById('new-api-key-secret').textContent || '';
        if (!secret) {
          showAlert('Generate a new key first.', 'warning');
          return;
        }

        copyToClipboard(secret, 'API key copied to clipboard.');
      });
    }

    const copyCurlButton = document.getElementById('copy-curl-button');
    if (copyCurlButton) {
      copyCurlButton.addEventListener('click', () => {
        const snippet = document.getElementById('quickstart-snippet').textContent || '';
        copyToClipboard(snippet, 'Starter request copied to clipboard.');
      });
    }
  }

  attachEventHandlers();
  refreshDashboard();
})();
