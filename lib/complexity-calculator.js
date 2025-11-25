/**
 * Pipeline Complexity Calculator
 * Analyzes pipeline configuration to determine complexity tier and cost
 * Used for hybrid billing: base subscription + per-pipeline pricing
 */

// Pricing tiers and costs
export const COMPLEXITY_TIERS = {
  simple: {
    cost: 0,
    max_nodes: 5,
    allowed_sectors: ['general'],
    description: 'Basic caching with up to 5 nodes'
  },
  moderate: {
    cost: 25,
    max_nodes: 10,
    allowed_sectors: ['healthcare', 'finance', 'legal', 'education', 'ecommerce'],
    description: 'Sector-specific pipelines with compliance features'
  },
  complex: {
    cost: 75,
    max_nodes: 20,
    allowed_sectors: ['any'],
    features_required: ['audit_logging', 'compliance_validation'],
    description: 'Advanced governance and compliance'
  },
  enterprise: {
    cost: 150,
    max_nodes: Infinity,
    allowed_sectors: ['any'],
    features_required: ['full_audit', 'rbac', 'multi_region'],
    description: 'Unlimited with dedicated infrastructure'
  }
};

// Node type weights for complexity scoring
const NODE_WEIGHTS = {
  // Source nodes
  http_api: 1,
  database: 2,
  websocket: 3,
  ehr_connector: 5,        // Healthcare
  market_data: 5,          // Finance
  legal_system: 5,         // Legal
  student_system: 4,       // Education
  product_catalog: 3,      // E-commerce
  warehouse_api: 4,        // Enterprise
  jupyter_connector: 4,    // Data Science
  git_repository: 3,       // Developer
  
  // Validation nodes (high value - compliance)
  phi_filter: 10,          // HIPAA
  pci_filter: 10,          // PCI-DSS
  pii_validator: 8,
  clinical_validator: 8,
  privilege_guard: 8,      // Legal privilege
  gdpr_validator: 9,
  content_filter: 6,
  input_sanitizer: 5,
  
  // Cache nodes
  cache_l1: 1,
  cache_l2: 3,
  cache_l3: 5,
  semantic_cache: 4,
  vector_cache: 5,
  
  // LLM nodes
  llm_basic: 2,            // GPT-3.5, Gemini Flash
  llm_advanced: 4,         // GPT-4, Claude 3.5 Sonnet
  llm_reasoning: 8,        // o1, DeepSeek
  embedding_model: 3,
  
  // Audit/Compliance nodes (highest value)
  hipaa_audit: 15,
  finra_audit: 15,
  sox_audit: 14,
  gdpr_logger: 12,
  matter_tracker: 10,      // Legal
  ferpa_logger: 11,        // Education
  iso_audit: 13,
  
  // Output nodes
  http_response: 1,
  database_write: 2,
  webhook: 2,
  notification: 2,
  
  // Advanced features
  rate_limiter: 3,
  circuit_breaker: 3,
  retry_handler: 2,
  transformer: 4,
  aggregator: 4,
  router: 5
};

// Sector multipliers (regulatory burden)
const SECTOR_MULTIPLIERS = {
  general: 1.0,
  healthcare: 1.5,      // HIPAA
  finance: 1.5,         // PCI/SOX/FINRA
  legal: 1.3,           // Privilege protection
  education: 1.2,       // FERPA
  ecommerce: 1.1,       // PCI-DSS lite
  enterprise: 1.4,      // Advanced governance
  developer: 1.0,       // No special compliance
  datascience: 1.1      // Data governance
};

// Feature weights
const FEATURE_WEIGHTS = {
  multi_region: 20,
  rbac: 15,
  sso: 10,
  audit_logging: 12,
  compliance_validation: 10,
  semantic_search: 5,
  vector_search: 6,
  custom_models: 8,
  dedicated_infrastructure: 25,
  sla_guarantees: 15,
  white_glove_support: 10
};

/**
 * Calculate pipeline complexity score and tier
 * @param {Object} pipeline - Pipeline configuration
 * @param {Array} pipeline.nodes - Array of node objects
 * @param {string} pipeline.sector - Sector identifier
 * @param {Array} pipeline.features - Array of feature flags
 * @returns {Object} - { tier, score, cost, breakdown }
 */
export function calculateComplexity(pipeline) {
  if (!pipeline || !pipeline.nodes || !Array.isArray(pipeline.nodes)) {
    throw new Error('Invalid pipeline: nodes array required');
  }
  
  let score = 0;
  const breakdown = {
    base_score: 0,
    node_weights: 0,
    sector_multiplier: 1.0,
    feature_bonus: 0
  };
  
  // 1. Base score from node count
  breakdown.base_score = pipeline.nodes.length * 2;
  score += breakdown.base_score;
  
  // 2. Sum node type weights
  pipeline.nodes.forEach(node => {
    const weight = NODE_WEIGHTS[node.type] || 1;
    breakdown.node_weights += weight;
  });
  score += breakdown.node_weights;
  
  // 3. Apply sector multiplier
  const sector = pipeline.sector || 'general';
  breakdown.sector_multiplier = SECTOR_MULTIPLIERS[sector] || 1.0;
  score = Math.floor(score * breakdown.sector_multiplier);
  
  // 4. Add feature bonuses
  if (pipeline.features && Array.isArray(pipeline.features)) {
    pipeline.features.forEach(feature => {
      const weight = FEATURE_WEIGHTS[feature] || 0;
      breakdown.feature_bonus += weight;
    });
    score += breakdown.feature_bonus;
  }
  
  // 5. Determine tier based on score
  let tier;
  if (score <= 20) {
    tier = 'simple';
  } else if (score <= 50) {
    tier = 'moderate';
  } else if (score <= 100) {
    tier = 'complex';
  } else {
    tier = 'enterprise';
  }
  
  // 6. Get cost for tier
  const cost = COMPLEXITY_TIERS[tier].cost;
  
  return {
    tier,
    score,
    cost,
    breakdown,
    description: COMPLEXITY_TIERS[tier].description
  };
}

/**
 * Validate if pipeline complexity is allowed for user's plan
 * @param {string} complexity_tier - Calculated complexity tier
 * @param {string} user_plan - User's subscription plan
 * @returns {Object} - { allowed, reason, upgrade_required }
 */
export function validateComplexityForPlan(complexity_tier, user_plan) {
  const planLimits = {
    starter: {
      max_complexity: 'simple',
      max_pipelines: 3
    },
    professional: {
      max_complexity: 'moderate',
      max_pipelines: 10
    },
    enterprise: {
      max_complexity: 'enterprise',
      max_pipelines: Infinity
    }
  };
  
  const limits = planLimits[user_plan] || planLimits.starter;
  const tierOrder = ['simple', 'moderate', 'complex', 'enterprise'];
  
  const userMaxIndex = tierOrder.indexOf(limits.max_complexity);
  const pipelineIndex = tierOrder.indexOf(complexity_tier);
  
  if (pipelineIndex <= userMaxIndex) {
    return {
      allowed: true,
      reason: null,
      upgrade_required: false
    };
  }
  
  // Find minimum required plan
  let requiredPlan = 'enterprise';
  if (complexity_tier === 'moderate') requiredPlan = 'professional';
  if (complexity_tier === 'simple') requiredPlan = 'starter';
  
  return {
    allowed: false,
    reason: `This ${complexity_tier} pipeline requires ${requiredPlan} plan or higher`,
    upgrade_required: true,
    required_plan: requiredPlan
  };
}

/**
 * Suggest optimizations to reduce pipeline complexity/cost
 * @param {Object} pipeline - Pipeline configuration
 * @param {Object} complexity - Current complexity result
 * @returns {Array} - Array of optimization suggestions
 */
export function suggestOptimizations(pipeline, complexity) {
  const suggestions = [];
  
  // If already simple, no optimizations needed
  if (complexity.tier === 'simple') {
    return [];
  }
  
  // Check if removing expensive audit nodes would help
  const auditNodes = pipeline.nodes.filter(n => 
    n.type.includes('audit') || n.type.includes('logger')
  );
  if (auditNodes.length > 0) {
    const savings = auditNodes.reduce((sum, n) => sum + (NODE_WEIGHTS[n.type] || 0), 0);
    suggestions.push({
      type: 'remove_nodes',
      nodes: auditNodes.map(n => n.id),
      description: `Remove audit logging nodes → reduces score by ${savings} points`,
      impact: `Could reduce tier from ${complexity.tier} to ${predictNewTier(complexity.score - savings)}`,
      cost_savings: COMPLEXITY_TIERS[complexity.tier].cost - COMPLEXITY_TIERS[predictNewTier(complexity.score - savings)].cost
    });
  }
  
  // Check sector switch
  if (pipeline.sector !== 'general' && SECTOR_MULTIPLIERS[pipeline.sector] > 1.0) {
    const generalScore = Math.floor((complexity.score / SECTOR_MULTIPLIERS[pipeline.sector]) * SECTOR_MULTIPLIERS.general);
    suggestions.push({
      type: 'change_sector',
      from: pipeline.sector,
      to: 'general',
      description: `Switch to general sector → reduces multiplier from ${SECTOR_MULTIPLIERS[pipeline.sector]}x to 1.0x`,
      impact: `Score would be ${generalScore} instead of ${complexity.score}`,
      cost_savings: COMPLEXITY_TIERS[complexity.tier].cost - COMPLEXITY_TIERS[predictNewTier(generalScore)].cost
    });
  }
  
  // Check feature removals
  if (pipeline.features && pipeline.features.length > 0) {
    const expensiveFeatures = pipeline.features.filter(f => FEATURE_WEIGHTS[f] >= 10);
    if (expensiveFeatures.length > 0) {
      const savings = expensiveFeatures.reduce((sum, f) => sum + FEATURE_WEIGHTS[f], 0);
      suggestions.push({
        type: 'remove_features',
        features: expensiveFeatures,
        description: `Remove advanced features (${expensiveFeatures.join(', ')}) → saves ${savings} points`,
        impact: `Could reduce tier from ${complexity.tier} to ${predictNewTier(complexity.score - savings)}`
      });
    }
  }
  
  // Suggest plan upgrade if optimizations don't help much
  if (complexity.tier === 'enterprise' && suggestions.every(s => s.cost_savings < 50)) {
    suggestions.push({
      type: 'upgrade_plan',
      description: `Upgrade to Enterprise plan → get unlimited ${complexity.tier} pipelines for flat $499/mo`,
      impact: 'No per-pipeline charges, better value at scale'
    });
  }
  
  return suggestions.filter(s => s.cost_savings > 0 || s.type === 'upgrade_plan');
}

/**
 * Predict new tier based on score
 * @param {number} score - Complexity score
 * @returns {string} - Predicted tier
 */
function predictNewTier(score) {
  if (score <= 20) return 'simple';
  if (score <= 50) return 'moderate';
  if (score <= 100) return 'complex';
  return 'enterprise';
}

/**
 * Calculate monthly cost for user's pipelines
 * @param {Array} pipelines - Array of pipeline objects
 * @param {string} base_plan - User's base plan tier
 * @returns {Object} - Cost breakdown
 */
export function calculateMonthlyBill(pipelines, base_plan) {
  const basePrices = {
    starter: 49,
    professional: 149,
    enterprise: 499
  };
  
  const base_cost = basePrices[base_plan] || 49;
  let pipeline_costs = 0;
  const line_items = [];
  
  pipelines.forEach(pipeline => {
    if (pipeline.status === 'active' && pipeline.monthly_cost > 0) {
      pipeline_costs += pipeline.monthly_cost;
      line_items.push({
        type: 'pipeline',
        name: pipeline.name,
        complexity: pipeline.complexity_tier,
        cost: pipeline.monthly_cost
      });
    }
  });
  
  return {
    base_plan,
    base_cost,
    pipeline_costs,
    total: base_cost + pipeline_costs,
    line_items
  };
}

// Export for testing
export const __testing = {
  NODE_WEIGHTS,
  SECTOR_MULTIPLIERS,
  FEATURE_WEIGHTS,
  predictNewTier
};
