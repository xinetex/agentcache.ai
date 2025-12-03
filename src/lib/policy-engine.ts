/**
 * Policy Engine for Cache Lifecycle Management
 * Evaluates declarative rules to determine cache behavior (TTL, Invalidation).
 */

export interface Policy {
    id: string;
    name: string;
    selector: {
        tag?: string;      // Matches if item has this tag
        keyPattern?: string; // Matches if key matches regex pattern
    };
    action: {
        type: 'ttl' | 'invalidate';
        params: {
            durationSeconds?: number; // For TTL
        };
    };
    priority: number; // Higher priority wins
}

export interface CacheItemMetadata {
    key: string;
    tags?: string[];
}

export interface PolicyAction {
    type: 'ttl' | 'invalidate' | 'none';
    durationSeconds?: number;
    matchedPolicyId?: string;
}

export class PolicyEngine {
    private policies: Policy[];

    constructor(policies: Policy[]) {
        this.policies = policies.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Evaluates an item against all policies and returns the winning action.
     */
    evaluate(item: CacheItemMetadata): PolicyAction {
        for (const policy of this.policies) {
            if (this.matches(policy, item)) {
                return {
                    type: policy.action.type,
                    durationSeconds: policy.action.params.durationSeconds,
                    matchedPolicyId: policy.id,
                };
            }
        }
        return { type: 'none' };
    }

    private matches(policy: Policy, item: CacheItemMetadata): boolean {
        // 1. Tag Match
        if (policy.selector.tag) {
            if (!item.tags || !item.tags.includes(policy.selector.tag)) {
                return false;
            }
        }

        // 2. Key Pattern Match
        if (policy.selector.keyPattern) {
            const regex = new RegExp(policy.selector.keyPattern);
            if (!regex.test(item.key)) {
                return false;
            }
        }

        return true;
    }
}
