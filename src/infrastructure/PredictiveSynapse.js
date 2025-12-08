
/**
 * Predictive Synapse (The Oracle)
 * 
 * Implements a lightweight Markov Chain / Graph engine to predict user intent.
 * Enables "Negative Latency" by anticipating the next request based on global history.
 */

export class PredictiveSynapse {
    constructor() {
        // In a real implementation, this would be backed by Redis Graph or a Vector DB.
        // For this version, we use an in-memory Map to simulate the "Hive Mind".
        this.transitionMatrix = new Map(); // Key: CurrentQueryHash, Value: Map<NextQueryHash, Count>
        this.queryMap = new Map(); // Key: Hash, Value: QueryString
    }

    /**
     * Hash a query to a stable identifier
     */
    hash(query) {
        // Simple distinct normalization
        return query.toLowerCase().trim().replace(/[?.!]$/, '');
    }

    /**
     * Learn from a user's sequence of actions.
     * @param {string} previousQuery - The query the user just asked
     * @param {string} currentQuery - The query the user is asking now
     */
    observe(previousQuery, currentQuery) {
        if (!previousQuery || !currentQuery) return;

        const prevHash = this.hash(previousQuery);
        const currHash = this.hash(currentQuery);

        // Store actual text for retrieval
        this.queryMap.set(prevHash, previousQuery);
        this.queryMap.set(currHash, currentQuery);

        if (!this.transitionMatrix.has(prevHash)) {
            this.transitionMatrix.set(prevHash, new Map());
        }

        const transitions = this.transitionMatrix.get(prevHash);
        const count = transitions.get(currHash) || 0;
        transitions.set(currHash, count + 1);
    }

    /**
     * Predict the likely next queries based on the current one.
     * @param {string} currentQuery 
     * @param {number} depth - Recursion depth (not fully used in v1)
     * @returns {Array} List of predictions with probabilities
     */
    async predict(currentQuery, depth = 1) {
        const hash = this.hash(currentQuery);

        if (!this.transitionMatrix.has(hash)) {
            // Cold start or unknown query
            return this.getGlobalTrending();
        }

        const transitions = this.transitionMatrix.get(hash);
        let total = 0;
        const candidates = [];

        // Calculate total interactions from this node
        for (const count of transitions.values()) total += count;

        // Calculate probabilities
        for (const [nextHash, count] of transitions.entries()) {
            candidates.push({
                query: this.queryMap.get(nextHash),
                probability: count / total,
                type: 'markov_chain'
            });
        }

        // Sort by probability descending
        return candidates.sort((a, b) => b.probability - a.probability).slice(0, 3);
    }

    /**
     * Fallback: Return global trending queries (Mocked)
     */
    getGlobalTrending() {
        return [
            { query: "How to optimize RAG performance?", probability: 0.15, type: 'global_trend' },
            { query: "Explain CLaRa-7B compression", probability: 0.12, type: 'global_trend' },
            { query: "Latest AgentCache API Limits", probability: 0.08, type: 'global_trend' }
        ];
    }
}
