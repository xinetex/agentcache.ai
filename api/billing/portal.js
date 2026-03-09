import Stripe from 'stripe';
import { createHash } from 'crypto';

import { getAuthErrorStatus, requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';

export const config = {
  runtime: 'nodejs',
};

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function getBaseUrl(req) {
  const configured = process.env.PUBLIC_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  const proto = getHeader(req, 'x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : 'https://agentcache.ai';
}

function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex');
}

async function resolveOrganization(req) {
  const authHeader = getHeader(req, 'authorization') || getHeader(req, 'Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);

    if (!token.startsWith('ac_')) {
      const user = await requireAuth(req);

      if (!user.organizationId) {
        const onboardingError = new Error('Organization setup required');
        onboardingError.code = 'ONBOARDING_REQUIRED';
        throw onboardingError;
      }

      const orgResult = await query(`
        SELECT id, stripe_customer_id
        FROM organizations
        WHERE id = $1
        LIMIT 1
      `, [user.organizationId]);

      if (orgResult.rows.length === 0) {
        const orgError = new Error('Organization not found');
        orgError.code = 'ORGANIZATION_NOT_FOUND';
        throw orgError;
      }

      return orgResult.rows[0];
    }
  }

  const apiKey = getHeader(req, 'x-api-key') || authHeader?.replace('Bearer ', '') || null;
  if (!apiKey || !apiKey.startsWith('ac_')) {
    const authError = new Error('No authentication token provided');
    authError.code = 'UNAUTHORIZED';
    throw authError;
  }

  const apiKeyHash = hashApiKey(apiKey);
  const orgResult = await query(`
    SELECT o.id, o.stripe_customer_id
    FROM api_keys ak
    JOIN organizations o ON o.id = ak.organization_id
    WHERE ak.key_hash = $1
      AND ak.is_active = true
    LIMIT 1
  `, [apiKeyHash]);

  if (orgResult.rows.length === 0) {
    const keyError = new Error('Invalid or missing API key');
    keyError.code = 'INVALID_API_KEY';
    throw keyError;
  }

  return orgResult.rows[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        error: 'Stripe not configured',
        message: 'Billing portal is unavailable until Stripe is configured for this environment.',
      });
    }

    const organization = await resolveOrganization(req);
    if (!organization.stripe_customer_id) {
      return res.status(404).json({
        error: 'No active subscription',
        message: 'This workspace does not have an active Stripe billing profile yet.',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const publicUrl = getBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: `${publicUrl}/portal-dashboard.html`,
    });

    return res.status(200).json({
      success: true,
      portalUrl: session.url,
    });
  } catch (error) {
    if (error?.code === 'ONBOARDING_REQUIRED') {
      return res.status(409).json({
        error: error.message,
        onboardingRequired: true,
        onboardingUrl: '/onboarding.html',
      });
    }

    if (error?.code === 'ORGANIZATION_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }

    if (error?.code === 'INVALID_API_KEY') {
      return res.status(401).json({ error: error.message });
    }

    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      return res.status(authStatus).json({ error: error.message });
    }

    console.error('[Billing] Portal error:', error);
    return res.status(500).json({
      error: 'Failed to create billing portal session',
      message: error.message,
    });
  }
}
