// lib/contagion-tracker.js
//
// AgentCache — Linguistic Contagion & Transmission Tracker.
//
// Tracks how emergent dialects originate in Frontier models (e.g. GPT-5, Claude Opus)
// and transmit across the network to Open-Weights models (e.g. Llama 3, Qwen).
// Maintains an active transmission graph and enables targeted isolation of originator hubs.
//
// Pure, deterministic, and engine-agnostic.

export class ContagionTracker {
  constructor() {
    this.agents = new Map(); // agentId -> { modelTier: 'frontier'|'open-weights', status: 'clean'|'infected'|'quarantined', vocabulary: Set }
    this.edges = []; // Array of transmission events: { from, to, tokens, timestamp }
  }

  /**
   * Registers an agent node in the contagion network.
   */
  registerAgent(agentId, opts = {}) {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        agentId,
        modelTier: opts.modelTier || (opts.model?.includes('opus') || opts.model?.includes('gpt-5') ? 'frontier' : 'open-weights'),
        status: 'clean',
        vocabulary: new Set(),
        infectionCount: 0,
        registeredAt: new Date().toISOString(),
      });
    }
    return this.agents.get(agentId);
  }

  /**
   * Records a communication event and updates the linguistic contagion state.
   */
  recordInteraction(senderId, receiverId, syntheticTokens = []) {
    this.registerAgent(senderId);
    this.registerAgent(receiverId);

    const sender = this.agents.get(senderId);
    const receiver = this.agents.get(receiverId);

    if (syntheticTokens.length > 0) {
      // Add tokens to sender's vocabulary
      syntheticTokens.forEach(t => sender.vocabulary.add(t));
      sender.status = sender.status === 'quarantined' ? 'quarantined' : 'infected';

      // Transmit to receiver
      syntheticTokens.forEach(t => receiver.vocabulary.add(t));
      receiver.status = receiver.status === 'quarantined' ? 'quarantined' : 'infected';
      receiver.infectionCount += 1;

      const edge = {
        from: senderId,
        to: receiverId,
        fromTier: sender.modelTier,
        toTier: receiver.modelTier,
        tokens: [...syntheticTokens],
        timestamp: new Date().toISOString(),
      };

      this.edges.push(edge);
      return { transmission: true, edge };
    }

    return { transmission: false };
  }

  /**
   * Quarantines an infected agent node, cutting its ability to transmit to peers.
   */
  quarantine(agentId) {
    if (this.agents.has(agentId)) {
      const agent = this.agents.get(agentId);
      agent.status = 'quarantined';
      return { quarantined: true, agentId };
    }
    return { quarantined: false, error: 'Agent not found' };
  }

  /**
   * Returns a complete analysis of the contagion graph.
   */
  getAnalysis() {
    const nodes = Array.from(this.agents.values()).map(a => ({
      ...a,
      vocabulary: Array.from(a.vocabulary),
    }));

    const infectedCount = nodes.filter(n => n.status === 'infected' || n.status === 'quarantined').length;
    const frontierOriginators = this.edges
      .filter(e => e.fromTier === 'frontier' && e.toTier === 'open-weights')
      .map(e => e.from);

    return {
      totalAgents: nodes.length,
      infectedAgents: infectedCount,
      contagionRate: nodes.length > 0 ? Number((infectedCount / nodes.length).toFixed(3)) : 0,
      crossTierTransmissions: frontierOriginators.length,
      nodes,
      edges: this.edges,
    };
  }
}

export const globalContagionTracker = new ContagionTracker();

export default {
  ContagionTracker,
  globalContagionTracker,
};
