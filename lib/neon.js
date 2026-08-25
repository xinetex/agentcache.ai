// lib/neon.js
//
// Single, hardened source of the Neon HTTP client. A suspended or unreachable
// Neon compute must NEVER hold a serverless invocation open to its 25s ceiling.
//
// Root cause this fixes: control-plane endpoints fired ensureXSchema(sql) at
// module load — an un-awaited, un-cancellable fetch. On a cold start hitting a
// slow/suspended Neon, that pending fetch kept the whole invocation alive until
// the 25s function timeout, so even the unauthenticated 401 path timed out
// (/api/governance/status, /api/analytics/savings in the runtime error log).
//
// Fix: install a global fetchFunction that hard-aborts every Neon query after
// NEON_FETCH_TIMEOUT_MS via AbortController. An abort surfaces as an ordinary
// rejection, which the DB helpers already fail-open on — a dead DB degrades to
// empty/zero instead of hanging. Importing this module (directly, or
// transitively through lib/api-key-middleware.js) installs the timeout for the
// entire function process.

import { neon, neonConfig } from '@neondatabase/serverless';

const NEON_FETCH_TIMEOUT_MS = Number(process.env.NEON_FETCH_TIMEOUT_MS || 6000);

// Global: bound every Neon HTTP request with a real AbortController timeout.
neonConfig.fetchFunction = (input, init = {}) => {
  const ac = new AbortController();
  const timer = setTimeout(
    () => ac.abort(new Error('neon fetch timeout after ' + NEON_FETCH_TIMEOUT_MS + 'ms')),
    NEON_FETCH_TIMEOUT_MS
  );
  return fetch(input, { ...init, signal: init.signal || ac.signal }).finally(() => clearTimeout(timer));
};

// Bounded sql client. A missing DATABASE_URL yields a stub that rejects fast, so
// nothing throws at import and nothing hangs at call time.
export function makeSql(url = process.env.DATABASE_URL) {
  if (!url) {
    const stub = async () => { throw new Error('DATABASE_URL is not set'); };
    return Object.assign(stub, { query: stub, unsafe: stub, transaction: stub });
  }
  return neon(url);
}

// Race a promise against a wall-clock cap. With a fallback arg, resolves to it
// on timeout; otherwise rejects. Belt-and-suspenders around the global fetch
// timeout for callers that want a hard per-operation ceiling.
export function withTimeout(promise, ms, ...rest) {
  const hasFallback = rest.length > 0;
  const fallback = rest[0];
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      if (hasFallback) resolve(fallback);
      else reject(new Error('operation timed out after ' + ms + 'ms'));
    }, ms);
    Promise.resolve(promise).then(
      (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      (e) => { if (!done) { done = true; clearTimeout(t); reject(e); } }
    );
  });
}

export const sql = makeSql();
export { neon, neonConfig };
export default sql;
