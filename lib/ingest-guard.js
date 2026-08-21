// lib/ingest-guard.js
//
// The governance gate for the Knowledge layer. "Publicly accessible" is not
// "safe to cache and re-serve" — so nothing enters the cache without passing:
//
//   1. LICENSE CHECK  — is redistribution actually permitted? (fail closed)
//   2. PII GATE        — scan for personal data; redact or block
//   3. PROVENANCE      — stamp every record with source, license, time, URL
//
// Pure and dependency-free so the policy is unit-testable and identical in the
// API, workers, and batch ingest. The rule everywhere: when in doubt, DON'T
// cache. Over-caching public data is how you get sued; under-caching just costs
// a re-fetch.

// What each license permits for re-serving cached content.
export const LICENSE_POLICY = {
  'public-domain': { redistribute: true, attribution: false, shareAlike: false },
  'cc0':           { redistribute: true, attribution: false, shareAlike: false },
  'cc-by':         { redistribute: true, attribution: true,  shareAlike: false },
  'cc-by-sa':      { redistribute: true, attribution: true,  shareAlike: true },
  'odbl':          { redistribute: true, attribution: true,  shareAlike: true },
  'restricted':    { redistribute: false, attribution: true,  shareAlike: false },
  'unknown':       { redistribute: false, attribution: true,  shareAlike: false },
};

export function policyFor(license) {
  return LICENSE_POLICY[license] || LICENSE_POLICY['unknown'];
}

// --- PII detection (conservative regex set) -------------------------------
// Not a full DLP engine — the goal is to catch the obvious identifiers and
// fail toward redaction. Extend per sector as needed.
const PII_PATTERNS = [
  { type: 'email',  re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { type: 'ssn',    re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'phone',  re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'ccard',  re: /\b(?:\d[ -]?){13,16}\b/g },
  { type: 'ip',     re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
];

export function detectPII(text) {
  const s = String(text || '');
  const found = [];
  for (const { type, re } of PII_PATTERNS) {
    re.lastIndex = 0;
    const m = s.match(re);
    if (m && m.length) found.push({ type, count: m.length });
  }
  return found;
}

export function redactPII(text) {
  let s = String(text || '');
  const found = [];
  for (const { type, re } of PII_PATTERNS) {
    re.lastIndex = 0;
    let count = 0;
    s = s.replace(re, () => { count++; return `[REDACTED:${type}]`; });
    if (count) found.push({ type, count });
  }
  return { redacted: s, found };
}

// The single decision function. Returns an action and always a provenance stamp.
//
//   source = a catalog entry (needs id, license; endpoint/name optional)
//   record = { id?, text }
//   opts   = { now?, allowRedactedRestricted? }
//
// action:
//   'skip'         — license forbids redistribution (fail closed)
//   'cache'        — clean + permitted; cache as-is
//   'redact-cache' — permitted but PII found; cache the redacted text
export function ingestRecord(source, record, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const license = source.license || 'unknown';
  const policy = policyFor(license);

  const provenance = {
    sourceId: source.id,
    sourceName: source.name || source.id,
    license,
    url: source.endpoint || null,
    recordId: record.id ?? null,
    retrievedAt: now,
  };

  // 1. License gate — fail closed.
  if (!policy.redistribute) {
    return {
      action: 'skip',
      reason: `license:${license}`,
      requireAttribution: policy.attribution,
      provenance,
    };
  }

  // 2. PII gate.
  const found = detectPII(record.text);
  if (found.length) {
    const { redacted } = redactPII(record.text);
    return {
      action: 'redact-cache',
      reason: 'pii-detected',
      text: redacted,
      piiFound: found,
      requireAttribution: policy.attribution,
      shareAlike: policy.shareAlike,
      provenance,
    };
  }

  // 3. Clean + permitted.
  return {
    action: 'cache',
    text: record.text,
    piiFound: [],
    requireAttribution: policy.attribution,
    shareAlike: policy.shareAlike,
    provenance,
  };
}
