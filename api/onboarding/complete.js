import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../../lib/jwt.js';
import { generateStarterPipeline } from '../../lib/pipeline-generator.js';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.DATABASE_URL);

/**
 * POST /api/onboarding/complete
 * Complete user onboarding: create org, pipeline, API key
 * 
 * Body: { sector, useCase, priority, wizardPrompt }
 * Response: { success, organization, pipeline, apiKey, projectedSavings }
 */
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
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;

    // Parse body
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { sector, useCase, priority = 'balanced', wizardPrompt } = body;

    if (!sector) {
      return res.status(400).json({ error: 'Sector is required' });
    }

    // Get user details
    const [user] = await sql`
      SELECT id, email, full_name, onboarding_completed
      FROM users
      WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.onboarding_completed) {
      return res.status(400).json({ error: 'Onboarding already completed' });
    }

    // 1. Create organization
    const orgName = `${user.full_name || user.email.split('@')[0]}'s Organization`;
    const orgSlug = `user-${userId.split('-')[0]}`;

    const [organization] = await sql`
      INSERT INTO organizations (
        name,
        slug,
        sector,
        contact_email,
        contact_name,
        plan_tier,
        max_namespaces,
        max_api_keys,
        max_users,
        onboarding_source
      ) VALUES (
        ${orgName},
        ${orgSlug},
        ${sector},
        ${user.email},
        ${user.full_name},
        'starter',
        10,
        5,
        3,
        'signup_wizard'
      )
      RETURNING *
    `;

    // 2. Assign user to organization
    await sql`
      UPDATE users
      SET organization_id = ${organization.id},
          role = 'owner',
          onboarding_completed = TRUE,
          onboarding_data = ${JSON.stringify({ sector, useCase, priority, wizardPrompt })}::jsonb
      WHERE id = ${userId}
    `;

    // 3. Create default namespaces
    const namespaces = ['production', 'development', 'staging'];
    for (const ns of namespaces) {
      await sql`
        INSERT INTO namespaces (
          organization_id,
          name,
          display_name,
          description
        ) VALUES (
          ${organization.id},
          ${ns},
          ${ns.charAt(0).toUpperCase() + ns.slice(1)},
          ${ns === 'production' ? 'Production environment' : ns === 'development' ? 'Development environment' : 'Staging environment'}
        )
      `;
    }

    // 4. Generate starter pipeline
    const pipelineConfig = generateStarterPipeline(sector, priority);

    const [pipeline] = await sql`
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
        ${userId},
        ${organization.id},
        ${pipelineConfig.name},
        ${pipelineConfig.description},
        ${sector},
        ${JSON.stringify(pipelineConfig.nodes)}::jsonb,
        ${JSON.stringify(pipelineConfig.connections)}::jsonb,
        ${pipelineConfig.complexity},
        ${pipelineConfig.nodes.length * 10},
        ${(pipelineConfig.projectedSavings / 12).toFixed(2)},
        'draft',
        TRUE,
        ${pipelineConfig.projectedSavings},
        ${pipelineConfig.estimatedHitRate},
        ${wizardPrompt || useCase || ''}
      )
      RETURNING *
    `;

    // 5. Generate API key
    const keyPrefix = 'ac_live_';
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const apiKeyPlain = `${keyPrefix}${randomBytes}`;
    const keyHash = await bcrypt.hash(apiKeyPlain, 10);

    await sql`
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
        ${userId},
        ${organization.id},
        ${keyHash},
        ${keyPrefix},
        'Starter API Key',
        '["cache:read", "cache:write"]'::jsonb,
        '["*"]'::jsonb,
        TRUE
      )
    `;

    // 6. Create organization settings
    await sql`
      INSERT INTO organization_settings (
        organization_id,
        features,
        preferences
      ) VALUES (
        ${organization.id},
        '{"multi_tenant": false, "sso": false, "custom_nodes": false}'::jsonb,
        ${JSON.stringify({ default_sector: sector })}::jsonb
      )
      ON CONFLICT (organization_id) DO NOTHING
    `;

    return res.status(200).json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        sector: organization.sector,
      },
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        nodes: pipelineConfig.nodes,
        connections: pipelineConfig.connections,
        estimatedHitRate: pipelineConfig.estimatedHitRate,
        projectedSavings: pipelineConfig.projectedSavings,
        avgLatency: pipelineConfig.avgLatency,
        compliance: pipelineConfig.compliance,
      },
      apiKey: apiKeyPlain, // Only sent once
      projectedSavings: pipelineConfig.projectedSavings,
      nextStep: '/studio.html'
    });

  } catch (error) {
    console.error('Onboarding completion error:', error);
    return res.status(500).json({
      error: 'Failed to complete onboarding',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
