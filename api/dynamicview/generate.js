/**
 * Dynamic View Generation API
 * 
 * POST /api/dynamicview/generate
 * 
 * Generates Dynamic View JSON schemas from natural language prompts.
 * Architecture:
 * 1. Primary: Latent Manipulator (sub-200ms, deterministic, cached)
 * 2. Fallback: LLM (GPT-4, higher latency)
 * 3. Anti-cache integration for prompt -> schema mapping
 */

import { validateSchema, sanitizeComponent } from '../../src/dynamicview/schema';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  LATENT_MANIPULATOR_URL: process.env.LATENT_MANIPULATOR_URL || 'http://localhost:8000/generate',
  LATENT_MANIPULATOR_TIMEOUT: 200, // ms
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'openai',
  LLM_API_KEY: process.env.OPENAI_API_KEY,
  LLM_MODEL: 'gpt-4-turbo',
  CACHE_TTL: 3600, // 1 hour
  MAX_PROMPT_LENGTH: 500,
};

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, sector, compliance, useCache = true } = req.body;

    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > CONFIG.MAX_PROMPT_LENGTH) {
      return res.status(400).json({ 
        error: `Prompt too long (max ${CONFIG.MAX_PROMPT_LENGTH} chars)` 
      });
    }

    // Generate prompt hash for caching
    const promptHash = await hashPrompt(prompt, sector, compliance);

    // Check cache first
    if (useCache) {
      const cached = await checkCache(promptHash);
      if (cached) {
        console.log('[DynamicView] Cache hit:', promptHash);
        return res.status(200).json({
          schema: cached.schema,
          metadata: {
            ...cached.metadata,
            cached: true,
            generatedBy: cached.metadata.generatedBy,
            latency: 0,
          }
        });
      }
    }

    // Primary path: Latent Manipulator
    console.log('[DynamicView] Attempting Latent Manipulator generation...');
    const startTime = Date.now();
    
    try {
      const schema = await generateWithLatentManipulator(prompt, sector, compliance);
      const latency = Date.now() - startTime;
      
      console.log(`[DynamicView] Latent Manipulator success (${latency}ms)`);
      
      // Validate generated schema
      const validation = validateSchema(schema);
      if (!validation.valid) {
        throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
      }

      // Cache the result
      if (useCache) {
        await cacheSchema(promptHash, schema, 'latent-manipulator', latency);
      }

      return res.status(200).json({
        schema,
        metadata: {
          generatedBy: 'latent-manipulator',
          generatedAt: Date.now(),
          promptHash,
          cached: false,
          latency,
          freshness: 'fresh'
        }
      });

    } catch (latentError) {
      console.warn('[DynamicView] Latent Manipulator failed:', latentError.message);
      
      // Fallback path: LLM
      console.log('[DynamicView] Falling back to LLM generation...');
      const llmStartTime = Date.now();
      
      try {
        const schema = await generateWithLLM(prompt, sector, compliance);
        const latency = Date.now() - llmStartTime;
        
        console.log(`[DynamicView] LLM success (${latency}ms)`);
        
        // Validate generated schema
        const validation = validateSchema(schema);
        if (!validation.valid) {
          throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
        }

        // Cache the result
        if (useCache) {
          await cacheSchema(promptHash, schema, 'llm', latency);
        }

        return res.status(200).json({
          schema,
          metadata: {
            generatedBy: 'llm',
            generatedAt: Date.now(),
            promptHash,
            cached: false,
            latency,
            freshness: 'fresh'
          }
        });

      } catch (llmError) {
        console.error('[DynamicView] LLM also failed:', llmError.message);
        throw new Error('Both Latent Manipulator and LLM generation failed');
      }
    }

  } catch (error) {
    console.error('[DynamicView] Generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate Dynamic View',
      details: error.message 
    });
  }
}

// ============================================================================
// Generation: Latent Manipulator
// ============================================================================

async function generateWithLatentManipulator(prompt, sector, compliance) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.LATENT_MANIPULATOR_TIMEOUT);

  try {
    const response = await fetch(CONFIG.LATENT_MANIPULATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sector, compliance }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.schema;

  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================================
// Generation: LLM Fallback
// ============================================================================

async function generateWithLLM(prompt, sector, compliance) {
  if (!CONFIG.LLM_API_KEY) {
    throw new Error('LLM API key not configured');
  }

  const systemPrompt = `You are an expert at generating Dynamic View JSON schemas for AgentCache dashboards.

Dynamic View Schema Format:
- Must include: version, id, title, description, root
- Root is a DynamicViewComponent with type and properties
- Available component types: container, row, column, grid, card, button, input, text, heading, badge, metric, chart, progress, node-card, pipeline-diagram
- All components must have an 'id' field
- Use proper nesting for layout components

Example schema:
{
  "version": "1.0",
  "id": "dashboard-1",
  "title": "Pipeline Dashboard",
  "description": "Overview of pipeline performance",
  "root": {
    "id": "root",
    "type": "container",
    "layout": "vertical",
    "children": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Pipeline Dashboard"
      },
      {
        "id": "metrics",
        "type": "grid",
        "columns": 3,
        "children": [
          {
            "id": "metric-1",
            "type": "metric",
            "label": "Hit Rate",
            "value": "94.2%",
            "trend": "up",
            "trendValue": "+3.2%"
          }
        ]
      }
    ]
  }
}

Sector context: ${sector || 'general'}
Compliance: ${compliance?.join(', ') || 'none'}

Return ONLY valid JSON matching the Dynamic View schema format.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: CONFIG.LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in LLM response');
  }

  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// Caching
// ============================================================================

async function hashPrompt(prompt, sector, compliance) {
  const text = `${prompt}|${sector || ''}|${compliance?.join(',') || ''}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkCache(promptHash) {
  // TODO: Integrate with Neon PostgreSQL or Redis
  // For now, return null (no cache)
  return null;
}

async function cacheSchema(promptHash, schema, generatedBy, latency) {
  // TODO: Store in database with TTL
  // Table: dynamicview_cache
  // Columns: prompt_hash, schema_json, generated_by, latency_ms, created_at, expires_at
  console.log(`[DynamicView] Cache write: ${promptHash} (${generatedBy}, ${latency}ms)`);
}

// ============================================================================
// Template Presets
// ============================================================================

export function getTemplateById(templateId) {
  const templates = {
    'pipeline-dashboard': {
      version: '1.0',
      id: 'template-pipeline-dashboard',
      title: 'Pipeline Dashboard',
      description: 'Overview of pipeline performance metrics',
      root: {
        id: 'root',
        type: 'container',
        layout: 'vertical',
        children: [
          {
            id: 'header',
            type: 'heading',
            level: 1,
            content: 'Pipeline Dashboard'
          },
          {
            id: 'metrics-grid',
            type: 'grid',
            columns: 3,
            gap: 4,
            children: [
              {
                id: 'metric-hitrate',
                type: 'metric',
                label: 'Cache Hit Rate',
                value: '94.2%',
                trend: 'up',
                trendValue: '+3.2%'
              },
              {
                id: 'metric-latency',
                type: 'metric',
                label: 'Avg Latency',
                value: '38ms',
                trend: 'down',
                trendValue: '-5ms'
              },
              {
                id: 'metric-cost',
                type: 'metric',
                label: 'Cost Savings',
                value: '$12.8K',
                trend: 'up',
                trendValue: '+$2.1K'
              }
            ]
          }
        ]
      },
      metadata: {
        generatedBy: 'template',
        generatedAt: Date.now()
      }
    },

    'cost-analyzer': {
      version: '1.0',
      id: 'template-cost-analyzer',
      title: 'Cost Analyzer',
      description: 'Real-time cost analysis and savings tracking',
      root: {
        id: 'root',
        type: 'card',
        title: 'Cost Savings Analysis',
        children: [
          {
            id: 'chart',
            type: 'chart',
            chartType: 'line',
            title: 'Cost Trends (30d)',
            data: []
          }
        ]
      },
      metadata: {
        generatedBy: 'template',
        generatedAt: Date.now()
      }
    },

    'compliance-audit': {
      version: '1.0',
      id: 'template-compliance',
      title: 'Compliance Audit Dashboard',
      description: 'Track compliance status across sectors',
      root: {
        id: 'root',
        type: 'container',
        layout: 'vertical',
        children: [
          {
            id: 'header',
            type: 'heading',
            level: 2,
            content: 'Compliance Status'
          },
          {
            id: 'badges-row',
            type: 'row',
            gap: 2,
            children: [
              {
                id: 'badge-hipaa',
                type: 'badge',
                label: 'HIPAA Compliant',
                variant: 'success'
              },
              {
                id: 'badge-pci',
                type: 'badge',
                label: 'PCI-DSS',
                variant: 'success'
              },
              {
                id: 'badge-gdpr',
                type: 'badge',
                label: 'GDPR',
                variant: 'success'
              }
            ]
          }
        ]
      },
      metadata: {
        generatedBy: 'template',
        generatedAt: Date.now()
      }
    }
  };

  return templates[templateId] || null;
}
