export const config = { runtime: 'nodejs' };

import { createClient } from '@vercel/postgres';
import { createWizard } from '../../lib/wizard-framework.js';
import crypto from 'crypto';

/**
 * POST /api/portal/provision
 * Provision a new customer organization with namespaces and API keys
 * 
 * Request body:
 * {
 *   organization: {
 *     name: string,
 *     sector: string,
 *     contact_email: string,
 *     contact_name: string,
 *     plan_tier: 'starter' | 'professional' | 'enterprise'
 *   },
 *   scale: 'single_tenant' | 'multi_customer',
 *   namespace_strategy: 'auto' | 'custom',
 *   custom_namespaces?: string[]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   organization: { id, name, slug, ... },
 *   namespaces: [...],
 *   api_key: string,
 *   dashboard_url: string
 * }
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

function generateApiKey(orgSlug) {
  const prefix = 'ac_live_';
  const random = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${orgSlug}_${random}`;
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const client = createClient();

  try {
    await client.connect();

    const body = await req.json();
    const { organization, scale, namespace_strategy, custom_namespaces } = body;

    // Validate input
    if (!organization?.name || !organization?.sector || !organization?.contact_email) {
      return json({
        success: false,
        error: 'Missing required fields: name, sector, contact_email'
      }, 400);
    }

    // Use CustomerOnboardingWizard for intelligent provisioning
    const wizard = createWizard('customerOnboarding');

    // Step 1: Analyze organization and get AI suggestions
    const orgAnalysis = await wizard.analyzeOrganization({
      name: organization.name,
      sector: organization.sector,
      plan_tier: organization.plan_tier || 'starter',
      contact: organization.contact_email
    });

    // Step 2: Get namespace suggestions
    const namespaceSuggestions = await wizard.suggestNamespaces(
      organization.sector,
      scale,
      'general'
    );

    // Determine namespaces to create
    let namespacesToCreate = [];
    if (namespace_strategy === 'custom' && custom_namespaces?.length > 0) {
      namespacesToCreate = custom_namespaces.map(name => ({
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        display_name: name.charAt(0).toUpperCase() + name.slice(1),
        description: `Custom namespace: ${name}`
      }));
    } else {
      // Use AI-recommended namespaces
      namespacesToCreate = namespaceSuggestions.namespaces;
    }

    // Step 3: Provision organization resources
    const provisionData = await wizard.provisionCustomer({
      organization: {
        name: organization.name,
        sector: organization.sector,
        plan_tier: organization.plan_tier || 'starter'
      },
      namespaces: namespacesToCreate,
      api_keys_count: 1
    }, {});

    const slug = provisionData.organization.slug;

    // Begin transaction
    await client.query('BEGIN');

    // Insert organization
    const orgResult = await client.query(`
      INSERT INTO organizations (
        name, slug, sector, contact_email, contact_name, 
        plan_tier, max_namespaces, max_api_keys, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      organization.name,
      slug,
      organization.sector,
      organization.contact_email,
      organization.contact_name || null,
      organization.plan_tier || 'starter',
      provisionData.organization.max_namespaces,
      provisionData.organization.max_api_keys,
      'active'
    ]);

    const org = orgResult.rows[0];

    // Insert namespaces
    const createdNamespaces = [];
    for (const ns of provisionData.namespaces) {
      const nsResult = await client.query(`
        INSERT INTO namespaces (
          organization_id, name, display_name, description, 
          sector_nodes, namespace_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        org.id,
        ns.name,
        ns.display_name,
        ns.description || `${ns.display_name} namespace`,
        JSON.stringify(ns.sector_nodes || []),
        ns.type || 'standard',
        true
      ]);
      createdNamespaces.push(nsResult.rows[0]);
    }

    // Generate API key
    const apiKey = generateApiKey(slug);
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12);

    await client.query(`
      INSERT INTO api_keys (
        organization_id, key_hash, key_prefix, name, 
        allowed_namespaces, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      org.id,
      keyHash,
      keyPrefix,
      'Production Key',
      JSON.stringify(createdNamespaces.map(ns => ns.name)),
      true
    ]);

    // Insert organization settings
    await client.query(`
      INSERT INTO organization_settings (
        organization_id, namespace_strategy, features
      ) VALUES ($1, $2, $3)
    `, [
      org.id,
      scale,
      JSON.stringify({
        multi_tenant: scale === 'multi_customer',
        sso: false,
        custom_nodes: organization.sector === 'filestorage'
      })
    ]);

    // Commit transaction
    await client.query('COMMIT');

    // Learn from successful onboarding
    await wizard.learnFromOnboarding(org, {
      success: true,
      namespaces_created: createdNamespaces.map(ns => ns.name),
      namespace_strategy: namespace_strategy,
      scale: scale
    });

    return json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        sector: org.sector,
        plan_tier: org.plan_tier
      },
      namespaces: createdNamespaces.map(ns => ({
        id: ns.id,
        name: ns.name,
        display_name: ns.display_name,
        sector_nodes: ns.sector_nodes
      })),
      api_key: apiKey, // Only returned once!
      dashboard_url: `/portal/dashboard?org=${slug}`,
      wizard_insights: {
        confidence: orgAnalysis.confidence,
        learned: orgAnalysis.learned,
        reason: orgAnalysis.reason
      }
    });

  } catch (error) {
    // Rollback on error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }

    console.error('Provisioning error:', error);

    return json({
      success: false,
      error: 'Failed to provision organization',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);

  } finally {
    await client.end();
  }
}
