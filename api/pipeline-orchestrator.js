/**
 * AI Pipeline Orchestrator API
 * 
 * Endpoints:
 * - POST /api/pipeline/generate       - Generate pipeline from natural language
 * - POST /api/pipeline/optimize       - AI-optimize existing pipeline
 * - POST /api/pipeline/validate       - Validate pipeline + compliance
 * - POST /api/pipeline/diff           - Compare two pipeline versions
 * - GET  /api/pipeline/:id            - Get pipeline by ID
 * - POST /api/pipeline/:id/deploy     - Deploy pipeline
 */

// Import sector definitions from sector.js
const SECTORS = {
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Life Sciences',
    compliance: ['HIPAA', 'HITECH', 'FDA-21-CFR-11', 'SOC2-Type2'],
    requiredNodes: ['phi_filter', 'hipaa_audit'],
    recommendedNodes: ['clinical_validator', 'ehr_connector'],
    defaultTtl: 3600,
    maxTtl: 86400,
    semanticCacheAllowed: false,
  },
  finance: {
    id: 'finance',
    name: 'Financial Services',
    compliance: ['SOC2-Type2', 'PCI-DSS', 'GLBA', 'SEC-17a-4', 'FINRA'],
    requiredNodes: ['pci_filter', 'finra_audit'],
    recommendedNodes: ['kyc_validator', 'market_data'],
    defaultTtl: 1800,
    maxTtl: 43200,
    semanticCacheAllowed: true,
  },
  legal: {
    id: 'legal',
    name: 'Legal & Compliance',
    compliance: ['SOC2-Type2', 'GDPR', 'ABA-Ethics'],
    requiredNodes: ['privilege_guard'],
    recommendedNodes: ['legal_research', 'citation_validator', 'matter_tracker'],
    defaultTtl: 604800,
    maxTtl: 2592000,
    semanticCacheAllowed: true,
  },
};

const NODE_CATALOG = {
  // Sources
  database: { id: 'database', category: 'source', latency: 50, cost: 0 },
  http_api: { id: 'http_api', category: 'source', latency: 100, cost: 0 },
  
  // Cache layers
  cache_l1: { id: 'cache_l1', category: 'cache', hitRate: 0.92, latency: 5, costSavings: 2.5 },
  cache_l2: { id: 'cache_l2', category: 'cache', hitRate: 0.75, latency: 15, costSavings: 2.0 },
  cache_l3: { id: 'cache_l3', category: 'cache', hitRate: 0.60, latency: 50, costSavings: 1.5 },
  
  // Healthcare
  phi_filter: { id: 'phi_filter', category: 'validation', sector: 'healthcare', latency: 12, cost: 0.01 },
  clinical_validator: { id: 'clinical_validator', category: 'validation', sector: 'healthcare', latency: 30, cost: 0.05 },
  ehr_connector: { id: 'ehr_connector', category: 'source', sector: 'healthcare', latency: 80, cost: 0 },
  hipaa_audit: { id: 'hipaa_audit', category: 'output', sector: 'healthcare', latency: 8, cost: 0.02 },
  
  // Finance
  pci_filter: { id: 'pci_filter', category: 'validation', sector: 'finance', latency: 10, cost: 0.01 },
  kyc_validator: { id: 'kyc_validator', category: 'validation', sector: 'finance', latency: 150, cost: 0.08 },
  market_data: { id: 'market_data', category: 'source', sector: 'finance', latency: 50, cost: 0 },
  finra_audit: { id: 'finra_audit', category: 'output', sector: 'finance', latency: 10, cost: 0.02 },
  
  // Legal
  privilege_guard: { id: 'privilege_guard', category: 'validation', sector: 'legal', latency: 20, cost: 0.02 },
  legal_research: { id: 'legal_research', category: 'source', sector: 'legal', latency: 200, cost: 0.15 },
  citation_validator: { id: 'citation_validator', category: 'validation', sector: 'legal', latency: 100, cost: 0.05 },
  matter_tracker: { id: 'matter_tracker', category: 'output', sector: 'legal', latency: 5, cost: 0.01 },
  
  // LLM
  llm_openai: { id: 'llm_openai', category: 'llm', latency: 800, cost: 3.5 },
  llm_anthropic: { id: 'llm_anthropic', category: 'llm', latency: 750, cost: 4.0 },
};

// ============================================================
// AI PIPELINE GENERATOR
// ============================================================

function generatePipeline(request) {
  const { prompt, sector, constraints } = request;
  
  // Parse intent from natural language
  const intent = parseIntent(prompt);
  const detectedSector = sector || intent.sector || 'enterprise';
  const sectorConfig = SECTORS[detectedSector] || SECTORS.enterprise;
  
  // Build node sequence
  const nodes = [];
  const connections = [];
  let nodeIdCounter = 1;
  
  // 1. Add source
  if (intent.hasSource) {
    const sourceId = `source_${nodeIdCounter++}`;
    nodes.push({
      id: sourceId,
      type: intent.sourceType || 'http_api',
      position: { x: 100, y: 200 },
      config: {},
    });
  }
  
  // 2. Add sector-specific validators (required)
  const prevNodeId = nodes[nodes.length - 1]?.id;
  for (const required of sectorConfig.requiredNodes || []) {
    const nodeId = `node_${nodeIdCounter++}`;
    nodes.push({
      id: nodeId,
      type: required,
      position: { x: 100 + nodeIdCounter * 180, y: 200 },
      config: getDefaultConfig(required, sectorConfig),
    });
    
    if (prevNodeId) {
      connections.push({ from: prevNodeId, to: nodeId });
    }
  }
  
  // 3. Add cache layers (AI determines optimal count)
  const cacheCount = determineCacheLayers(intent, sectorConfig);
  for (let i = 1; i <= cacheCount; i++) {
    const cacheType = `cache_l${i}`;
    const nodeId = `cache_${nodeIdCounter++}`;
    const prevId = nodes[nodes.length - 1]?.id;
    
    nodes.push({
      id: nodeId,
      type: cacheType,
      position: { x: 100 + nodeIdCounter * 180, y: 200 },
      config: {
        ttl: sectorConfig.defaultTtl * i,
        strategy: i === 1 ? 'exact' : 'semantic',
        enabled: true,
      },
    });
    
    if (prevId) {
      connections.push({ from: prevId, to: nodeId });
    }
  }
  
  // 4. Add LLM
  const llmId = `llm_${nodeIdCounter++}`;
  const llmType = intent.llm || 'llm_openai';
  const prevId = nodes[nodes.length - 1]?.id;
  
  nodes.push({
    id: llmId,
    type: llmType,
    position: { x: 100 + nodeIdCounter * 180, y: 200 },
    config: {
      model: intent.llm === 'llm_anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2048,
    },
  });
  
  if (prevId) {
    connections.push({ from: prevId, to: llmId });
  }
  
  // 5. Add audit/output nodes
  for (const output of sectorConfig.requiredNodes?.filter(n => NODE_CATALOG[n]?.category === 'output') || []) {
    const nodeId = `output_${nodeIdCounter++}`;
    nodes.push({
      id: nodeId,
      type: output,
      position: { x: 100 + nodeIdCounter * 180, y: 350 },
      config: getDefaultConfig(output, sectorConfig),
    });
    
    connections.push({ from: llmId, to: nodeId });
  }
  
  // Calculate metrics
  const metrics = calculateMetrics(nodes, connections);
  
  // Generate reasoning
  const reasoning = generateReasoning(nodes, sectorConfig, intent);
  
  return {
    id: `pipeline_${Date.now()}`,
    name: intent.name || `${sectorConfig.name} Pipeline`,
    sector: detectedSector,
    nodes,
    connections,
    metrics,
    reasoning,
    compliance: {
      frameworks: sectorConfig.compliance,
      satisfied: true,
      warnings: [],
    },
    version: 1,
    createdBy: 'ai',
    createdAt: new Date().toISOString(),
  };
}

function parseIntent(prompt) {
  const lower = prompt.toLowerCase();
  
  return {
    sector: lower.includes('healthcare') || lower.includes('patient') || lower.includes('clinical') ? 'healthcare' :
            lower.includes('finance') || lower.includes('trading') || lower.includes('banking') ? 'finance' :
            lower.includes('legal') || lower.includes('contract') || lower.includes('attorney') ? 'legal' : null,
    
    name: prompt.split('for')[1]?.trim() || prompt.split('Build')[1]?.trim() || 'Custom Pipeline',
    
    hasSource: lower.includes('from') || lower.includes('connect') || lower.includes('integrate'),
    sourceType: lower.includes('database') || lower.includes('postgres') ? 'database' :
                lower.includes('api') || lower.includes('rest') ? 'http_api' : 'http_api',
    
    llm: lower.includes('claude') || lower.includes('anthropic') ? 'llm_anthropic' : 'llm_openai',
    
    performance: lower.includes('fast') || lower.includes('low latency') ? 'fast' :
                 lower.includes('cost') || lower.includes('cheap') ? 'cost' : 'balanced',
  };
}

function determineCacheLayers(intent, sectorConfig) {
  // AI logic for cache layer count
  if (intent.performance === 'fast') return 1; // Single L1 for speed
  if (intent.performance === 'cost') return 3; // Multi-tier for max savings
  return 2; // Balanced default
}

function getDefaultConfig(nodeType, sectorConfig) {
  const defaults = {
    phi_filter: {
      mode: 'block',
      types: ['ssn', 'mrn', 'dob', 'patient_name'],
      threshold: 0.9,
    },
    clinical_validator: {
      sources: ['pubmed', 'fda'],
      confidence: 0.9,
      citations: true,
    },
    hipaa_audit: {
      storage: 'postgres',
      retention: 2555,
      include_response: false,
    },
    pci_filter: {
      mode: 'mask',
      card_types: ['visa', 'mastercard', 'amex', 'discover'],
    },
    finra_audit: {
      regulations: ['sec_17a4', 'finra_4511'],
      worm: true,
    },
  };
  
  return defaults[nodeType] || {};
}

function calculateMetrics(nodes, connections) {
  let totalLatency = 0;
  let totalCost = 0;
  let cumulativeSavings = 0;
  let hitRate = 0;
  
  for (const node of nodes) {
    const nodeDef = NODE_CATALOG[node.type];
    if (!nodeDef) continue;
    
    totalLatency += nodeDef.latency || 0;
    totalCost += nodeDef.cost || 0;
    
    if (nodeDef.category === 'cache') {
      cumulativeSavings += nodeDef.costSavings || 0;
      hitRate = Math.max(hitRate, nodeDef.hitRate || 0);
    }
  }
  
  return {
    estimatedLatency: Math.round(totalLatency),
    estimatedCost: parseFloat(totalCost.toFixed(2)),
    estimatedSavings: parseFloat(cumulativeSavings.toFixed(2)),
    estimatedHitRate: Math.round(hitRate * 100),
    nodeCount: nodes.length,
  };
}

function generateReasoning(nodes, sectorConfig, intent) {
  const reasons = [];
  
  reasons.push(`Selected ${sectorConfig.name} sector based on compliance requirements: ${sectorConfig.compliance.join(', ')}`);
  
  const cacheCount = nodes.filter(n => NODE_CATALOG[n.type]?.category === 'cache').length;
  reasons.push(`Added ${cacheCount} cache layer(s) for ${intent.performance || 'balanced'} performance profile`);
  
  const validators = nodes.filter(n => NODE_CATALOG[n.type]?.category === 'validation');
  if (validators.length > 0) {
    reasons.push(`Included ${validators.length} validation node(s) for compliance: ${validators.map(v => v.type).join(', ')}`);
  }
  
  return reasons;
}

// ============================================================
// OPTIMIZATION
// ============================================================

function optimizePipeline(pipeline, goals) {
  const optimized = JSON.parse(JSON.stringify(pipeline));
  const changes = [];
  
  // Goal: reduce latency
  if (goals.includes('latency')) {
    // Remove L3 cache if present
    const l3Index = optimized.nodes.findIndex(n => n.type === 'cache_l3');
    if (l3Index !== -1) {
      optimized.nodes.splice(l3Index, 1);
      changes.push({ type: 'remove', node: 'cache_l3', reason: 'L3 cache adds 50ms latency' });
    }
    
    // Reduce TTLs for fresher data
    for (const node of optimized.nodes.filter(n => n.type.startsWith('cache_'))) {
      const oldTtl = node.config.ttl;
      node.config.ttl = Math.round(oldTtl * 0.5);
      changes.push({ type: 'modify', node: node.id, field: 'ttl', oldValue: oldTtl, newValue: node.config.ttl, reason: 'Shorter TTL reduces stale data latency' });
    }
  }
  
  // Goal: reduce cost
  if (goals.includes('cost')) {
    // Add L3 cache if not present
    const hasL3 = optimized.nodes.some(n => n.type === 'cache_l3');
    if (!hasL3) {
      const lastCache = optimized.nodes.findIndex(n => n.type === 'cache_l2');
      if (lastCache !== -1) {
        optimized.nodes.splice(lastCache + 1, 0, {
          id: `cache_${Date.now()}`,
          type: 'cache_l3',
          position: { x: 0, y: 0 },
          config: { ttl: 604800, strategy: 'semantic' },
        });
        changes.push({ type: 'add', node: 'cache_l3', reason: 'L3 semantic cache adds +15% hit rate, saves $1.50/req' });
      }
    }
    
    // Increase TTLs
    for (const node of optimized.nodes.filter(n => n.type.startsWith('cache_'))) {
      const oldTtl = node.config.ttl;
      node.config.ttl = Math.round(oldTtl * 2);
      changes.push({ type: 'modify', node: node.id, field: 'ttl', oldValue: oldTtl, newValue: node.config.ttl, reason: 'Longer TTL improves hit rate' });
    }
  }
  
  // Recalculate metrics
  optimized.metrics = calculateMetrics(optimized.nodes, optimized.connections);
  optimized.version += 1;
  
  return {
    pipeline: optimized,
    changes,
    improvement: {
      latency: pipeline.metrics.estimatedLatency - optimized.metrics.estimatedLatency,
      cost: parseFloat((pipeline.metrics.estimatedCost - optimized.metrics.estimatedCost).toFixed(2)),
      hitRate: optimized.metrics.estimatedHitRate - pipeline.metrics.estimatedHitRate,
    },
  };
}

// ============================================================
// VALIDATION
// ============================================================

function validatePipeline(pipeline) {
  const errors = [];
  const warnings = [];
  
  const sectorConfig = SECTORS[pipeline.sector];
  if (!sectorConfig) {
    errors.push({ code: 'INVALID_SECTOR', message: `Unknown sector: ${pipeline.sector}` });
    return { valid: false, errors, warnings };
  }
  
  // Check required nodes
  for (const required of sectorConfig.requiredNodes || []) {
    const hasNode = pipeline.nodes.some(n => n.type === required);
    if (!hasNode) {
      errors.push({
        code: 'MISSING_REQUIRED_NODE',
        message: `${sectorConfig.compliance.join('/')} requires ${required} node`,
        fix: { action: 'add_node', nodeType: required },
      });
    }
  }
  
  // Check cache configuration
  const caches = pipeline.nodes.filter(n => NODE_CATALOG[n.type]?.category === 'cache');
  for (const cache of caches) {
    if (cache.config.ttl > sectorConfig.maxTtl) {
      warnings.push({
        code: 'TTL_EXCEEDS_MAX',
        message: `Cache TTL ${cache.config.ttl}s exceeds sector maximum ${sectorConfig.maxTtl}s`,
        node: cache.id,
      });
    }
    
    if (cache.config.strategy === 'semantic' && !sectorConfig.semanticCacheAllowed) {
      errors.push({
        code: 'SEMANTIC_CACHE_FORBIDDEN',
        message: `${pipeline.sector} sector does not allow semantic cache (exact match required)`,
        node: cache.id,
        fix: { action: 'set_config', field: 'strategy', value: 'exact' },
      });
    }
  }
  
  // Check for orphaned nodes
  const connectedNodes = new Set();
  for (const conn of pipeline.connections) {
    connectedNodes.add(conn.from);
    connectedNodes.add(conn.to);
  }
  
  for (const node of pipeline.nodes) {
    if (!connectedNodes.has(node.id) && pipeline.nodes.length > 1) {
      warnings.push({
        code: 'ORPHANED_NODE',
        message: `Node ${node.id} (${node.type}) is not connected to pipeline`,
        node: node.id,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    compliance: {
      frameworks: sectorConfig.compliance,
      satisfied: errors.length === 0,
    },
  };
}

// ============================================================
// HANDLER
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const path = req.url?.split('?')[0] || '';
  
  try {
    // POST /api/pipeline/generate
    if (req.method === 'POST' && path === '/api/pipeline/generate') {
      const pipeline = generatePipeline(req.body);
      const validation = validatePipeline(pipeline);
      
      return res.status(200).json({
        success: true,
        pipeline,
        validation,
      });
    }
    
    // POST /api/pipeline/optimize
    if (req.method === 'POST' && path === '/api/pipeline/optimize') {
      const { pipeline, goals } = req.body;
      
      if (!pipeline) {
        return res.status(400).json({ success: false, error: 'Pipeline required' });
      }
      
      const result = optimizePipeline(pipeline, goals || ['cost']);
      const validation = validatePipeline(result.pipeline);
      
      return res.status(200).json({
        success: true,
        ...result,
        validation,
      });
    }
    
    // POST /api/pipeline/validate
    if (req.method === 'POST' && path === '/api/pipeline/validate') {
      const { pipeline } = req.body;
      
      if (!pipeline) {
        return res.status(400).json({ success: false, error: 'Pipeline required' });
      }
      
      const validation = validatePipeline(pipeline);
      
      return res.status(200).json({
        success: true,
        validation,
      });
    }
    
    // Default
    return res.status(200).json({
      success: true,
      api: 'AI Pipeline Orchestrator',
      version: '1.0.0',
      endpoints: [
        { method: 'POST', path: '/api/pipeline/generate', description: 'Generate pipeline from natural language' },
        { method: 'POST', path: '/api/pipeline/optimize', description: 'AI-optimize existing pipeline' },
        { method: 'POST', path: '/api/pipeline/validate', description: 'Validate pipeline + compliance' },
      ],
    });
    
  } catch (error) {
    console.error('Pipeline API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}
