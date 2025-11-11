import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
/**
 * Users table - manages AgentCache.ai accounts
 */
export const users = pgTable('users', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    email: text('email').notNull().unique(),
    password: text('password').notNull(), // bcrypt hashed
    name: text('name'),
    stripeCustomerId: text('stripe_customer_id').unique(),
    plan: text('plan').notNull().default('free'), // free, starter, pro, business
    monthlyQuota: integer('monthly_quota').notNull().default(1000), // requests per month
    usedThisMonth: integer('used_this_month').notNull().default(0),
    resetDate: timestamp('reset_date').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
/**
 * API Keys table - authentication tokens for cache requests
 */
export const apiKeys = pgTable('api_keys', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull().unique(), // ac_live_... or ac_test_...
    name: text('name').notNull(), // User-friendly name
    isActive: boolean('is_active').notNull().default(true),
    lastUsed: timestamp('last_used'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});
/**
 * Usage logs - track cache hits/misses and cost savings
 */
export const usageLogs = pgTable('usage_logs', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    apiKeyId: text('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // openai, anthropic, moonshot, etc
    model: text('model').notNull(),
    cacheHit: boolean('cache_hit').notNull(),
    requestTokens: integer('request_tokens'),
    responseTokens: integer('response_tokens'),
    estimatedCost: integer('estimated_cost'), // Cost in cents
    savedCost: integer('saved_cost'), // Saved cost in cents (for cache hits)
    latencyMs: integer('latency_ms'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
});
/**
 * Subscriptions table - track Stripe subscriptions
 */
export const subscriptions = pgTable('subscriptions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    stripePriceId: text('stripe_price_id').notNull(),
    status: text('status').notNull(), // active, canceled, past_due
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
/**
 * Cache analytics - aggregated stats per user
 */
export const analytics = pgTable('analytics', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(), // Daily aggregation
    totalRequests: integer('total_requests').notNull().default(0),
    cacheHits: integer('cache_hits').notNull().default(0),
    cacheMisses: integer('cache_misses').notNull().default(0),
    hitRate: integer('hit_rate').notNull().default(0), // Percentage
    totalCostCents: integer('total_cost_cents').notNull().default(0),
    savedCostCents: integer('saved_cost_cents').notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
});
//# sourceMappingURL=schema.js.map