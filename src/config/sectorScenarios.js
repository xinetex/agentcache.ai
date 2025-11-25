/**
 * Sector-Specific Caching Scenarios
 * Research-backed pipeline templates for each HPC sector
 */

export const SECTOR_SCENARIOS = {
  
  // HEALTHCARE & LIFE SCIENCES
  healthcare: {
    name: 'Healthcare & Life Sciences',
    icon: '🏥',
    scenarios: [
      {
        id: 'hipaa-compliant-rag',
        name: 'HIPAA-Compliant RAG',
        description: 'Medical knowledge retrieval with full audit trails for compliance',
        useCase: 'clinical_decision_support',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '1GB', encryption: 'AES-256' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis', audit_log: true }},
          { type: 'compliance_layer', config: { standard: 'HIPAA', audit_retention: '7_years' }},
          { type: 'pii_detection', config: { redaction: 'automatic', phi_alerts: true }},
          { type: 'semantic_dedup', config: { threshold: 0.95 }}
        ],
        compliance: ['HIPAA', 'HITRUST'],
        estimatedSavings: '$3,200/mo',
        complexity: 'complex',
        reasoning: 'Medical RAG systems require secure caching with full audit trails. PHI detection prevents data leaks. Multi-tier caching reduces EHR API load by 85%.'
      },
      {
        id: 'diagnostic-imaging-cache',
        name: 'Diagnostic Imaging Analysis',
        description: 'Cache AI-analyzed radiology reports and imaging interpretations',
        useCase: 'diagnostic_imaging',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '2GB' }},
          { type: 'cache_l2', config: { ttl: 7200, storage: 'redis' }},
          { type: 'deduplication', config: { hash_algorithm: 'perceptual', threshold: 0.92 }},
          { type: 'compliance_layer', config: { standard: 'HIPAA' }}
        ],
        compliance: ['HIPAA', 'FDA 21 CFR Part 11'],
        estimatedSavings: '$4,800/mo',
        complexity: 'moderate',
        reasoning: 'Radiology AI models are expensive ($0.50-2.00 per image). Caching similar case interpretations saves 70% on redundant analyses.'
      },
      {
        id: 'patient-triage-assistant',
        name: 'Patient Triage Assistant',
        description: 'Cache symptom analysis and triage recommendations',
        useCase: 'patient_triage',
        nodes: [
          { type: 'cache_l1', config: { ttl: 180, max_size: '500MB' }},
          { type: 'semantic_cache', config: { similarity_threshold: 0.88 }},
          { type: 'compliance_layer', config: { standard: 'HIPAA', log_all_access: true }}
        ],
        compliance: ['HIPAA'],
        estimatedSavings: '$1,800/mo',
        complexity: 'simple',
        reasoning: 'Common symptoms generate repeated queries. Semantic caching handles symptom variations (e.g., "chest pain" vs "tightness in chest").'
      }
    ]
  },

  // FINANCE & FINTECH
  finance: {
    name: 'Finance & FinTech',
    icon: '💰',
    scenarios: [
      {
        id: 'fraud-detection-cache',
        name: 'Real-Time Fraud Detection',
        description: 'Cache ML fraud scores with sub-50ms latency requirements',
        useCase: 'fraud_detection',
        nodes: [
          { type: 'cache_l1', config: { ttl: 120, max_size: '1GB', strategy: 'LRU' }},
          { type: 'cache_l2', config: { ttl: 600, storage: 'redis' }},
          { type: 'anomaly_detection', config: { alert_on_cache_miss: true }},
          { type: 'compliance_layer', config: { standard: 'PCI-DSS', immutable_logs: true }}
        ],
        compliance: ['PCI-DSS', 'SOC 2 Type II'],
        estimatedSavings: '$5,200/mo',
        complexity: 'complex',
        reasoning: 'Payment fraud models must respond <50ms. L1 cache ensures 95% hit rate on known patterns. Anomaly detection flags unusual transaction types for live scoring.'
      },
      {
        id: 'kyc-document-verification',
        name: 'KYC Document Verification',
        description: 'Cache ID verification results and risk assessments',
        useCase: 'kyc_verification',
        nodes: [
          { type: 'cache_l1', config: { ttl: 3600, max_size: '500MB' }},
          { type: 'cache_l2', config: { ttl: 86400, storage: 'postgresql' }},
          { type: 'deduplication', config: { hash_fields: ['document_id', 'customer_id'] }},
          { type: 'compliance_layer', config: { standard: 'KYC/AML', retention: '5_years' }}
        ],
        compliance: ['KYC/AML', 'GDPR'],
        estimatedSavings: '$3,600/mo',
        complexity: 'moderate',
        reasoning: 'Identity verification APIs cost $0.50-3.00 per check. Caching verified documents for returning customers saves 80% on redundant checks.'
      },
      {
        id: 'market-sentiment-analysis',
        name: 'Market Sentiment Analysis',
        description: 'Cache LLM-analyzed market sentiment from news/social',
        useCase: 'sentiment_analysis',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '1GB' }},
          { type: 'cache_l2', config: { ttl: 1800, storage: 'redis' }},
          { type: 'semantic_dedup', config: { threshold: 0.90 }},
          { type: 'time_series_cache', config: { window: '15min', aggregate: 'avg' }}
        ],
        compliance: ['SOC 2'],
        estimatedSavings: '$2,400/mo',
        complexity: 'moderate',
        reasoning: 'Trading firms analyze same news multiple times. Semantic caching handles paraphrased headlines. Time-series aggregation reduces duplicate sentiment calls.'
      }
    ]
  },

  // EDUCATION & EDTECH
  education: {
    name: 'Education & EdTech',
    icon: '🎓',
    scenarios: [
      {
        id: 'literacy-rag-system',
        name: 'Science of Reading RAG',
        description: 'Cache research-backed literacy guidance with source citations',
        useCase: 'educational_rag',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '500MB' }},
          { type: 'cache_l2', config: { ttl: 7200, storage: 'redis' }},
          { type: 'semantic_cache', config: { similarity_threshold: 0.87 }},
          { type: 'citation_tracking', config: { store_sources: true }},
          { type: 'content_filtering', config: { age_appropriate: true }}
        ],
        compliance: ['FERPA', 'COPPA'],
        estimatedSavings: '$1,600/mo',
        complexity: 'moderate',
        reasoning: 'Teachers ask similar questions about phonics, comprehension strategies. Semantic caching handles question variations. Citation tracking maintains research integrity.'
      },
      {
        id: 'personalized-tutoring',
        name: 'AI Tutoring Personalization',
        description: 'Cache student-specific learning recommendations',
        useCase: 'adaptive_learning',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '1GB', partition_by: 'student_id' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' }},
          { type: 'user_memory', config: { remember_preferences: true, learning_style: true }},
          { type: 'compliance_layer', config: { standard: 'FERPA', student_data_protection: true }}
        ],
        compliance: ['FERPA', 'COPPA'],
        estimatedSavings: '$2,100/mo',
        complexity: 'moderate',
        reasoning: 'Personalized learning models are compute-intensive. Caching per-student recommendations reduces redundant model inference by 75%.'
      },
      {
        id: 'grading-automation',
        name: 'Automated Essay Grading',
        description: 'Cache grading rubrics and similar essay assessments',
        useCase: 'automated_grading',
        nodes: [
          { type: 'cache_l1', config: { ttl: 3600, max_size: '500MB' }},
          { type: 'semantic_dedup', config: { threshold: 0.93 }},
          { type: 'compliance_layer', config: { standard: 'FERPA' }}
        ],
        compliance: ['FERPA'],
        estimatedSavings: '$1,200/mo',
        complexity: 'simple',
        reasoning: 'Similar essays get graded repeatedly. Semantic deduplication detects near-duplicate submissions, reducing LLM grading costs by 60%.'
      }
    ]
  },

  // LEGAL & COMPLIANCE
  legal: {
    name: 'Legal & Compliance',
    icon: '⚖️',
    scenarios: [
      {
        id: 'contract-analysis',
        name: 'Contract Review & Analysis',
        description: 'Cache legal clause analysis and risk assessments',
        useCase: 'contract_review',
        nodes: [
          { type: 'cache_l1', config: { ttl: 1800, max_size: '1GB' }},
          { type: 'cache_l2', config: { ttl: 86400, storage: 'postgresql' }},
          { type: 'semantic_cache', config: { similarity_threshold: 0.91 }},
          { type: 'versioning', config: { track_changes: true }},
          { type: 'compliance_layer', config: { standard: 'SOC 2', attorney_client_privilege: true }}
        ],
        compliance: ['SOC 2', 'ISO 27001'],
        estimatedSavings: '$4,200/mo',
        complexity: 'complex',
        reasoning: 'Legal AI models (GPT-4) cost $0.10+ per contract. Standard clauses appear repeatedly. Semantic caching handles clause variations, saving 70% on analysis.'
      },
      {
        id: 'regulatory-compliance-checks',
        name: 'Regulatory Compliance Monitoring',
        description: 'Cache regulation interpretations and compliance status',
        useCase: 'compliance_monitoring',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '500MB' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' }},
          { type: 'compliance_layer', config: { standards: ['SOC 2', 'ISO 27001', 'GDPR'], audit_trail: true }}
        ],
        compliance: ['SOC 2', 'ISO 27001', 'GDPR'],
        estimatedSavings: '$2,800/mo',
        complexity: 'moderate',
        reasoning: 'Compliance teams query same regulations repeatedly. Caching regulation interpretations reduces LLM costs by 80%.'
      }
    ]
  },

  // E-COMMERCE & RETAIL
  ecommerce: {
    name: 'E-commerce & Retail',
    icon: '🛒',
    scenarios: [
      {
        id: 'product-recommendations',
        name: 'AI Product Recommendations',
        description: 'Cache personalized product suggestions and search results',
        useCase: 'product_recommendations',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '2GB', partition_by: 'user_segment' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' }},
          { type: 'semantic_cache', config: { similarity_threshold: 0.85 }},
          { type: 'ab_testing', config: { variant_caching: true }}
        ],
        compliance: ['GDPR', 'CCPA'],
        estimatedSavings: '$3,400/mo',
        complexity: 'moderate',
        reasoning: 'Recommendation models run on every page load. Segment-based caching (e.g., "outdoor enthusiast") reduces per-user computation by 85%.'
      },
      {
        id: 'customer-support-bot',
        name: 'Customer Support Chatbot',
        description: 'Cache common support queries and product knowledge',
        useCase: 'customer_support',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '1GB' }},
          { type: 'cache_l2', config: { ttl: 7200, storage: 'redis' }},
          { type: 'semantic_cache', config: { similarity_threshold: 0.88 }},
          { type: 'user_memory', config: { remember_orders: true, preferences: true }}
        ],
        compliance: ['GDPR', 'CCPA'],
        estimatedSavings: '$2,600/mo',
        complexity: 'moderate',
        reasoning: 'Support bots answer 80% of the same questions. Semantic caching handles variations ("Where\'s my order?" vs "Track my shipment"). 90% hit rate.'
      }
    ]
  },

  // DATA LAKEHOUSE & ANALYTICS
  data_lakehouse: {
    name: 'Data Lakehouse & Analytics',
    icon: '📊',
    scenarios: [
      {
        id: 'databricks-rag-optimization',
        name: 'Databricks RAG Optimization',
        description: 'Cache LLM inference for lakehouse RAG pipelines with sub-50ms hits',
        useCase: 'lakehouse_rag',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '2GB', strategy: 'LRU' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' }},
          { type: 'cache_l3', config: { ttl: 86400, storage: 'delta_lake' }},
          { type: 'semantic_dedup', config: { threshold: 0.92, use_embeddings: true }},
          { type: 'compliance_layer', config: { standards: ['SOC 2', 'ISO 42001'], lineage_tracking: true }},
          { type: 'cost_allocation', config: { chargeback_by_namespace: true }}
        ],
        compliance: ['SOC 2', 'ISO 42001', 'GDPR'],
        estimatedSavings: '$8,400/mo',
        complexity: 'complex',
        reasoning: 'Enterprise RAG systems query same data repeatedly. 3-tier caching (hot/warm/cold) reduces lakehouse LLM costs by 90%. Lineage tracking for AI governance.'
      },
      {
        id: 'snowflake-cortex-cache',
        name: 'Snowflake Cortex AI Caching',
        description: 'Cache Snowflake Cortex LLM responses with SQL integration',
        useCase: 'snowflake_cortex',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '1GB' }},
          { type: 'cache_l2', config: { ttl: 7200, storage: 'redis' }},
          { type: 'semantic_cache', config: { threshold: 0.90 }},
          { type: 'cost_allocation', config: { by_warehouse: true, by_schema: true }}
        ],
        compliance: ['SOC 2', 'GDPR'],
        estimatedSavings: '$6,200/mo',
        complexity: 'moderate',
        reasoning: 'Snowflake Cortex charges per token. Caching SQL-triggered LLM calls reduces costs by 85%. Cost allocation maps to Snowflake warehouses for FinOps.'
      },
      {
        id: 'vector-search-cache',
        name: 'Vector Search Optimization',
        description: 'Cache vector similarity searches and embeddings',
        useCase: 'vector_search',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '1GB' }},
          { type: 'embedding_cache', config: { ttl: 7200, model: 'text-embedding-3-large' }},
          { type: 'semantic_cache', config: { threshold: 0.93, vector_similarity: 'cosine' }},
          { type: 'deduplication', config: { hash_embeddings: true }}
        ],
        compliance: ['SOC 2'],
        estimatedSavings: '$4,800/mo',
        complexity: 'moderate',
        reasoning: 'Vector DBs (Pinecone, Weaviate) charge per query. Caching embeddings avoids redundant OpenAI embedding API calls ($0.00013/1K tokens). 80% hit rate.'
      }
    ]
  },

  // MEDIA & ENTERTAINMENT
  media: {
    name: 'Media & Entertainment',
    icon: '🎬',
    scenarios: [
      {
        id: 'content-moderation',
        name: 'AI Content Moderation',
        description: 'Cache moderation decisions for user-generated content',
        useCase: 'content_moderation',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '1GB' }},
          { type: 'cache_l2', config: { ttl: 7200, storage: 'redis' }},
          { type: 'perceptual_hash', config: { threshold: 0.95 }},
          { type: 'semantic_dedup', config: { threshold: 0.90 }}
        ],
        compliance: ['COPPA', 'GDPR'],
        estimatedSavings: '$5,600/mo',
        complexity: 'moderate',
        reasoning: 'Moderation APIs cost $0.01-0.05 per item. Perceptual hashing detects duplicate images/videos. Semantic dedup catches text variations. 75% hit rate.'
      },
      {
        id: 'subtitle-generation',
        name: 'AI Subtitle Generation',
        description: 'Cache transcription and translation results',
        useCase: 'subtitle_generation',
        nodes: [
          { type: 'cache_l1', config: { ttl: 3600, max_size: '2GB' }},
          { type: 'cache_l2', config: { ttl: 86400, storage: 'postgresql' }},
          { type: 'audio_fingerprint', config: { algorithm: 'chromaprint' }},
          { type: 'deduplication', config: { by_audio_hash: true }}
        ],
        compliance: ['GDPR'],
        estimatedSavings: '$3,200/mo',
        complexity: 'moderate',
        reasoning: 'Transcription APIs (Whisper, Deepgram) cost $0.006-0.024 per minute. Audio fingerprinting detects re-uploads, avoiding redundant transcription.'
      }
    ]
  },

  // MANUFACTURING & IOT
  manufacturing: {
    name: 'Manufacturing & IoT',
    icon: '🏭',
    scenarios: [
      {
        id: 'predictive-maintenance',
        name: 'Predictive Maintenance AI',
        description: 'Cache equipment failure predictions and maintenance schedules',
        useCase: 'predictive_maintenance',
        nodes: [
          { type: 'cache_l1', config: { ttl: 300, max_size: '500MB', partition_by: 'equipment_id' }},
          { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' }},
          { type: 'time_series_cache', config: { window: '1hour', aggregate: 'latest' }},
          { type: 'anomaly_detection', config: { alert_on_deviation: true }}
        ],
        compliance: ['ISO 27001'],
        estimatedSavings: '$2,800/mo',
        complexity: 'moderate',
        reasoning: 'ML models analyze sensor data every 5 minutes. Caching stable predictions reduces redundant inference by 70%. Anomaly detection triggers fresh inference only when needed.'
      },
      {
        id: 'quality-control-vision',
        name: 'Computer Vision QC',
        description: 'Cache defect detection results from production line cameras',
        useCase: 'quality_control',
        nodes: [
          { type: 'cache_l1', config: { ttl: 600, max_size: '1GB' }},
          { type: 'perceptual_hash', config: { threshold: 0.93 }},
          { type: 'deduplication', config: { by_image_hash: true }}
        ],
        compliance: ['ISO 9001'],
        estimatedSavings: '$4,200/mo',
        complexity: 'simple',
        reasoning: 'Vision models analyze thousands of images/hour. Perceptual hashing detects identical/similar products, caching "pass/fail" decisions. 85% hit rate on repetitive production.'
      }
    ]
  }
};

/**
 * Get all scenarios for a sector
 */
export function getSectorScenarios(sector) {
  return SECTOR_SCENARIOS[sector]?.scenarios || [];
}

/**
 * Get scenario by ID across all sectors
 */
export function getScenarioById(scenarioId) {
  for (const sector of Object.values(SECTOR_SCENARIOS)) {
    const scenario = sector.scenarios.find(s => s.id === scenarioId);
    if (scenario) return { ...scenario, sector: sector.name };
  }
  return null;
}

/**
 * Get all sectors
 */
export function getAllSectors() {
  return Object.entries(SECTOR_SCENARIOS).map(([key, value]) => ({
    id: key,
    name: value.name,
    icon: value.icon,
    scenarioCount: value.scenarios.length
  }));
}

/**
 * Search scenarios by keyword
 */
export function searchScenarios(query) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  for (const [sectorKey, sector] of Object.entries(SECTOR_SCENARIOS)) {
    for (const scenario of sector.scenarios) {
      if (
        scenario.name.toLowerCase().includes(lowerQuery) ||
        scenario.description.toLowerCase().includes(lowerQuery) ||
        scenario.useCase.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          ...scenario,
          sector: sector.name,
          sectorId: sectorKey
        });
      }
    }
  }
  
  return results;
}
