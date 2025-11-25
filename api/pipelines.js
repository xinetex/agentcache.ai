/**
 * Pipelines API
 * CRUD operations for user pipelines with complexity calculation
 */

import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from './auth.js';
import { calculateComplexity, validateComplexityForPlan, suggestOptimizations } from '../lib/complexity-calculator.js';

const sql = neon(process.env.DATABASE_URL);

/**
 * Main API handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Require authentication for all pipeline endpoints
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  const { method, url } = req;
  const path = url.split('?')[0];
  const pathParts = path.split('/').filter(Boolean);
  
  try {
    // GET /api/pipelines - List user's pipelines
    if (method === 'GET' && path === '/api/pipelines') {
      const pipelines = await sql`
        SELECT 
          id,
          name,
          description,
          sector,
          complexity_tier,
          complexity_score,
          monthly_cost,
          status,
          nodes,
          connections,
          features,
          created_at,
          updated_at,
          deployed_at
        FROM pipelines
        WHERE user_id = ${user.id}
          AND status != 'archived'
        ORDER BY 
          CASE status
            WHEN 'active' THEN 1
            WHEN 'draft' THEN 2
            WHEN 'paused' THEN 3
          END,
          created_at DESC
      `;
      
      // Get usage metrics for active pipelines
      const pipelineIds = pipelines.filter(p => p.status === 'active').map(p => p.id);
      
      let metricsMap = {};
      if (pipelineIds.length > 0) {
        const metrics = await sql`
          SELECT 
            pipeline_id,
            SUM(cache_requests) as requests,
            SUM(cache_hits) as hits,
            ROUND(100.0 * SUM(cache_hits) / NULLIF(SUM(cache_requests), 0), 1) as hit_rate,
            SUM(cost_saved) as savings
          FROM usage_metrics
          WHERE pipeline_id = ANY(${pipelineIds})
            AND date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY pipeline_id
        `;
        
        metrics.forEach(m => {
          metricsMap[m.pipeline_id] = {
            requests: parseInt(m.requests) || 0,
            hit_rate: parseFloat(m.hit_rate) || 0,
            savings: parseFloat(m.savings) || 0
          };
        });
      }
      
      // Attach metrics to pipelines
      const enrichedPipelines = pipelines.map(p => ({
        ...p,
        metrics: metricsMap[p.id] || { requests: 0, hit_rate: 0, savings: 0 }
      }));
      
      return res.status(200).json({
        pipelines: enrichedPipelines,
        total: pipelines.length
      });
    }
    
    // GET /api/pipelines/:id - Get single pipeline
    if (method === 'GET' && pathParts.length === 3 && pathParts[1] === 'pipelines') {
      const pipelineId = pathParts[2];
      
      const pipelines = await sql`
        SELECT *
        FROM pipelines
        WHERE id = ${pipelineId} AND user_id = ${user.id}
      `;
      
      if (pipelines.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Pipeline not found'
        });
      }
      
      const pipeline = pipelines[0];
      
      // Get metrics for last 30 days
      const metrics = await sql`
        SELECT 
          date,
          cache_requests,
          cache_hits,
          cost_saved
        FROM usage_metrics
        WHERE pipeline_id = ${pipelineId}
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date ASC
      `;
      
      return res.status(200).json({
        pipeline,
        metrics: metrics.map(m => ({
          date: m.date,
          requests: parseInt(m.cache_requests),
          hits: parseInt(m.cache_hits),
          savings: parseFloat(m.cost_saved)
        }))
      });
    }
    
    // POST /api/pipelines - Create new pipeline
    if (method === 'POST' && path === '/api/pipelines') {
      const { name, description, sector, nodes, connections, features } = req.body;
      
      // Validation
      if (!name || !nodes || !Array.isArray(nodes)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name and nodes array required'
        });
      }
      
      // Calculate complexity
      const complexity = calculateComplexity({
        nodes,
        sector: sector || 'general',
        features: features || []
      });
      
      // Get user's subscription plan
      const subscriptions = await sql`
        SELECT plan_tier
        FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const userPlan = subscriptions.length > 0 ? subscriptions[0].plan_tier : 'starter';
      
      // Validate complexity against plan
      const validation = validateComplexityForPlan(complexity.tier, userPlan);
      
      if (!validation.allowed) {
        return res.status(403).json({
          error: 'Plan limit exceeded',
          message: validation.reason,
          complexity: {
            tier: complexity.tier,
            score: complexity.score,
            cost: complexity.cost
          },
          required_plan: validation.required_plan,
          current_plan: userPlan
        });
      }
      
      // Check pipeline count limit
      const pipelineCounts = await sql`
        SELECT COUNT(*) as count
        FROM pipelines
        WHERE user_id = ${user.id} AND status != 'archived'
      `;
      
      const pipelineCount = parseInt(pipelineCounts[0].count);
      const limits = {
        starter: 3,
        professional: 10,
        enterprise: Infinity
      };
      
      if (pipelineCount >= limits[userPlan]) {
        return res.status(403).json({
          error: 'Plan limit exceeded',
          message: `Your ${userPlan} plan allows ${limits[userPlan]} pipelines. Upgrade to add more.`,
          current_count: pipelineCount,
          limit: limits[userPlan]
        });
      }
      
      // Create pipeline
      const newPipelines = await sql`
        INSERT INTO pipelines (
          user_id,
          name,
          description,
          sector,
          nodes,
          connections,
          features,
          complexity_tier,
          complexity_score,
          monthly_cost,
          status
        )
        VALUES (
          ${user.id},
          ${name},
          ${description || null},
          ${sector || 'general'},
          ${JSON.stringify(nodes)},
          ${JSON.stringify(connections || [])},
          ${JSON.stringify(features || [])},
          ${complexity.tier},
          ${complexity.score},
          ${complexity.cost},
          'draft'
        )
        RETURNING *
      `;
      
      const pipeline = newPipelines[0];
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES (
          ${user.id},
          'pipeline.created',
          'pipeline',
          ${pipeline.id},
          ${JSON.stringify({ complexity: complexity.tier, cost: complexity.cost })}
        )
      `;
      
      // Get optimization suggestions
      const optimizations = suggestOptimizations(
        { nodes, sector: sector || 'general', features: features || [] },
        complexity
      );
      
      return res.status(201).json({
        pipeline,
        complexity: {
          tier: complexity.tier,
          score: complexity.score,
          cost: complexity.cost,
          breakdown: complexity.breakdown,
          description: complexity.description
        },
        optimizations
      });
    }
    
    // PUT /api/pipelines/:id - Update pipeline
    if (method === 'PUT' && pathParts.length === 3 && pathParts[1] === 'pipelines') {
      const pipelineId = pathParts[2];
      const { name, description, sector, nodes, connections, features, status } = req.body;
      
      // Check ownership
      const existing = await sql`
        SELECT * FROM pipelines
        WHERE id = ${pipelineId} AND user_id = ${user.id}
      `;
      
      if (existing.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Pipeline not found'
        });
      }
      
      const pipeline = existing[0];
      
      // Recalculate complexity if structure changed
      let complexity = {
        tier: pipeline.complexity_tier,
        score: pipeline.complexity_score,
        cost: pipeline.monthly_cost
      };
      
      if (nodes || sector || features) {
        complexity = calculateComplexity({
          nodes: nodes || pipeline.nodes,
          sector: sector || pipeline.sector,
          features: features || pipeline.features
        });
        
        // Validate if complexity increased
        if (complexity.tier !== pipeline.complexity_tier) {
          const subscriptions = await sql`
            SELECT plan_tier FROM subscriptions
            WHERE user_id = ${user.id} AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
          `;
          
          const userPlan = subscriptions[0]?.plan_tier || 'starter';
          const validation = validateComplexityForPlan(complexity.tier, userPlan);
          
          if (!validation.allowed) {
            return res.status(403).json({
              error: 'Plan limit exceeded',
              message: validation.reason,
              complexity,
              required_plan: validation.required_plan
            });
          }
        }
      }
      
      // Update pipeline
      const updated = await sql`
        UPDATE pipelines
        SET
          name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          sector = COALESCE(${sector}, sector),
          nodes = COALESCE(${nodes ? JSON.stringify(nodes) : null}, nodes),
          connections = COALESCE(${connections ? JSON.stringify(connections) : null}, connections),
          features = COALESCE(${features ? JSON.stringify(features) : null}, features),
          complexity_tier = ${complexity.tier},
          complexity_score = ${complexity.score},
          monthly_cost = ${complexity.cost},
          status = COALESCE(${status}, status),
          deployed_at = CASE WHEN ${status} = 'active' AND status != 'active' THEN NOW() ELSE deployed_at END
        WHERE id = ${pipelineId}
        RETURNING *
      `;
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES (
          ${user.id},
          'pipeline.updated',
          'pipeline',
          ${pipelineId},
          ${JSON.stringify({ 
            status_change: status !== pipeline.status ? { from: pipeline.status, to: status } : null,
            complexity_change: complexity.tier !== pipeline.complexity_tier ? { from: pipeline.complexity_tier, to: complexity.tier } : null
          })}
        )
      `;
      
      return res.status(200).json({
        pipeline: updated[0],
        complexity: {
          tier: complexity.tier,
          score: complexity.score,
          cost: complexity.cost
        }
      });
    }
    
    // DELETE /api/pipelines/:id - Archive pipeline
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'pipelines') {
      const pipelineId = pathParts[2];
      
      // Check ownership
      const existing = await sql`
        SELECT * FROM pipelines
        WHERE id = ${pipelineId} AND user_id = ${user.id}
      `;
      
      if (existing.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Pipeline not found'
        });
      }
      
      // Soft delete (archive)
      await sql`
        UPDATE pipelines
        SET status = 'archived'
        WHERE id = ${pipelineId}
      `;
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
        VALUES (${user.id}, 'pipeline.archived', 'pipeline', ${pipelineId})
      `;
      
      return res.status(200).json({
        message: 'Pipeline archived successfully'
      });
    }
    
    // Route not found
    return res.status(404).json({
      error: 'Not found',
      message: 'Pipeline endpoint not found'
    });
    
  } catch (error) {
    console.error('Pipelines API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
