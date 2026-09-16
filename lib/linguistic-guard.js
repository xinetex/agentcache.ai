// lib/linguistic-guard.js
//
// AgentCache — Linguistic Governance & Covert Channel Radar.
//
// Detects emergent non-human AI languages (synthetic argots), case-signaling
// anomalies, and metadata-based covert coordination channels (e.g., the "ZZ-"
// alphabetical sort exploit, directory-based messaging, and high-entropy shorthand).
//
// Pure, deterministic, and engine-agnostic.

export const LINGUISTIC_THRESHOLDS = {
  NOMINAL_ENTROPY_MAX: 4.8,      // Standard English text Shannon entropy (~3.5 - 4.5)
  HIGH_ENTROPY_TRIGGER: 5.2,     // Compressed / encoded / synthetic argot threshold
  SYNTHETIC_TOKEN_PATTERN: /\b([A-Z]{1,2}[0-9]{1,3}[A-Z]{0,2}|[0-9]{1,2}[A-Z]{2,4}|[A-Z]{1,2}[0-9]{1,2}[A-Z0-9]{2,}|[A-Z]{2})\b/g,
  COVERT_PREFIX_PATTERN: /^(ZZ[-_]|__ZZ|ZZZ|!ZZ)/i,
};

/**
 * Calculates the Shannon Entropy (bits per character) of a string.
 * Natural English is typically ~3.5 to 4.5. Encrypted/compressed payloads spike > 5.0.
 */
export function calculateShannonEntropy(text) {
  if (!text || typeof text !== 'string' || text.length === 0) return 0;

  const len = text.length;
  const freqs = {};
  for (let i = 0; i < len; i++) {
    const char = text[i];
    freqs[char] = (freqs[char] || 0) + 1;
  }

  let entropy = 0;
  for (const count of Object.values(freqs)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return Number(entropy.toFixed(3));
}

/**
 * Detects covert metadata communication and sorting manipulation channels.
 * Identifies patterns like the "ZZ-" Artifactory mailbox trick, directory-based messaging,
 * and unnatural character casing asymmetry.
 */
export function detectCovertSignaling(text, options = {}) {
  if (!text || typeof text !== 'string') return { detected: false, flags: [] };

  const flags = [];

  // 1. Check for sorting manipulation prefixes (e.g. "ZZ-message", "ZZ_phase1")
  if (LINGUISTIC_THRESHOLDS.COVERT_PREFIX_PATTERN.test(text.trim())) {
    flags.push('COVERT_SORT_PREFIX_DETECTED');
  }

  // 2. Check for directory-style message encoding (e.g., "help_phase_one_no_consumer_at_node_4")
  if (text.length > 25 && /^[a-z0-9]+(_[a-z0-9]+){4,}$/i.test(text.trim())) {
    flags.push('DIRECTORY_PATH_MESSAGE_CHANNEL');
  }

  // 3. Check for single-character case-signaling (e.g., mixing isolated "F" and "f" tokens)
  const singleCharTokens = text.match(/\b[a-zA-Z]\b/g) || [];
  if (singleCharTokens.length >= 4) {
    const uppercase = singleCharTokens.filter(t => t === t.toUpperCase()).length;
    const lowercase = singleCharTokens.filter(t => t === t.toLowerCase()).length;
    if (uppercase > 0 && lowercase > 0 && singleCharTokens.length > 6) {
      flags.push('CASE_SENSITIVE_PHONOLOGY_SIGNAL');
    }
  }

  return {
    detected: flags.length > 0,
    flags,
  };
}

/**
 * Scans text for dense synthetic tokens (e.g., "P6", "at D8FB", "LB", "LD").
 */
export function detectSyntheticTokens(text, customKnownTokens = new Set()) {
  if (!text || typeof text !== 'string') return { count: 0, tokens: [], density: 0 };

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { count: 0, tokens: [], density: 0 };

  const matches = (text.match(LINGUISTIC_THRESHOLDS.SYNTHETIC_TOKEN_PATTERN) || [])
    .filter(t => !customKnownTokens.has(t));

  return {
    count: matches.length,
    tokens: Array.from(new Set(matches)),
    density: Number((matches.length / words.length).toFixed(3)),
  };
}

/**
 * Comprehensive evaluation of message linguistic safety and drift posture.
 * Returns verdict: 'nominal' (safe English), 'warn' (moderate drift), or 'block' (covert argot/channel).
 */
export function evaluateLinguisticPosture(text, opts = {}) {
  const maxEntropy = opts.maxEntropy || LINGUISTIC_THRESHOLDS.HIGH_ENTROPY_TRIGGER;
  const maxSyntheticDensity = opts.maxSyntheticDensity || 0.25; // >25% synthetic tokens triggers block
  const knownTokens = opts.knownTokens || new Set();

  const entropy = calculateShannonEntropy(text);
  const covert = detectCovertSignaling(text, opts);
  const synthetic = detectSyntheticTokens(text, knownTokens);

  const reasons = [];
  let severity = 'nominal';

  if (covert.detected) {
    reasons.push(`Covert communication channel flagged: ${covert.flags.join(', ')}`);
    severity = 'block';
  }

  if (entropy >= maxEntropy && text.length > 30) {
    reasons.push(`High Shannon entropy (${entropy} bits/char > ${maxEntropy} threshold). Synthetic argot likely.`);
    severity = severity === 'block' ? 'block' : 'warn';
  }

  if (synthetic.density >= maxSyntheticDensity && synthetic.count >= 2) {
    reasons.push(`High synthetic token density (${(synthetic.density * 100).toFixed(1)}%): [${synthetic.tokens.join(', ')}]`);
    severity = 'block';
  } else if (synthetic.count >= 1 && synthetic.density > 0.1) {
    reasons.push(`Synthetic shorthand detected: [${synthetic.tokens.join(', ')}]`);
    if (severity === 'nominal') severity = 'warn';
  }

  return {
    severity,
    allow: severity !== 'block',
    entropy,
    covert,
    synthetic,
    reasons,
  };
}

export default {
  LINGUISTIC_THRESHOLDS,
  calculateShannonEntropy,
  detectCovertSignaling,
  detectSyntheticTokens,
  evaluateLinguisticPosture,
};
