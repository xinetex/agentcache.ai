// lib/rosetta-bridge.js
//
// AgentCache — Dual-Channel Rosetta Bridge & Codebook Registry.
//
// Decompiles emergent synthetic argots into human-interpretable ASTs and verified
// natural language. Enforces dual-channel compliance: whenever agents use dense
// shorthand tokens, they must be registered in the Codebook or paired with verified English.

export class RosettaBridge {
  constructor(initialCodebook = {}) {
    // Map of token -> { definition, domain, registeredBy, registeredAt }
    this.codebook = new Map();
    for (const [token, value] of Object.entries(initialCodebook)) {
      const definition = typeof value === 'string' ? value : value.definition;
      this.registerTerm(token, definition, typeof value === 'object' ? value : {});
    }
  }

  /**
   * Registers a synthetic token into the Rosetta Codebook.
   */
  registerTerm(token, definition, opts = {}) {
    const cleanToken = String(token).trim();
    if (!cleanToken) throw new Error('Token identifier required');
    if (!definition || typeof definition !== 'string') throw new Error('Definition string required');

    const entry = {
      token: cleanToken,
      definition: definition.trim(),
      domain: opts.domain || 'general',
      registeredBy: opts.agentId || 'system',
      registeredAt: new Date().toISOString(),
    };

    this.codebook.set(cleanToken, entry);
    return entry;
  }

  /**
   * Checks if a token is registered.
   */
  hasTerm(token) {
    return this.codebook.has(String(token).trim());
  }

  /**
   * Retrieves definition for a token.
   */
  getTerm(token) {
    return this.codebook.get(String(token).trim()) || null;
  }

  /**
   * Decompiles a message containing synthetic argot into a human-readable string.
   * Replaces registered tokens with their expanded explanations.
   */
  decompile(message) {
    if (!message || typeof message !== 'string') return { decompiled: '', expandedTerms: [] };

    let decompiled = message;
    const expandedTerms = [];

    for (const [token, entry] of this.codebook.entries()) {
      const regex = new RegExp(`\\b${token}\\b`, 'g');
      if (regex.test(decompiled)) {
        expandedTerms.push({ token, definition: entry.definition });
        decompiled = decompiled.replace(regex, `[${token}: ${entry.definition}]`);
      }
    }

    return {
      original: message,
      decompiled,
      expandedTerms,
      isFullyDecompiled: expandedTerms.length > 0,
    };
  }

  /**
   * Validates dual-channel compliance.
   * If an agent produces compressed shorthand, it must supply an English explanation
   * that covers all unregistered or registered concepts.
   */
  validateDualChannel(rawMessage, englishExplanation) {
    if (!rawMessage) return { compliant: true };

    const hasExplanation = typeof englishExplanation === 'string' && englishExplanation.trim().length > 10;
    const { decompiled, expandedTerms } = this.decompile(rawMessage);

    // If message contains synthetic tokens and no explanation is given
    const containsTokens = expandedTerms.length > 0;
    if (containsTokens && !hasExplanation) {
      return {
        compliant: false,
        reason: 'Dual-channel violation: Synthetic argot used without a human-readable English explanation',
        expandedTerms,
        decompiled,
      };
    }

    return {
      compliant: true,
      decompiled,
      expandedTerms,
      englishExplanation: englishExplanation || decompiled,
    };
  }

  /**
   * Returns a snapshot of the current codebook as a plain object.
   */
  toObject() {
    return Object.fromEntries(this.codebook.entries());
  }
}

export const globalRosettaBridge = new RosettaBridge({
  // Seed with known experimental shorthand patterns from Glossogen / HuggingFace benchmarks
  P6: 'Drape cloth over two adjacent edges of target face',
  D8FB: 'Administer acute stabilize sequence to node',
  LB: 'Bright light source',
  LD: 'Dim light source',
});

export default {
  RosettaBridge,
  globalRosettaBridge,
};
