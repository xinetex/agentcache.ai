import { redis as defaultRedis } from '../lib/redis.js';

export interface PredictionCandidate {
    hash: string;
    probability: number;
    depth: number;
    next?: PredictionCandidate[]; // Recursive prediction path
}

/**
 * Predictive Synapse: A Markov Chain Engine for Intent Prediction.
 * Uses Redis ZSETs to store the sparse transition matrix.
 */
export class PredictiveSynapse {
    // We use a dedicated namespace for the transition graph
    private PREFIX = 'synapse:transitions:';
    private redis: any;

    constructor(client?: any) {
        this.redis = client || defaultRedis;
    }

    /**
     * Train the Synapse: Observe a transition between two states.
     * @param prevHash The SHA-256 hash of the previous query
     * @param currHash The SHA-256 hash of the current query
     */
    async observe(prevHash: string, currHash: string): Promise<void> {
        if (!prevHash || !currHash || prevHash === currHash) return;

        const key = `${this.PREFIX}${prevHash}`;

        // ZINCRBY: Increment the weight of the transition A -> B
        // This is O(log N) where N is number of unique next states
        await this.redis.zincrby(key, 1, currHash);

        // Decay/Cleanup could happen here (e.g., ZREMRANGEBYRANK to keep only top 50)
    }

    /**
     * Predict the future: Get most probable next states.
     * @param currHash The current state
     * @param depth Recursive depth (default 1, max 3)
     */
    async predict(currHash: string, depth: number = 1): Promise<PredictionCandidate[]> {
        if (depth < 0) return [];

        const key = `${this.PREFIX}${currHash}`;

        // Get top 3 most frequent transitions
        // ZREVRANGE returns array like [member1, score1, member2, score2, ...]
        const results = await this.redis.zrange(key, 0, 2, { rev: true, withScores: true });

        if (!results || results.length === 0) return [];

        // Calculate total weight for normalization
        // results is [val, score, val, score...]
        let totalScore = 0;
        for (let i = 1; i < results.length; i += 2) {
            totalScore += Number(results[i]);
        }

        const candidates: PredictionCandidate[] = [];

        for (let i = 0; i < results.length; i += 2) {
            const hash = String(results[i]);
            const score = Number(results[i + 1]);
            const probability = score / totalScore;

            // Nucleus Sampling: Ignore low probability paths to reduce noise
            if (probability < 0.1) continue;

            const candidate: PredictionCandidate = {
                hash,
                probability,
                depth
            };

            // Recursive Step: If high confidence, look ahead t+2
            if (depth > 1 && probability > 0.5) {
                const nextPredictions = await this.predict(hash, depth - 1);
                if (nextPredictions.length > 0) {
                    candidate.next = nextPredictions;
                }
            }

            candidates.push(candidate);
        }

        return candidates;
    }
}
