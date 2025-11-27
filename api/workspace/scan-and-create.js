/**
 * POST /api/workspace/scan-and-create
 * Scans customer's project and auto-generates a complete workspace pipeline
 * 
 * Flow:
 * 1. Scan GitHub repo or analyze tech stack
 * 2. AI generates recommendations (namespaces, nodes, mesh network)
 * 3. Auto-generate Studio pipeline with proper nodes/edges
 * 4. Save to workspace (localStorage or DB)
 * 5. Return workspace ID + preview data
 */

export const config = {
  runtime: 'nodejs'
};

import { createWizard } from '../../lib/wizard-framework.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scanInput, workspaceName } = req.body;
    
    // Validate input
    if (!scanInput || (!scanInput.github_url && !scanInput.tech_stack)) {
      return res.status(400).json({
        error: 'Missing scan input',
        message: 'Provide either github_url or tech_stack'
      });
    }

    // Initialize ProjectScannerWizard
    const scanner = createWizard('projectScanner');

    // Step 1: Scan project
    const scanResults = await scanner.scanProject({
      type: scanInput.github_url ? 'github' : 'manual',
      data: scanInput.github_url || scanInput.tech_stack
    });

    // Step 2: Generate recommendations
    const recommendations = await scanner.generateRecommendations(scanResults);

    // Step 3: Generate integration code
    const integrationCode = await scanner.generateIntegrationCode(
      scanResults, 
      recommendations
    );

    // Step 4: Generate mesh network visualization
    const meshNetwork = scanner.generateMeshNetworkVisualization(
      scanResults,
      recommendations
    );

    // Step 5: Auto-generate Studio pipeline
    const pipeline = generateStudioPipeline(
      workspaceName || `${scanResults.repo || 'Project'} Pipeline`,
      scanResults,
      recommendations
    );

    // Step 6: Calculate metrics
    const metrics = calculatePipelineMetrics(pipeline, recommendations);

    // Return complete workspace data
    return res.status(200).json({
      success: true,
      workspace: {
        id: generateWorkspaceId(),
        name: pipeline.name,
        sector: recommendations.sector,
        pipeline,
        scanResults,
        recommendations,
        integrationCode,
        meshNetwork,
        metrics,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Scan and create error:', error);
    return res.status(500).json({
      error: 'Scan failed',
      message: error.message
    });
  }
}

/**
 * Generate Studio-compatible pipeline from scan results
 */
function generateStudioPipeline(name, scanResults, recommendations) {
  const { sector, namespaces, cache_tiers, integration_points } = recommendations;
  const { storage_apis = [], llm_usage = [] } = scanResults;

  const nodes = [];
  const edges = [];
  let nodeId = 0;
  let yPosition = 100;

  // 1. Add source nodes (storage/database connections)
  storage_apis.forEach((api, i) => {
    const sourceNode = {
      id: `node_${nodeId++}`,
      type: 'http_api',
      position: { x: 100, y: yPosition + (i * 120) },
      data: {
        label: api.name || api,
        config: {
          api_type: 'storage',
          provider: api.provider || 'custom'
        }
      }
    };
    nodes.push(sourceNode);
  });

  // 2. Add cache tier nodes
  const cacheStartX = 400;
  const cacheNodes = [];
  
  ['L1 Cache', 'L2 Vector', 'Latent Manipulator'].forEach((tier, i) => {
    const tierInfo = cache_tiers.find(t => t.name === tier);
    const cacheNode = {
      id: `node_${nodeId++}`,
      type: tier === 'L1 Cache' ? 'cache_l1' : tier === 'L2 Vector' ? 'cache_l2' : 'latent_manipulator',
      position: { x: cacheStartX + (i * 200), y: 200 },
      data: {
        label: tier,
        config: {
          latency: tierInfo?.latency || '50ms',
          hit_rate: tierInfo?.hit_rate || '92%'
        }
      }
    };
    nodes.push(cacheNode);
    cacheNodes.push(cacheNode);
  });

  // 3. Add sector-specific nodes
  const sectorNodes = getSectorSpecificNodes(sector);
  sectorNodes.forEach((nodeType, i) => {
    const sectorNode = {
      id: `node_${nodeId++}`,
      type: nodeType,
      position: { x: 400, y: 400 + (i * 100) },
      data: {
        label: formatNodeLabel(nodeType),
        config: {}
      }
    };
    nodes.push(sectorNode);
  });

  // 4. Add LLM fallback node
  if (llm_usage.length > 0) {
    const llmNode = {
      id: `node_${nodeId++}`,
      type: 'llm_openai',
      position: { x: 1000, y: 300 },
      data: {
        label: llm_usage[0].provider || 'OpenAI GPT-4',
        config: {
          model: 'gpt-4',
          fallback: true
        }
      }
    };
    nodes.push(llmNode);
  }

  // 5. Generate edges (connections)
  // Connect sources to first cache tier
  nodes.filter(n => n.type === 'http_api').forEach(source => {
    if (cacheNodes.length > 0) {
      edges.push({
        id: `edge_${edges.length}`,
        source: source.id,
        target: cacheNodes[0].id,
        type: 'default',
        animated: true
      });
    }
  });

  // Connect cache tiers in sequence
  for (let i = 0; i < cacheNodes.length - 1; i++) {
    edges.push({
      id: `edge_${edges.length}`,
      source: cacheNodes[i].id,
      target: cacheNodes[i + 1].id,
      type: 'default',
      label: 'miss',
      animated: false
    });
  }

  // Connect last cache tier to LLM fallback
  const llmNode = nodes.find(n => n.type === 'llm_openai');
  if (llmNode && cacheNodes.length > 0) {
    edges.push({
      id: `edge_${edges.length}`,
      source: cacheNodes[cacheNodes.length - 1].id,
      target: llmNode.id,
      type: 'default',
      label: 'fallback',
      animated: false,
      style: { strokeDasharray: '5,5' }
    });
  }

  return {
    name,
    sector,
    nodes,
    edges,
    isActive: false,
    savedAt: new Date().toISOString(),
    source: 'scan',
    metadata: {
      scanned: true,
      github_repo: scanResults.repo,
      languages: scanResults.languages,
      storage_apis: storage_apis.map(api => api.name || api)
    }
  };
}

/**
 * Get sector-specific node types
 */
function getSectorSpecificNodes(sector) {
  const sectorNodes = {
    filestorage: ['file_dedup_cache', 'cdn_accelerator', 'audit_log_cache'],
    healthcare: ['phi_filter', 'hipaa_audit', 'ehr_connector'],
    finance: ['pci_filter', 'finra_audit', 'market_data'],
    legal: ['privilege_guard', 'legal_research', 'matter_tracker'],
    education: ['ferpa_filter', 'lms_connector'],
    ecommerce: ['product_cache', 'inventory_sync'],
    enterprise: ['sso_auth', 'rbac_filter'],
    developer: ['api_cache', 'code_search'],
    datascience: ['feature_cache', 'model_cache'],
    government: ['cui_filter', 'fedramp_audit'],
    general: ['api_cache', 'db_cache']
  };

  return sectorNodes[sector] || sectorNodes.general;
}

/**
 * Format node type into human-readable label
 */
function formatNodeLabel(nodeType) {
  return nodeType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate pipeline metrics
 */
function calculatePipelineMetrics(pipeline, recommendations) {
  const { estimated_savings } = recommendations;
  
  return {
    nodeCount: pipeline.nodes.length,
    edgeCount: pipeline.edges.length,
    cacheCount: pipeline.nodes.filter(n => n.type.includes('cache')).length,
    complexity: determineComplexity(pipeline.nodes.length),
    estimatedSavings: formatSavings(estimated_savings),
    estimatedLatency: '50ms',
    estimatedHitRate: '92%'
  };
}

/**
 * Determine pipeline complexity
 */
function determineComplexity(nodeCount) {
  if (nodeCount <= 5) return 'simple';
  if (nodeCount <= 10) return 'moderate';
  return 'complex';
}

/**
 * Format savings for display
 */
function formatSavings(savings) {
  if (!savings) return '$5,000/mo';
  return `$${savings.monthly_savings.toLocaleString()}/mo`;
}

/**
 * Generate unique workspace ID
 */
function generateWorkspaceId() {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
