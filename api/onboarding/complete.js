import { verifyToken } from '../../lib/jwt.js';
import { transaction } from '../../lib/db.js';
import { generateStarterPipeline } from '../../lib/pipeline-generator.js';
import {
  generateApiKey,
  generateUniqueSlug,
  generateWorkspaceName,
  getKeyPrefix,
  getPlanLimits,
  hashApiKey,
  slugify,
} from '../../lib/workspace-provisioning.js';

export const config = { runtime: 'nodejs' };

function buildNamespaceRows(strategy, customNamespaces = []) {
  const base = [{ name: 'default', display_name: 'Default', description: 'Default cache namespace' }];

  if (strategy === 'custom' && customNamespaces.length > 0) {
    const custom = customNamespaces
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .map((name) => ({
        name: slugify(name).replace(/-/g, '_'),
        display_name: name,
        description: `Custom namespace for ${name}`,
      }));

    return [...base, ...custom];
  }

  return [
    ...base,
    { name: 'production', display_name: 'Production', description: 'Production environment' },
    { name: 'development', display_name: 'Development', description: 'Development environment' },
    { name: 'staging', display_name: 'Staging', description: 'Staging environment' },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const {
      sector = 'general',
      useCase,
      priority = 'balanced',
      wizardPrompt,
      organization: orgInput = {},
      scale = 'single_tenant',
      namespaceStrategy = 'auto',
      customNamespaces = [],
      planTier = 'starter',
    } = body || {};

    const requestedPlan = orgInput.plan_tier || planTier || 'starter';
    const namespaceRows = buildNamespaceRows(namespaceStrategy, customNamespaces);

    const result = await transaction(async (client) => {
      const userResult = await client.query(`
        SELECT id, email, full_name, organization_id, onboarding_completed
        FROM users
        WHERE id = $1
      `, [decoded.userId]);

      const user = userResult.rows[0];

      if (!user) {
        const err = new Error('User not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (user.onboarding_completed) {
        const err = new Error('Onboarding already completed');
        err.code = 'ALREADY_COMPLETED';
        throw err;
      }

      const limits = getPlanLimits(requestedPlan);
      const organizationName = orgInput.name?.trim() || generateWorkspaceName(user.full_name, user.email);
      const organizationSector = orgInput.sector || sector || 'general';
      const contactEmail = orgInput.contact_email?.trim() || user.email;
      const contactName = orgInput.contact_name?.trim() || user.full_name;

      let organization;

      if (user.organization_id) {
        const existingOrgResult = await client.query(`
          SELECT id, slug
          FROM organizations
          WHERE id = $1
        `, [user.organization_id]);

        if (existingOrgResult.rows.length > 0) {
          const existingOrg = existingOrgResult.rows[0];
          const updatedOrgResult = await client.query(`
            UPDATE organizations
            SET
              name = $1,
              sector = $2,
              contact_email = $3,
              contact_name = $4,
              plan_tier = $5,
              max_namespaces = $6,
              max_api_keys = $7,
              max_users = $8,
              status = 'active'
            WHERE id = $9
            RETURNING id, name, slug, sector, plan_tier
          `, [
            organizationName,
            organizationSector,
            contactEmail,
            contactName,
            requestedPlan,
            limits.maxNamespaces,
            limits.maxApiKeys,
            limits.maxUsers,
            existingOrg.id,
          ]);
          organization = updatedOrgResult.rows[0];
        }
      }

      if (!organization) {
        const slug = await generateUniqueSlug(client, orgInput.name || user.email.split('@')[0]);
        const organizationResult = await client.query(`
          INSERT INTO organizations (
            name, slug, sector, contact_email, contact_name,
            plan_tier, max_namespaces, max_api_keys, max_users, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, name, slug, sector, plan_tier
        `, [
          organizationName,
          slug,
          organizationSector,
          contactEmail,
          contactName,
          requestedPlan,
          limits.maxNamespaces,
          limits.maxApiKeys,
          limits.maxUsers,
          'active',
        ]);
        organization = organizationResult.rows[0];
      }

      await client.query(`
        UPDATE users
        SET
          organization_id = $1,
          role = 'owner',
          onboarding_completed = TRUE,
          onboarding_data = $2::jsonb
        WHERE id = $3
      `, [
        organization.id,
        JSON.stringify({
          sector: organizationSector,
          useCase,
          priority,
          wizardPrompt,
          organization: {
            name: organizationName,
            contact_email: contactEmail,
            contact_name: contactName,
            plan_tier: requestedPlan,
          },
          namespaceStrategy,
          customNamespaces,
          scale,
        }),
        user.id,
      ]);

      for (const ns of namespaceRows) {
        await client.query(`
          INSERT INTO namespaces (
            organization_id, name, display_name, description, is_active
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (organization_id, name) DO NOTHING
        `, [
          organization.id,
          ns.name,
          ns.display_name,
          ns.description,
          true,
        ]);
      }

      const pipelineConfig = generateStarterPipeline(organizationSector, priority);
      const pipelineResult = await client.query(`
        INSERT INTO pipelines (
          user_id,
          organization_id,
          name,
          description,
          sector,
          nodes,
          connections,
          complexity_tier,
          complexity_score,
          monthly_cost,
          status,
          is_starter,
          projected_savings,
          estimated_hit_rate,
          wizard_prompt
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::jsonb, $7::jsonb, $8, $9, $10,
          'draft', TRUE, $11, $12, $13
        )
        RETURNING id, name, description
      `, [
        user.id,
        organization.id,
        pipelineConfig.name,
        pipelineConfig.description,
        organizationSector,
        JSON.stringify(pipelineConfig.nodes),
        JSON.stringify(pipelineConfig.connections),
        pipelineConfig.complexity,
        pipelineConfig.nodes.length * 10,
        Number((pipelineConfig.projectedSavings / 12).toFixed(2)),
        pipelineConfig.projectedSavings,
        pipelineConfig.estimatedHitRate,
        wizardPrompt || useCase || '',
      ]);

      const apiKeyPlain = generateApiKey();
      await client.query(`
        INSERT INTO api_keys (
          user_id,
          organization_id,
          key_hash,
          key_prefix,
          name,
          scopes,
          allowed_namespaces,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::jsonb, $7::jsonb, $8
        )
      `, [
        user.id,
        organization.id,
        hashApiKey(apiKeyPlain),
        getKeyPrefix(apiKeyPlain),
        'Starter API Key',
        JSON.stringify(['cache:read', 'cache:write']),
        JSON.stringify(['*']),
        true,
      ]);

      await client.query(`
        INSERT INTO organization_settings (
          organization_id, namespace_strategy, features, preferences
        ) VALUES ($1, $2, $3::jsonb, $4::jsonb)
        ON CONFLICT (organization_id) DO UPDATE
        SET
          namespace_strategy = EXCLUDED.namespace_strategy,
          preferences = EXCLUDED.preferences
      `, [
        organization.id,
        scale === 'multi_customer' ? 'multi_customer' : 'single_tenant',
        JSON.stringify({
          multi_tenant: scale === 'multi_customer',
          sso: requestedPlan === 'enterprise',
          custom_nodes: organizationSector === 'filestorage',
        }),
        JSON.stringify({
          default_sector: organizationSector,
          namespace_strategy: namespaceStrategy,
        }),
      ]);

      return {
        organization,
        pipeline: pipelineResult.rows[0],
        pipelineConfig,
        apiKeyPlain,
      };
    });

    return res.status(200).json({
      success: true,
      organization: result.organization,
      pipeline: {
        id: result.pipeline.id,
        name: result.pipeline.name,
        description: result.pipeline.description,
        nodes: result.pipelineConfig.nodes,
        connections: result.pipelineConfig.connections,
        estimatedHitRate: result.pipelineConfig.estimatedHitRate,
        projectedSavings: result.pipelineConfig.projectedSavings,
        avgLatency: result.pipelineConfig.avgLatency,
        compliance: result.pipelineConfig.compliance,
      },
      apiKey: result.apiKeyPlain,
      projectedSavings: result.pipelineConfig.projectedSavings,
      dashboard_url: '/portal-dashboard.html',
      nextStep: '/portal-dashboard.html',
    });
  } catch (error) {
    if (error?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }

    if (error?.code === 'ALREADY_COMPLETED') {
      return res.status(409).json({ error: error.message });
    }

    console.error('Onboarding completion error:', error);
    return res.status(500).json({
      error: 'Failed to complete onboarding',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
