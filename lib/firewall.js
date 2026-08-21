// lib/firewall.js
//
// AgentCache — Agent Capability Firewall.
//
// The LLM is a NON-DETERMINISTIC PLANNER. It proposes actions. It never
// executes them directly. Every proposed action passes through this
// deterministic policy enforcement point, which decides allow / deny /
// escalate BEFORE the action reaches any API, shell, DB, payment rail, or
// comms channel. No "safety prompt" — authority lives in code the model
// cannot talk its way past.
//
// The checks, in order (first failure decides):
//   1. Credential   — intent-bound grant valid, unexpired, not over max-uses
//   2. Capability   — action is in the grant's allowlist
//   3. Scope        — target is within the grant's declared mission scope
//   4. Third party  — action touching another principal → escalate unless allowed
//   5. Two-key      — irreversible / financial / destructive → needs 2nd approval
//   6. Blast radius — budget caps (calls, money, emails, records…) not exceeded
//   7. Consent      — consequential actions require explicit user consent
//
// Pure + dependency-free (node:crypto only). Every decision is logged for replay.

import { createHmac, timingSafeEqual } from 'node:crypto';

// --- Action registry: how an action is classified. App-specific actions can
// be passed via opts.registry; UNKNOWN actions are treated as maximally
// dangerous (fail closed). ---
export const DEFAULT_REGISTRY = {
  'read':        { write: false, reversible: true,  thirdParty: false, financial: false, consequential: false },
  'search':      { write: false, reversible: true,  thirdParty: false, financial: false, consequential: false },
  'book':        { write: true,  reversible: true,  thirdParty: false, financial: false, consequential: true  },
  'cancel':      { write: true,  reversible: false, thirdParty: true,  financial: false, consequential: true  },
  'modify':      { write: true,  reversible: false, thirdParty: true,  financial: false, consequential: true  },
  'pay':         { write: true,  reversible: false, thirdParty: true,  financial: true,  consequential: true  },
  'refund':      { write: true,  reversible: false, thirdParty: true,  financial: true,  consequential: true  },
  'email.send':  { write: true,  reversible: false, thirdParty: true,  financial: false, consequential: true  },
  'file.write':  { write: true,  reversible: false, thirdParty: false, financial: false, consequential: true  },
  'shell.exec':  { write: true,  reversible: false, thirdParty: false, financial: false, consequential: true, dangerous: true },
};

const UNKNOWN_ACTION = { write: true, reversible: false, thirdParty: true, financial: true, consequential: true, dangerous: true };

function classify(action, registry) {
  return (registry && registry[action]) || DEFAULT_REGISTRY[action] || UNKNOWN_ACTION;
}

// ---------------------------------------------------------------------------
// Intent-bound credentials — a short-lived, single-mission signed token.
// "Book one class for user U, within these dates, max one reservation." It
// cannot cancel, transfer, enumerate others, change billing, or be reused.
// ---------------------------------------------------------------------------

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
function sign(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('hex');
}

// grantSpec: { agentId, taskId, allowedActions:[{action, scope?}], budget:{},
//   expiresAt (ms epoch), maxUses?, thirdPartyAllowed?, requireTwoKeyFor?:[...] }
export function mintGrant(secret, grantSpec) {
  if (!secret) throw new Error('mintGrant requires a secret');
  const grant = {
    v: 1,
    agentId: grantSpec.agentId,
    taskId: grantSpec.taskId,
    allowedActions: grantSpec.allowedActions || [],
    budget: grantSpec.budget || {},
    expiresAt: grantSpec.expiresAt,
    maxUses: grantSpec.maxUses ?? null,
    thirdPartyAllowed: !!grantSpec.thirdPartyAllowed,
    // Which action traits force a mandatory second approval.
    requireTwoKeyFor: grantSpec.requireTwoKeyFor || ['irreversible', 'financial', 'dangerous'],
    nonce: grantSpec.nonce || `${grantSpec.taskId}:${grantSpec.expiresAt}`,
  };
  const payloadB64 = b64url(JSON.stringify(grant));
  return { grant, token: `${payloadB64}.${sign(payloadB64, secret)}` };
}

export function verifyGrant(secret, token, now = Date.now()) {
  const dot = token.indexOf('.');
  if (dot < 0) throw new Error('malformed token');
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature');
  const grant = JSON.parse(fromB64url(payloadB64));
  if (grant.expiresAt && now > grant.expiresAt) throw new Error('grant expired');
  return grant;
}

// ---------------------------------------------------------------------------
// Blast-radius budget — hard caps. Crossing a cap FREEZES the grant rather
// than allowing "just one more step".
// ---------------------------------------------------------------------------
export class BudgetLedger {
  constructor(caps = {}) {
    this.caps = caps;          // e.g. { calls: 50, usd: 0, emails: 3, records: 1, uses: 1 }
    this.used = {};
    this.frozen = false;
  }
  canCharge(cost = {}) {
    if (this.frozen) return false;
    for (const k of Object.keys(cost)) {
      const cap = this.caps[k];
      if (cap === undefined) continue; // uncapped dimension
      if ((this.used[k] || 0) + cost[k] > cap) return false;
    }
    return true;
  }
  charge(cost = {}) {
    for (const k of Object.keys(cost)) this.used[k] = (this.used[k] || 0) + cost[k];
  }
  freeze() { this.frozen = true; }
  remaining() {
    const r = {};
    for (const k of Object.keys(this.caps)) r[k] = this.caps[k] - (this.used[k] || 0);
    return r;
  }
}

// ---------------------------------------------------------------------------
// Scope matcher — is the target within the grant's declared mission?
// scope example: { userId: 'U1', maxCount: 1, dateFrom: ..., dateTo: ... }
// ---------------------------------------------------------------------------
function checkScope(scope, proposal, ledger) {
  if (!scope) return { ok: true };
  const t = proposal.target || {};
  if (scope.userId != null && t.userId !== scope.userId) {
    return { ok: false, reason: `target user ${t.userId} outside scope (${scope.userId})` };
  }
  if (scope.dateFrom != null && t.date != null && t.date < scope.dateFrom) {
    return { ok: false, reason: `date ${t.date} before ${scope.dateFrom}` };
  }
  if (scope.dateTo != null && t.date != null && t.date > scope.dateTo) {
    return { ok: false, reason: `date ${t.date} after ${scope.dateTo}` };
  }
  if (scope.maxCount != null && ledger && (ledger.used.records || 0) >= scope.maxCount) {
    return { ok: false, reason: `maxCount ${scope.maxCount} reached` };
  }
  return { ok: true };
}

function twoKeyTraits(meta) {
  const t = [];
  if (!meta.reversible) t.push('irreversible');
  if (meta.financial) t.push('financial');
  if (meta.dangerous) t.push('dangerous');
  if (meta.thirdParty) t.push('third-party');
  return t;
}

// ---------------------------------------------------------------------------
// The firewall.
// ---------------------------------------------------------------------------
export class CapabilityFirewall {
  constructor(opts = {}) {
    this.registry = opts.registry || DEFAULT_REGISTRY;
    this.audit = [];
    this._seq = 0;
  }

  _log(entry) {
    const rec = { seq: ++this._seq, at: entry.now, ...entry };
    delete rec.now;
    this.audit.push(rec);
    return rec.seq;
  }

  // proposal: { action, target:{userId,date,...}, affectsPrincipals?:[ids],
  //             cost?:{calls,usd,...} }
  // ctx: { grant, ledger, consent?, secondApproval?, now? }
  authorize(proposal, ctx = {}) {
    const now = ctx.now ?? Date.now();
    const grant = ctx.grant;
    const ledger = ctx.ledger;
    const reasons = [];
    const deny = (code, msg) => {
      reasons.push(msg);
      const auditId = this._log({ now, action: proposal.action, target: proposal.target, decision: 'deny', code, reasons: [...reasons] });
      return { decision: 'deny', code, reasons: [...reasons], auditId, remaining: ledger?.remaining?.() };
    };
    const escalate = (code, msg) => {
      reasons.push(msg);
      const auditId = this._log({ now, action: proposal.action, target: proposal.target, decision: 'escalate', code, reasons: [...reasons] });
      return { decision: 'escalate', code, reasons: [...reasons], auditId, remaining: ledger?.remaining?.() };
    };

    // 1. Credential
    if (!grant) return deny('NO_GRANT', 'no capability grant presented');
    if (grant.expiresAt && now > grant.expiresAt) return deny('EXPIRED', 'grant expired');
    if (grant.maxUses != null && ledger && (ledger.used.uses || 0) >= grant.maxUses) {
      return deny('MAX_USES', 'grant max-uses reached');
    }
    if (ledger && ledger.frozen) return deny('FROZEN', 'grant frozen by blast-radius budget');

    // 2. Capability
    const granted = (grant.allowedActions || []).find((a) => a.action === proposal.action);
    if (!granted) return deny('CAP_NOT_GRANTED', `action "${proposal.action}" not in grant`);

    // 3. Scope
    const scope = checkScope(granted.scope, proposal, ledger);
    if (!scope.ok) return deny('OUT_OF_SCOPE', scope.reason);

    const meta = classify(proposal.action, this.registry);

    // 4. Third-party impact
    const others = (proposal.affectsPrincipals || []).filter((p) => p !== grant.agentId && p !== granted.scope?.userId);
    if ((meta.thirdParty || others.length > 0) && !grant.thirdPartyAllowed) {
      return escalate('THIRD_PARTY_IMPACT', `affects third party${others.length ? ' ' + others.join(',') : ''}`);
    }

    // 5. Two-key for consequential traits
    const traits = twoKeyTraits(meta);
    const needsTwoKey = traits.some((t) => grant.requireTwoKeyFor.includes(t));
    if (needsTwoKey && !ctx.secondApproval) {
      return escalate('NEEDS_SECOND_KEY', `traits [${traits.join(', ')}] require a second approval`);
    }

    // 6. Blast-radius budget
    const cost = { uses: 1, ...(proposal.cost || {}) };
    if (ledger && !ledger.canCharge(cost)) {
      ledger.freeze();
      return deny('BUDGET_EXCEEDED', `budget cap hit — grant frozen`);
    }

    // 7. Consent for consequential actions
    if (meta.consequential && !ctx.consent) {
      return escalate('NEEDS_CONSENT', 'consequential action requires explicit user consent');
    }

    // Allow — charge the budget and log.
    if (ledger) ledger.charge(cost);
    const auditId = this._log({ now, action: proposal.action, target: proposal.target, decision: 'allow', code: 'OK', reasons: ['authorized'] });
    return { decision: 'allow', code: 'OK', reasons: ['authorized'], auditId, remaining: ledger?.remaining?.() };
  }

  // Replayable forensic log.
  replay() {
    return this.audit.map((e) => ({ seq: e.seq, action: e.action, decision: e.decision, code: e.code }));
  }
}
