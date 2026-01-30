/**
 * Credits Service
 * AgentCache.ai - Top-Off Billing
 * 
 * Import this service to deduct credits from users for service usage.
 * 
 * Usage:
 *   import { deductCredits, checkBalance } from './services/credits.js';
 *   
 *   // Check if user has enough credits
 *   const hasCredits = await checkBalance(userId, 'ai_embedding', 5);
 *   
 *   // Deduct credits after operation
 *   await deductCredits(userId, 'ai_embedding', 5, { resourceId: 'file-123' });
 */

import { neon } from '@neondatabase/serverless';
import { SERVICE_COSTS, calculateCost, LOW_BALANCE_WARNING } from '../config/credits.js';

const sql = neon(process.env.DATABASE_URL);

/**
 * Check if user has sufficient credits for an operation
 */
export async function checkBalance(userId, service, quantity = 1) {
  const cost = calculateCost(service, quantity);
  
  const [user] = await sql`
    SELECT credit_balance FROM users WHERE id = ${userId}
  `;

  if (!user) {
    throw new Error('User not found');
  }

  return {
    sufficient: user.credit_balance >= cost,
    balance: user.credit_balance,
    required: cost,
    shortfall: Math.max(0, cost - user.credit_balance),
  };
}

/**
 * Deduct credits for a service operation
 * Returns the new balance or throws if insufficient credits
 */
export async function deductCredits(userId, service, quantity = 1, options = {}) {
  const { resourceId, description, allowNegative = false } = options;
  const cost = calculateCost(service, quantity);

  if (cost === 0) {
    return { success: true, deducted: 0, balance: null };
  }

  // Atomically deduct credits
  const condition = allowNegative ? sql`true` : sql`credit_balance >= ${cost}`;
  
  const [result] = await sql`
    UPDATE users 
    SET 
      credit_balance = credit_balance - ${cost},
      lifetime_credits_used = lifetime_credits_used + ${cost}
    WHERE id = ${userId} AND ${condition}
    RETURNING credit_balance
  `;

  if (!result) {
    const [userData] = await sql`
      SELECT credit_balance FROM users WHERE id = ${userId}
    `;
    
    throw new InsufficientCreditsError(cost, userData?.credit_balance || 0);
  }

  // Record transaction
  await sql`
    INSERT INTO credit_transactions (
      user_id, type, amount, balance_after, service, resource_id, quantity, description
    ) VALUES (
      ${userId}, 'usage', ${-cost}, ${result.credit_balance},
      ${service}, ${resourceId || null}, ${quantity},
      ${description || `${service} x ${quantity}`}
    )
  `;

  // Update daily aggregation (best effort)
  try {
    const column = serviceToColumn(service);
    if (column) {
      await sql`
        INSERT INTO credit_usage_daily (user_id, date, total_credits_used, ${sql.identifier(column)})
        VALUES (${userId}, CURRENT_DATE, ${cost}, ${quantity})
        ON CONFLICT (user_id, date) DO UPDATE SET
          total_credits_used = credit_usage_daily.total_credits_used + ${cost},
          ${sql.identifier(column)} = credit_usage_daily.${sql.identifier(column)} + ${quantity}
      `;
    }
  } catch (e) {
    console.warn('Failed to update daily usage aggregation:', e.message);
  }

  return {
    success: true,
    deducted: cost,
    balance: result.credit_balance,
    lowBalance: result.credit_balance < LOW_BALANCE_WARNING,
  };
}

/**
 * Add credits to a user (for purchases, refunds, bonuses)
 */
export async function addCredits(userId, credits, options = {}) {
  const { type = 'bonus', description, metadata = {} } = options;

  const [result] = await sql`
    UPDATE users 
    SET 
      credit_balance = credit_balance + ${credits},
      lifetime_credits_purchased = CASE 
        WHEN ${type} IN ('purchase', 'auto_topoff') 
        THEN lifetime_credits_purchased + ${credits}
        ELSE lifetime_credits_purchased
      END
    WHERE id = ${userId}
    RETURNING credit_balance
  `;

  if (!result) {
    throw new Error('User not found');
  }

  // Record transaction
  await sql`
    INSERT INTO credit_transactions (
      user_id, type, amount, balance_after, description, metadata,
      package_id, stripe_payment_intent_id, stripe_checkout_session_id
    ) VALUES (
      ${userId}, ${type}, ${credits}, ${result.credit_balance},
      ${description || `Added ${credits} credits`},
      ${JSON.stringify(metadata)},
      ${metadata.packageId || null},
      ${metadata.stripePaymentIntentId || null},
      ${metadata.stripeCheckoutSessionId || null}
    )
  `;

  return result.credit_balance;
}

/**
 * Get user's current credit balance
 */
export async function getBalance(userId) {
  const [user] = await sql`
    SELECT 
      credit_balance,
      lifetime_credits_purchased,
      lifetime_credits_used
    FROM users 
    WHERE id = ${userId}
  `;

  if (!user) {
    throw new Error('User not found');
  }

  return {
    balance: user.credit_balance,
    lifetimePurchased: user.lifetime_credits_purchased,
    lifetimeUsed: user.lifetime_credits_used,
    lowBalance: user.credit_balance < LOW_BALANCE_WARNING,
  };
}

/**
 * Get usage summary for a period
 */
export async function getUsageSummary(userId, startDate, endDate) {
  const [summary] = await sql`
    SELECT 
      COALESCE(SUM(total_credits_used), 0) as total_credits,
      COALESCE(SUM(cache_reads), 0) as cache_reads,
      COALESCE(SUM(cache_writes), 0) as cache_writes,
      COALESCE(SUM(cache_semantic), 0) as cache_semantic,
      COALESCE(SUM(ai_embeddings), 0) as ai_embeddings,
      COALESCE(SUM(ai_completions_tokens), 0) as ai_completions_tokens,
      COALESCE(SUM(transcode_minutes), 0) as transcode_minutes,
      COALESCE(SUM(edge_invocations), 0) as edge_invocations
    FROM credit_usage_daily
    WHERE user_id = ${userId}
      AND date >= ${startDate}
      AND date <= ${endDate}
  `;

  return summary;
}

/**
 * Map service name to database column name
 */
function serviceToColumn(service) {
  const mapping = {
    'cache_read': 'cache_reads',
    'cache_write': 'cache_writes',
    'cache_semantic': 'cache_semantic',
    'ai_embedding': 'ai_embeddings',
    'ai_completion_1k': 'ai_completions_tokens',
    'transcode_minute': 'transcode_minutes',
    'edge_invocation': 'edge_invocations',
    'storage_gb_month': 'storage_gb',
    'egress_gb': 'egress_gb',
  };
  return mapping[service] || null;
}

/**
 * Custom error for insufficient credits
 */
export class InsufficientCreditsError extends Error {
  constructor(required, balance) {
    super(`Insufficient credits: need ${required}, have ${balance}`);
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.balance = balance;
    this.shortfall = required - balance;
  }
}

/**
 * Middleware to check credits before an operation
 * Usage in API route:
 *   const canProceed = await requireCredits(userId, 'ai_embedding', 1);
 *   if (!canProceed.ok) return res.status(402).json(canProceed.error);
 */
export async function requireCredits(userId, service, quantity = 1) {
  try {
    const check = await checkBalance(userId, service, quantity);
    
    if (!check.sufficient) {
      return {
        ok: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: `Insufficient credits for ${service}`,
          required: check.required,
          balance: check.balance,
          shortfall: check.shortfall,
          topup_url: '/dashboard?topoff=true',
        },
      };
    }

    return { ok: true, cost: check.required };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'CREDITS_CHECK_FAILED',
        message: error.message,
      },
    };
  }
}
