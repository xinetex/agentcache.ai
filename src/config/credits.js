/**
 * Credits System Configuration
 * AgentCache.ai - Top-Off Billing
 * 
 * Credits are the universal currency for all AgentCache services.
 * 1 Credit = $0.01 USD (100 credits = $1)
 */

// Credit packages available for purchase
export const CREDIT_PACKAGES = {
  pack_500: {
    id: 'pack_500',
    credits: 500,
    price: 500,           // $5.00 in cents
    priceDisplay: '$5',
    bonus: 0,
    popular: false,
  },
  pack_1000: {
    id: 'pack_1000', 
    credits: 1000,
    price: 1000,          // $10.00
    priceDisplay: '$10',
    bonus: 0,
    popular: false,
  },
  pack_2500: {
    id: 'pack_2500',
    credits: 2750,        // 10% bonus
    price: 2500,          // $25.00
    priceDisplay: '$25',
    bonus: 250,
    popular: true,
  },
  pack_5000: {
    id: 'pack_5000',
    credits: 5750,        // 15% bonus
    price: 5000,          // $50.00
    priceDisplay: '$50',
    bonus: 750,
    popular: false,
  },
  pack_10000: {
    id: 'pack_10000',
    credits: 12000,       // 20% bonus
    price: 10000,         // $100.00
    priceDisplay: '$100',
    bonus: 2000,
    popular: false,
  },
  pack_25000: {
    id: 'pack_25000',
    credits: 31250,       // 25% bonus
    price: 25000,         // $250.00
    priceDisplay: '$250',
    bonus: 6250,
    popular: false,
  },
};

// Stripe Price IDs for credit packages (create in Stripe Dashboard)
export const STRIPE_CREDIT_PRICE_IDS = {
  pack_500: process.env.STRIPE_PRICE_CREDITS_500 || 'price_credits_500',
  pack_1000: process.env.STRIPE_PRICE_CREDITS_1000 || 'price_credits_1000',
  pack_2500: process.env.STRIPE_PRICE_CREDITS_2500 || 'price_credits_2500',
  pack_5000: process.env.STRIPE_PRICE_CREDITS_5000 || 'price_credits_5000',
  pack_10000: process.env.STRIPE_PRICE_CREDITS_10000 || 'price_credits_10000',
  pack_25000: process.env.STRIPE_PRICE_CREDITS_25000 || 'price_credits_25000',
};

// Service costs in credits
export const SERVICE_COSTS = {
  // Cache operations
  cache_read: 0.1,          // 0.1 credits per read (L1/L2)
  cache_write: 0.2,         // 0.2 credits per write
  cache_semantic: 0.5,      // 0.5 credits for semantic search
  
  // AI operations
  ai_embedding: 1,          // 1 credit per embedding generation
  ai_completion_1k: 5,      // 5 credits per 1K tokens (completion)
  ai_vision: 10,            // 10 credits per image analysis
  
  // Media operations
  transcode_minute: 10,     // 10 credits per minute transcoded
  thumbnail_gen: 2,         // 2 credits per thumbnail
  hls_segment: 0.5,         // 0.5 credits per HLS segment served
  
  // Storage (per GB per month, prorated daily)
  storage_gb_month: 50,     // 50 credits per GB/month
  egress_gb: 25,            // 25 credits per GB egress
  
  // Edge compute
  edge_invocation: 1,       // 1 credit per function invocation
  edge_compute_ms: 0.001,   // 0.001 credits per ms of compute
};

// Auto top-off thresholds
export const AUTO_TOPOFF_THRESHOLDS = [
  { label: 'When balance falls below 100 credits', value: 100 },
  { label: 'When balance falls below 250 credits', value: 250 },
  { label: 'When balance falls below 500 credits', value: 500 },
  { label: 'When balance falls below 1000 credits', value: 1000 },
];

// Default auto top-off package
export const DEFAULT_TOPOFF_PACKAGE = 'pack_2500';

// Free credits for new users
export const NEW_USER_CREDITS = 100;

// Low balance warning threshold
export const LOW_BALANCE_WARNING = 50;

/**
 * Calculate cost for a service operation
 */
export function calculateCost(service, quantity = 1) {
  const unitCost = SERVICE_COSTS[service];
  if (unitCost === undefined) {
    console.warn(`Unknown service: ${service}`);
    return 0;
  }
  return unitCost * quantity;
}

/**
 * Format credits for display
 */
export function formatCredits(credits) {
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}K`;
  }
  return credits.toFixed(1);
}

/**
 * Convert credits to USD
 */
export function creditsToUSD(credits) {
  return (credits / 100).toFixed(2);
}

/**
 * Convert USD (cents) to credits
 */
export function usdToCredits(cents) {
  return cents; // 1 cent = 1 credit
}
