const base = process.argv[2];

if (!base) {
  console.error('Usage: node scripts/preview-first-run-check.mjs <preview-url>');
  process.exit(1);
}

const email = `codex-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const password = 'PreviewPass123X';
const fullName = 'Codex Preview';

async function jsonFetch(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    return {
      status: response.status,
      ok: response.ok,
      body,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error?.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const result = { base, email };

  result.signup = await jsonFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
    }),
  });

  const token = result.signup.body?.token;
  if (!token) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const authHeaders = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  result.me = await jsonFetch('/api/auth/me', {
    headers: authHeaders,
  });

  result.dashboardBefore = await jsonFetch('/api/portal/dashboard', {
    headers: authHeaders,
  });

  result.onboarding = await jsonFetch('/api/onboarding/complete', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sector: 'finance',
      useCase: 'Preview validation for first cache success',
      priority: 'balanced',
      namespaceStrategy: 'auto',
      scale: 'single_tenant',
      planTier: 'starter',
      organization: {
        name: 'Codex Preview Workspace',
        contact_email: email,
        contact_name: fullName,
        sector: 'finance',
        plan_tier: 'starter',
      },
    }),
  });

  result.dashboardAfter = await jsonFetch('/api/portal/dashboard', {
    headers: authHeaders,
  });

  result.portalKey = await jsonFetch('/api/portal/keys', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Preview Validation Key',
    }),
  });

  const apiKey = result.portalKey.body?.secret || result.onboarding.body?.apiKey;

  if (apiKey) {
    const cacheHeaders = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    };

    result.cacheSet = await jsonFetch('/api/cache/set', {
      method: 'POST',
      headers: cacheHeaders,
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Preview validation prompt' }],
        response: 'Preview validation response',
        ttl: 120,
        semantic: false,
        sector: 'finance',
      }),
    }, 35000);

    result.cacheGet = await jsonFetch('/api/cache/get', {
      method: 'POST',
      headers: cacheHeaders,
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Preview validation prompt' }],
        semantic: false,
        sector: 'finance',
      }),
    }, 35000);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
