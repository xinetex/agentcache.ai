/**
 * Sector-Aware Configuration System
 * 
 * AgentCache self-adjusts based on detected industry/use case.
 * Each sector has specific requirements for:
 * - Compliance (HIPAA, SOC2, GDPR, PCI-DSS, etc.)
 * - Data retention and TTL policies
 * - PII handling and redaction
 * - Audit logging requirements
 * - Cache validation strategies
 * - Response quality thresholds
 */

// ============================================================
// SECTOR DEFINITIONS
// ============================================================

export interface SectorProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  
  // Compliance requirements
  compliance: {
    frameworks: string[];           // HIPAA, SOC2, GDPR, PCI-DSS, FERPA, etc.
    dataResidency: boolean;         // Must data stay in specific region?
    auditLogging: 'none' | 'basic' | 'full' | 'immutable';
    retentionDays: number;          // How long to keep audit logs
  };
  
  // Cache behavior
  cache: {
    defaultTtl: number;             // Default TTL in seconds
    maxTtl: number;                 // Maximum allowed TTL
    minTtl: number;                 // Minimum TTL (for freshness)
    semanticThreshold: number;      // Similarity threshold for semantic cache (0-1)
    allowSemanticCache: boolean;    // Some sectors require exact match only
  };
  
  // Data handling
  data: {
    piiDetection: 'none' | 'warn' | 'redact' | 'block';
    sensitiveFields: string[];      // Fields to always redact
    encryptionRequired: boolean;
    anonymization: boolean;
  };
  
  // Quality gates
  validation: {
    cognitiveValidation: boolean;   // Validate against knowledge base
    hallucinationCheck: boolean;    // Run hallucination detection
    confidenceThreshold: number;    // Min confidence to cache (0-1)
    humanReviewThreshold: number;   // Below this, flag for human review
    citationsRequired: boolean;     // Must responses include sources?
  };
  
  // Performance targets
  performance: {
    maxLatencyMs: number;           // Alert if exceeded
    targetHitRate: number;          // Expected hit rate (%)
    costAlertThreshold: number;     // Daily cost alert ($)
  };
  
  // Recommended nodes for this sector
  recommendedPipeline: {
    nodes: string[];
    templates: string[];
  };
  
  // Detection patterns
  detection: {
    keywords: string[];             // Keywords in queries that suggest this sector
    namespacePatterns: string[];    // Namespace patterns (e.g., "healthcare/*")
    envVariables: string[];         // Environment variables that indicate sector
  };
}

// ============================================================
// SECTOR PROFILES
// ============================================================

export const SECTOR_PROFILES: Record<string, SectorProfile> = {
  
  // ------------------------------------------------------------
  // HEALTHCARE & LIFE SCIENCES
  // ------------------------------------------------------------
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Life Sciences',
    icon: '🏥',
    description: 'HIPAA-compliant caching for medical AI, clinical decision support, patient data',
    
    compliance: {
      frameworks: ['HIPAA', 'HITECH', 'FDA-21-CFR-11', 'SOC2-Type2'],
      dataResidency: true,
      auditLogging: 'immutable',
      retentionDays: 2555, // 7 years for HIPAA
    },
    
    cache: {
      defaultTtl: 3600,           // 1 hour - medical info changes
      maxTtl: 86400,              // 24 hours max
      minTtl: 300,                // At least 5 min for freshness
      semanticThreshold: 0.95,    // Very high - medical accuracy critical
      allowSemanticCache: false,  // Exact match only for patient queries
    },
    
    data: {
      piiDetection: 'block',      // Block any PII/PHI from caching
      sensitiveFields: ['patient_id', 'ssn', 'dob', 'mrn', 'diagnosis', 'medication'],
      encryptionRequired: true,
      anonymization: true,
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.9,   // High confidence required
      humanReviewThreshold: 0.7,  // Low confidence = human review
      citationsRequired: true,    // Must cite medical sources
    },
    
    performance: {
      maxLatencyMs: 2000,         // Clinical apps need speed
      targetHitRate: 60,          // Lower due to personalized queries
      costAlertThreshold: 500,
    },
    
    recommendedPipeline: {
      nodes: ['validation_pii', 'cache_l2', 'validation_cognitive', 'llm_anthropic'],
      templates: ['enterprise-compliance'],
    },
    
    detection: {
      keywords: ['patient', 'diagnosis', 'clinical', 'medical', 'health', 'symptoms', 'treatment', 'prescription'],
      namespacePatterns: ['healthcare/*', 'medical/*', 'clinical/*', 'health/*'],
      envVariables: ['HIPAA_MODE', 'HEALTHCARE_API_KEY'],
    },
  },
  
  // ------------------------------------------------------------
  // FINANCIAL SERVICES
  // ------------------------------------------------------------
  finance: {
    id: 'finance',
    name: 'Financial Services',
    icon: '🏦',
    description: 'SOC2/PCI-DSS compliant for banking, trading, insurance, fintech',
    
    compliance: {
      frameworks: ['SOC2-Type2', 'PCI-DSS', 'GLBA', 'SEC-17a-4', 'FINRA'],
      dataResidency: true,
      auditLogging: 'immutable',
      retentionDays: 2555, // 7 years for SEC
    },
    
    cache: {
      defaultTtl: 1800,           // 30 min - market data changes
      maxTtl: 43200,              // 12 hours max
      minTtl: 60,                 // 1 min minimum for pricing
      semanticThreshold: 0.92,
      allowSemanticCache: true,   // OK for research queries
    },
    
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['account_number', 'ssn', 'card_number', 'routing', 'balance'],
      encryptionRequired: true,
      anonymization: true,
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.85,
      humanReviewThreshold: 0.6,
      citationsRequired: true,    // Regulatory requirement
    },
    
    performance: {
      maxLatencyMs: 500,          // Trading needs speed
      targetHitRate: 75,
      costAlertThreshold: 1000,
    },
    
    recommendedPipeline: {
      nodes: ['validation_pii', 'cache_l1', 'cache_l2', 'validation_cognitive', 'output_analytics'],
      templates: ['enterprise-compliance'],
    },
    
    detection: {
      keywords: ['portfolio', 'trading', 'investment', 'loan', 'mortgage', 'credit', 'account', 'transaction'],
      namespacePatterns: ['finance/*', 'banking/*', 'trading/*', 'fintech/*'],
      envVariables: ['PLAID_API_KEY', 'STRIPE_SECRET_KEY', 'FINRA_COMPLIANCE'],
    },
  },
  
  // ------------------------------------------------------------
  // LEGAL
  // ------------------------------------------------------------
  legal: {
    id: 'legal',
    name: 'Legal & Compliance',
    icon: '⚖️',
    description: 'Attorney-client privilege protection, contract analysis, legal research',
    
    compliance: {
      frameworks: ['SOC2-Type2', 'GDPR', 'ABA-Ethics'],
      dataResidency: true,
      auditLogging: 'full',
      retentionDays: 3650, // 10 years for legal docs
    },
    
    cache: {
      defaultTtl: 604800,         // 1 week - legal precedent stable
      maxTtl: 2592000,            // 30 days
      minTtl: 86400,              // 1 day minimum
      semanticThreshold: 0.88,    // High for legal accuracy
      allowSemanticCache: true,   // Paraphrasing common in legal
    },
    
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['client_name', 'case_number', 'privileged'],
      encryptionRequired: true,
      anonymization: false,       // Need to preserve context
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.8,
      humanReviewThreshold: 0.5,  // Lawyers review anyway
      citationsRequired: true,    // Legal citations mandatory
    },
    
    performance: {
      maxLatencyMs: 3000,         // Research can be slower
      targetHitRate: 85,          // High - legal queries repeat
      costAlertThreshold: 800,
    },
    
    recommendedPipeline: {
      nodes: ['cache_l2', 'cache_l3', 'validation_cognitive', 'llm_anthropic'],
      templates: ['enterprise-compliance'],
    },
    
    detection: {
      keywords: ['contract', 'clause', 'legal', 'lawsuit', 'litigation', 'compliance', 'regulation', 'statute'],
      namespacePatterns: ['legal/*', 'contracts/*', 'compliance/*'],
      envVariables: ['CLIO_API_KEY', 'LEXISNEXIS_KEY'],
    },
  },
  
  // ------------------------------------------------------------
  // EDUCATION
  // ------------------------------------------------------------
  education: {
    id: 'education',
    name: 'Education & EdTech',
    icon: '🎓',
    description: 'FERPA-compliant for student data, tutoring, assessment, research',
    
    compliance: {
      frameworks: ['FERPA', 'COPPA', 'SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    
    cache: {
      defaultTtl: 2592000,        // 30 days - educational content stable
      maxTtl: 7776000,            // 90 days
      minTtl: 86400,
      semanticThreshold: 0.85,
      allowSemanticCache: true,   // Students ask same things differently
    },
    
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['student_id', 'grades', 'parent_info'],
      encryptionRequired: false,
      anonymization: true,
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      humanReviewThreshold: 0.5,
      citationsRequired: true,    // Educational sources
    },
    
    performance: {
      maxLatencyMs: 2000,
      targetHitRate: 90,          // High - curriculum is repetitive
      costAlertThreshold: 300,
    },
    
    recommendedPipeline: {
      nodes: ['cache_l2', 'cache_l3', 'llm_openai', 'output_analytics'],
      templates: ['databricks-rag-basic'],
    },
    
    detection: {
      keywords: ['student', 'lesson', 'curriculum', 'homework', 'assignment', 'grade', 'teacher', 'tutor'],
      namespacePatterns: ['education/*', 'edtech/*', 'school/*', 'university/*'],
      envVariables: ['CANVAS_API_KEY', 'BLACKBOARD_KEY'],
    },
  },
  
  // ------------------------------------------------------------
  // E-COMMERCE & RETAIL
  // ------------------------------------------------------------
  ecommerce: {
    id: 'ecommerce',
    name: 'E-Commerce & Retail',
    icon: '🛒',
    description: 'Product recommendations, customer support, inventory queries',
    
    compliance: {
      frameworks: ['PCI-DSS', 'CCPA', 'GDPR'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    
    cache: {
      defaultTtl: 3600,           // 1 hour - pricing/inventory changes
      maxTtl: 86400,
      minTtl: 300,
      semanticThreshold: 0.82,
      allowSemanticCache: true,   // Product queries vary
    },
    
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['card_number', 'cvv', 'address'],
      encryptionRequired: true,
      anonymization: false,
    },
    
    validation: {
      cognitiveValidation: false, // Speed > validation for retail
      hallucinationCheck: false,
      confidenceThreshold: 0.7,
      humanReviewThreshold: 0.4,
      citationsRequired: false,
    },
    
    performance: {
      maxLatencyMs: 200,          // Customer experience critical
      targetHitRate: 85,
      costAlertThreshold: 500,
    },
    
    recommendedPipeline: {
      nodes: ['cache_l1', 'cache_l2', 'llm_openai', 'output_analytics'],
      templates: ['databricks-rag-basic'],
    },
    
    detection: {
      keywords: ['product', 'order', 'shipping', 'cart', 'checkout', 'price', 'inventory', 'recommendation'],
      namespacePatterns: ['retail/*', 'ecommerce/*', 'store/*'],
      envVariables: ['SHOPIFY_API_KEY', 'STRIPE_KEY', 'MAGENTO_KEY'],
    },
  },
  
  // ------------------------------------------------------------
  // ENTERPRISE / GENERAL
  // ------------------------------------------------------------
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise (General)',
    icon: '🏢',
    description: 'Internal tools, knowledge bases, HR, IT support',
    
    compliance: {
      frameworks: ['SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    
    cache: {
      defaultTtl: 86400,          // 24 hours
      maxTtl: 604800,             // 1 week
      minTtl: 3600,
      semanticThreshold: 0.85,
      allowSemanticCache: true,
    },
    
    data: {
      piiDetection: 'warn',
      sensitiveFields: ['employee_id', 'salary', 'ssn'],
      encryptionRequired: false,
      anonymization: false,
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      humanReviewThreshold: 0.5,
      citationsRequired: false,
    },
    
    performance: {
      maxLatencyMs: 1000,
      targetHitRate: 80,
      costAlertThreshold: 500,
    },
    
    recommendedPipeline: {
      nodes: ['cache_l2', 'llm_openai', 'output_analytics'],
      templates: ['databricks-rag-basic'],
    },
    
    detection: {
      keywords: ['internal', 'employee', 'policy', 'procedure', 'helpdesk', 'IT support'],
      namespacePatterns: ['enterprise/*', 'internal/*', 'corporate/*'],
      envVariables: [],
    },
  },
  
  // ------------------------------------------------------------
  // DEVELOPER / STARTUP
  // ------------------------------------------------------------
  developer: {
    id: 'developer',
    name: 'Developer & Startup',
    icon: '👨‍💻',
    description: 'Code generation, documentation, debugging, MVP development',
    
    compliance: {
      frameworks: [],             // Minimal compliance
      dataResidency: false,
      auditLogging: 'none',
      retentionDays: 30,
    },
    
    cache: {
      defaultTtl: 604800,         // 1 week - code doesn't change fast
      maxTtl: 2592000,            // 30 days
      minTtl: 3600,
      semanticThreshold: 0.8,     // Lower threshold OK
      allowSemanticCache: true,
    },
    
    data: {
      piiDetection: 'none',       // No PII in code
      sensitiveFields: ['api_key', 'password', 'secret'],
      encryptionRequired: false,
      anonymization: false,
    },
    
    validation: {
      cognitiveValidation: false,
      hallucinationCheck: false,
      confidenceThreshold: 0.6,
      humanReviewThreshold: 0.3,
      citationsRequired: false,
    },
    
    performance: {
      maxLatencyMs: 500,
      targetHitRate: 90,          // Very high - code questions repeat
      costAlertThreshold: 200,
    },
    
    recommendedPipeline: {
      nodes: ['cache_l2', 'cache_l3', 'cache_reasoning', 'llm_openai'],
      templates: ['reasoning-optimizer'],
    },
    
    detection: {
      keywords: ['code', 'function', 'debug', 'error', 'api', 'documentation', 'syntax', 'bug'],
      namespacePatterns: ['dev/*', 'code/*', 'engineering/*'],
      envVariables: ['GITHUB_TOKEN', 'OPENAI_API_KEY'],
    },
  },
  
  // ------------------------------------------------------------
  // DATA SCIENCE / ML
  // ------------------------------------------------------------
  datascience: {
    id: 'datascience',
    name: 'Data Science & ML',
    icon: '📊',
    description: 'ML pipelines, data analysis, model training, RAG systems',
    
    compliance: {
      frameworks: ['SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    
    cache: {
      defaultTtl: 86400,          // 24 hours
      maxTtl: 604800,
      minTtl: 3600,
      semanticThreshold: 0.88,
      allowSemanticCache: true,
    },
    
    data: {
      piiDetection: 'warn',
      sensitiveFields: [],
      encryptionRequired: false,
      anonymization: false,
    },
    
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      humanReviewThreshold: 0.5,
      citationsRequired: true,
    },
    
    performance: {
      maxLatencyMs: 2000,
      targetHitRate: 80,
      costAlertThreshold: 1000,
    },
    
    recommendedPipeline: {
      nodes: ['databricks', 'vector_db', 'cache_l2', 'cache_reasoning', 'llm_openai', 'output_analytics'],
      templates: ['databricks-rag-basic', 'reasoning-optimizer'],
    },
    
    detection: {
      keywords: ['model', 'training', 'dataset', 'embedding', 'vector', 'inference', 'RAG', 'pipeline'],
      namespacePatterns: ['ml/*', 'data/*', 'analytics/*'],
      envVariables: ['DATABRICKS_HOST', 'SNOWFLAKE_ACCOUNT', 'PINECONE_API_KEY'],
    },
  },
};

// ============================================================
// SECTOR DETECTION
// ============================================================

export interface DetectionResult {
  sector: SectorProfile;
  confidence: number;           // 0-1 confidence in detection
  signals: string[];            // What triggered detection
  warnings: string[];           // Potential compliance issues
}

/**
 * Detect sector from context signals
 */
export function detectSector(context: {
  namespace?: string;
  query?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  previousQueries?: string[];
}): DetectionResult {
  const scores: Record<string, { score: number; signals: string[] }> = {};
  
  // Initialize scores
  for (const sectorId of Object.keys(SECTOR_PROFILES)) {
    scores[sectorId] = { score: 0, signals: [] };
  }
  
  // Check namespace patterns
  if (context.namespace) {
    for (const [sectorId, profile] of Object.entries(SECTOR_PROFILES)) {
      for (const pattern of profile.detection.namespacePatterns) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(context.namespace)) {
          scores[sectorId].score += 50;
          scores[sectorId].signals.push(`Namespace matches ${pattern}`);
        }
      }
    }
  }
  
  // Check query keywords
  if (context.query) {
    const queryLower = context.query.toLowerCase();
    for (const [sectorId, profile] of Object.entries(SECTOR_PROFILES)) {
      for (const keyword of profile.detection.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          scores[sectorId].score += 10;
          scores[sectorId].signals.push(`Query contains "${keyword}"`);
        }
      }
    }
  }
  
  // Check environment variables
  if (context.env) {
    for (const [sectorId, profile] of Object.entries(SECTOR_PROFILES)) {
      for (const envVar of profile.detection.envVariables) {
        if (context.env[envVar]) {
          scores[sectorId].score += 30;
          scores[sectorId].signals.push(`Environment has ${envVar}`);
        }
      }
    }
  }
  
  // Check headers for sector hints
  if (context.headers) {
    const sectorHeader = context.headers['x-agentcache-sector'];
    if (sectorHeader && SECTOR_PROFILES[sectorHeader]) {
      scores[sectorHeader].score += 100;
      scores[sectorHeader].signals.push('Explicit sector header');
    }
  }
  
  // Find highest scoring sector
  let bestSector = 'enterprise';
  let bestScore = 0;
  
  for (const [sectorId, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestSector = sectorId;
    }
  }
  
  // Calculate confidence
  const confidence = Math.min(bestScore / 100, 1);
  
  // Generate warnings
  const warnings: string[] = [];
  const sector = SECTOR_PROFILES[bestSector];
  
  if (sector.compliance.frameworks.includes('HIPAA') && !context.env?.HIPAA_MODE) {
    warnings.push('Healthcare sector detected but HIPAA_MODE not enabled');
  }
  
  if (sector.data.encryptionRequired && !context.env?.ENCRYPTION_KEY) {
    warnings.push(`${sector.name} requires encryption but no ENCRYPTION_KEY found`);
  }
  
  return {
    sector,
    confidence,
    signals: scores[bestSector].signals,
    warnings,
  };
}

// ============================================================
// CONFIGURATION BUILDER
// ============================================================

export interface SectorConfig {
  ttl: number;
  namespace: string;
  piiMode: 'none' | 'warn' | 'redact' | 'block';
  validation: {
    cognitive: boolean;
    hallucination: boolean;
    confidenceMin: number;
  };
  cache: {
    layers: string[];
    semanticEnabled: boolean;
    semanticThreshold: number;
  };
  audit: {
    level: string;
    retentionDays: number;
  };
  alerts: {
    latencyMs: number;
    costDaily: number;
    hitRateMin: number;
  };
}

/**
 * Build configuration from sector profile
 */
export function buildSectorConfig(
  detection: DetectionResult,
  overrides?: Partial<SectorConfig>
): SectorConfig {
  const sector = detection.sector;
  
  const config: SectorConfig = {
    ttl: sector.cache.defaultTtl,
    namespace: `${sector.id}/default`,
    piiMode: sector.data.piiDetection,
    validation: {
      cognitive: sector.validation.cognitiveValidation,
      hallucination: sector.validation.hallucinationCheck,
      confidenceMin: sector.validation.confidenceThreshold,
    },
    cache: {
      layers: sector.cache.allowSemanticCache ? ['l2', 'l3'] : ['l2'],
      semanticEnabled: sector.cache.allowSemanticCache,
      semanticThreshold: sector.cache.semanticThreshold,
    },
    audit: {
      level: sector.compliance.auditLogging,
      retentionDays: sector.compliance.retentionDays,
    },
    alerts: {
      latencyMs: sector.performance.maxLatencyMs,
      costDaily: sector.performance.costAlertThreshold,
      hitRateMin: sector.performance.targetHitRate,
    },
  };
  
  // Apply overrides
  if (overrides) {
    return { ...config, ...overrides };
  }
  
  return config;
}

// ============================================================
// EXPORT
// ============================================================

export default {
  SECTOR_PROFILES,
  detectSector,
  buildSectorConfig,
};
