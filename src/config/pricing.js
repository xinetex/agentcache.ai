/**
 * Pricing System Configuration
 * AgentCache.ai - Cognitive Memory OS
 * 
 * Stripe Price IDs must be created in Stripe Dashboard
 * and set in environment variables.
 */

// Production prices (in cents for Stripe)
export const PLAN_PRICES = {
    starter: 0,          // Free tier
    professional: 9900,  // $99/month
    enterprise: 29900    // $299/month
};

// Human-readable prices
export const PLAN_PRICES_DISPLAY = {
    starter: '$0',
    professional: '$99',
    enterprise: '$299'
};

// Stripe Price IDs (set in environment or use defaults)
export const STRIPE_PRICE_IDS = {
    starter: process.env.STRIPE_PRICE_STARTER || 'price_starter_free',
    professional: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_1234567890', // Replace with actual
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_0987654321'     // Replace with actual
};

// Request quotas per month
export const QUOTAS = {
    starter: 10000,       // 10K requests/month (free tier)
    professional: 1000000, // 1M requests/month
    enterprise: 10000000   // 10M requests/month
};

// Feature lists for display
export const FEATURES = {
    starter: [
        '10,000 requests/month',
        '3 pipelines',
        'Simple complexity only',
        'L1 cache',
        'Community support'
    ],
    professional: [
        '1 Million requests/month',
        '10 pipelines',
        'Moderate complexity',
        'L1 + L2 cache',
        'Semantic caching',
        'Priority email support',
        'Oracle as a Service'
    ],
    enterprise: [
        '10 Million requests/month',
        'Unlimited pipelines',
        'Enterprise complexity',
        'L1 + L2 + L3 cache',
        'Private namespaces',
        'Custom SLA',
        'Dedicated support',
        'Media transcoding',
        'Q-Oracle integration'
    ]
};

// Plan limits
export const LIMITS = {
    starter: {
        pipelines: 3,
        requests: 10000,
        max_complexity: 'simple',
        ttl_max_days: 7,
        private_namespace: false,
        semantic_cache: false
    },
    professional: {
        pipelines: 10,
        requests: 1000000,
        max_complexity: 'moderate',
        ttl_max_days: 90,
        private_namespace: true,
        semantic_cache: true
    },
    enterprise: {
        pipelines: Infinity,
        requests: 10000000,
        max_complexity: 'enterprise',
        ttl_max_days: 365,
        private_namespace: true,
        semantic_cache: true
    }
};

// Plan hierarchy for upgrade/downgrade logic
export const PLAN_HIERARCHY = ['starter', 'professional', 'enterprise'];

/**
 * Check if upgrade is valid
 */
export function isValidUpgrade(fromPlan, toPlan) {
    const fromIndex = PLAN_HIERARCHY.indexOf(fromPlan);
    const toIndex = PLAN_HIERARCHY.indexOf(toPlan);
    return toIndex > fromIndex;
}

/**
 * Get prorated amount for upgrade (simplified)
 */
export function getProratedAmount(fromPlan, toPlan, daysRemaining, totalDays = 30) {
    const fromPrice = PLAN_PRICES[fromPlan] || 0;
    const toPrice = PLAN_PRICES[toPlan] || 0;
    const priceDiff = toPrice - fromPrice;
    const dailyDiff = priceDiff / totalDays;
    return Math.round(dailyDiff * daysRemaining);
}
