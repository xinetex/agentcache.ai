// lib/run-authz.js
//
// AgentCache — Run authorization: ownership, identifier hygiene, and signed
// one-shot approval tokens.
//
// This module closes the control plane's worst hole. Before it,
// /api/agent/approve and /cancel authenticated the CALLER (any valid ac_ key)
// but never authorized the OBJECT (the run). Any customer could approve, reject
// or kill any other customer's paused agent by guessing a runId — a cross-tenant
// kill switch on the one endpoint whose entire job is to stop money being spent.
//
// Three primitives, all PURE or WebCrypto-only (edge-safe, no node:crypto):
//
//   checkRunOwnership / assertRunOwnership — the run belongs to the calling org, or deny.
//   isValidRunId  — runIds are interpolated into Inngest CEL match expressions;
//                   an unvalidated quote there breaks or WIDENS the match.
//   signApprovalToken / verifyApprovalToken — HMAC-SHA256, single-decision,
//                   expiring, org- and step-bound. This is what makes a Slack
//                   "Approve" BUTTON safe: a plain GET link with no API key
//                   would otherwise be an unauthenticated kill switch for
//                   anyone who could see the channel.

const enc = new TextEncoder();

// --- Identifier hygiene ---------------------------------------------------
// Deliberately strict: alphanumerics, dash, underscore. No quotes, no dots, no
// spaces — nothing that can escape a CEL string literal or forge a log line.
const RUN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidRunId(runId) {
  return typeof runId === 'string' && RUN_ID_RE.test(runId);
}

/** Throws (err.status = 400) unless the runId is safe to interpolate. */
export function assertValidRunId(runId) {
  if (!isValidRunId(runId)) {
    const err = new Error('Invalid runId: expected 8-64 chars of [A-Za-z0-9_-]');
    err.status = 400;
    throw err;
  }
  return runId;
}

// --- Ownership ------------------------------------------------------------
// `row` is the background_agent_runs record (or null/undefined if unknown).
//
// Fail CLOSED on an unknown run. A missing row must never be a bypass: if we
// cannot prove the run belongs to the caller, we do not act on it. This is the
// deliberate opposite of the telemetry path (which fails open) — telemetry
// losing a row costs a number, authz losing a row costs a tenant.
export function checkRunOwnership(row, organizationId) {
  if (!organizationId) return { ok: false, status: 401, reason: 'no organization context' };
  if (!row) return { ok: false, status: 404, reason: 'run not found' };
  const owner = row.organization_id ?? row.organizationId ?? null;
  if (!owner) return { ok: false, status: 403, reason: 'run has no owner recorded' };
  if (String(owner) !== String(organizationId)) {
    return { ok: false, status: 403, reason: 'run belongs to another organization' };
  }
  return { ok: true, status: 200, organizationId: String(owner) };
}

/** Loader-injected form. deps = { sql }. Never throws on DB error — denies. */
export async function assertRunOwnership(deps, runId, organizationId) {
  const { sql } = deps || {};
  assertValidRunId(runId);
  if (typeof sql !== 'function') {
    // No database configured: we cannot prove ownership, so we refuse rather
    // than silently granting cross-tenant control.
    return { ok: false, status: 503, reason: 'run ownership store unavailable' };
  }
  let rows = [];
  try {
    rows = await sql`SELECT run_id, organization_id, status FROM background_agent_runs WHERE run_id = ${runId} LIMIT 1`;
  } catch {
    return { ok: false, status: 503, reason: 'ownership lookup failed' };
  }
  const res = checkRunOwnership(rows && rows[0], organizationId);
  return res.ok ? { ...res, run: rows[0] } : res;
}

// --- Signed approval tokens ----------------------------------------------
// A token authorizes exactly ONE decision, on ONE run, at ONE step, for ONE
// org, until it expires.

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Length-independent equality — no early return on first differing byte. */
export function timingSafeEqual(a, b) {
  const x = String(a), y = String(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length, 1);
  for (let i = 0; i < n; i++) {
    diff |= (x.charCodeAt(i % (x.length || 1)) || 0) ^ (y.charCodeAt(i % (y.length || 1)) || 0);
  }
  return diff === 0;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

export const APPROVAL_TOKEN_TTL_SEC = 7 * 24 * 3600; // matches the Inngest waitForEvent timeout

/**
 * @param {{runId:string, organizationId:string, step?:number, decision:'approve'|'reject', ttlSec?:number, nowSec?:number}} claims
 */
export async function signApprovalToken(secret, claims = {}) {
  if (!secret) throw new Error('HITL_SIGNING_KEY not configured');
  assertValidRunId(claims.runId);
  const decision = claims.decision === 'approve' ? 'approve' : 'reject';
  const nowSec = claims.nowSec ?? Math.floor(Date.now() / 1000);
  const payload = {
    r: claims.runId,
    o: String(claims.organizationId || ''),
    s: Number(claims.step || 0),
    d: decision,
    e: nowSec + (claims.ttlSec ?? APPROVAL_TOKEN_TTL_SEC),
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(secret, body);
  return `v1.${body}.${sig}`;
}

/** Returns {ok, claims?} — never throws; reasons stay coarse on purpose. */
export async function verifyApprovalToken(secret, token, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  try {
    if (!secret) return { ok: false, reason: 'signing key not configured' };
    if (typeof token !== 'string') return { ok: false, reason: 'malformed token' };
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'malformed token' };
    const [, body, sig] = parts;
    const expected = await hmac(secret, body);
    if (!timingSafeEqual(sig, expected)) return { ok: false, reason: 'bad signature' };
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (!isValidRunId(payload.r)) return { ok: false, reason: 'malformed token' };
    if (typeof payload.e !== 'number' || payload.e <= nowSec) return { ok: false, reason: 'token expired' };
    return {
      ok: true,
      claims: {
        runId: payload.r,
        organizationId: payload.o,
        step: payload.s,
        decision: payload.d === 'approve' ? 'approve' : 'reject',
        expiresAt: payload.e,
      },
    };
  } catch {
    return { ok: false, reason: 'malformed token' };
  }
}

export default {
  isValidRunId, assertValidRunId, checkRunOwnership, assertRunOwnership,
  signApprovalToken, verifyApprovalToken, timingSafeEqual, APPROVAL_TOKEN_TTL_SEC,
};
