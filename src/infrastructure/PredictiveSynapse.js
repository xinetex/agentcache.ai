/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { redis as defaultRedis } from '../lib/redis.js';

export class PredictiveSynapse {
    constructor(client) {
        this.PREFIX = 'synapse:transitions:';
        this.redis = client || defaultRedis;
    }

    async observe(prevHash, currHash) {
        if (!prevHash || !currHash || prevHash === currHash) return;

        const key = `${this.PREFIX}${prevHash}`;
        await this.redis.zincrby(key, 1, currHash);
    }

    async predict(currHash, depth = 1) {
        if (depth < 0) return [];

        const key = `${this.PREFIX}${currHash}`;
        const results = await this.redis.zrange(key, 0, 2, { rev: true, withScores: true });

        if (!results || results.length === 0) return [];

        let totalScore = 0;
        for (let i = 1; i < results.length; i += 2) {
            totalScore += Number(results[i]);
        }

        const candidates = [];

        for (let i = 0; i < results.length; i += 2) {
            const hash = String(results[i]);
            const score = Number(results[i + 1]);
            const probability = score / totalScore;

            if (probability < 0.1) continue;

            const candidate = {
                hash,
                probability,
                depth
            };

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
