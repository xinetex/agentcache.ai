/**
 * Pricing System Configuration
 * CURRENT STATUS: PUBLIC BETA (Free)
 * All plans are currently free during the beta period.
 */

export const PLAN_PRICES = {
    starter: 0,
    professional: 0,
    enterprise: 0
};

export const QUOTAS = {
    starter: 1000000,      // Generous limits for Beta
    professional: 10000000,
    enterprise: 100000000
};

export const FEATURES = {
    starter: [
        '1 Million requests/month (Beta)',
        'Unlimited pipelines',
        'All complexity tiers included',
        'L1 + L2 cache',
        'Community support'
    ],
    professional: [
        '10 Million requests/month (Beta)',
        'Unlimited pipelines',
        'Priority support',
        'Early access to new features'
    ],
    enterprise: [
        'Custom Limits',
        'Dedicated Infrastructure',
        'SLA'
    ]
};

export const LIMITS = {
    starter: {
        requests: 100000,
        max_complexity: 'simple'
    },
    professional: {
        pipelines: 10,
        requests: 1000000,
        max_complexity: 'moderate'
    },
    enterprise: {
        pipelines: Infinity,
        requests: 10000000,
        max_complexity: 'enterprise'
    }
};
