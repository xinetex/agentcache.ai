/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * Sector-Specific Configuration
 * Each sector gets customized templates, nodes, and compliance
 */

export const SECTOR_TEMPLATES = {
  healthcare: [
    {
      id: 'patient_records',
      title: '⚕️ Patient Records',
      description: 'Cache medical records with HIPAA compliance',
      prompt: 'Cache patient medical records with HIPAA compliance and PHI detection',
      nodes: ['input', 'phi_filter', 'cache_l1', 'cache_l2', 'hipaa_audit', 'openai', 'output']
    },
    {
      id: 'clinical_decision',
      title: '🔬 Clinical Decision Support',
      description: 'AI-powered diagnosis with audit trails',
      prompt: 'Cache clinical decision support AI with full audit logging',
      nodes: ['input', 'phi_filter', 'cache_l1', 'anthropic', 'hipaa_audit', 'output']
    },
    {
      id: 'ehr_integration',
      title: '🏥 EHR Integration',
      description: 'Electronic health record system caching',
      prompt: 'Cache EHR system queries with encryption and compliance',
      nodes: ['input', 'cache_l1', 'cache_l2', 'phi_filter', 'hipaa_audit', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom Healthcare',
      description: 'Describe your own healthcare use case',
      prompt: '',
      nodes: []
    }
  ],

  finance: [
    {
      id: 'risk_analysis',
      title: '📊 Risk Analysis',
      description: 'Fraud detection and risk scoring',
      prompt: 'Cache risk analysis and fraud detection for financial transactions',
      nodes: ['input', 'fraud_detector', 'cache_l1', 'cache_l2', 'openai', 'pci_audit', 'output']
    },
    {
      id: 'transaction_processing',
      title: '💳 Transaction Processing',
      description: 'High-speed payment validation',
      prompt: 'Cache transaction validation with PCI-DSS compliance',
      nodes: ['input', 'transaction_validator', 'cache_l1', 'pci_audit', 'output']
    },
    {
      id: 'kyc_compliance',
      title: '🔍 KYC Compliance',
      description: 'Know Your Customer verification',
      prompt: 'Cache KYC verification results with audit trail',
      nodes: ['input', 'cache_l1', 'cache_l2', 'anthropic', 'pci_audit', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom Finance',
      description: 'Describe your own financial use case',
      prompt: '',
      nodes: []
    }
  ],

  legal: [
    {
      id: 'document_analysis',
      title: '📄 Document Analysis',
      description: 'Legal document review and search',
      prompt: 'Cache legal document analysis with retention policies',
      nodes: ['input', 'cache_l1', 'cache_l2', 'anthropic', 'retention_policy', 'output']
    },
    {
      id: 'case_research',
      title: '⚖️ Case Research',
      description: 'Case law and precedent lookup',
      prompt: 'Cache case law research with audit logging',
      nodes: ['input', 'semantic_dedup', 'cache_l2', 'cache_l3', 'openai', 'audit_logger', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom Legal',
      description: 'Describe your own legal use case',
      prompt: '',
      nodes: []
    }
  ],

  ecommerce: [
    {
      id: 'product_search',
      title: '🔍 Product Search',
      description: 'Fast product catalog search',
      prompt: 'Cache product search and recommendations',
      nodes: ['input', 'cache_l1', 'semantic_dedup', 'openai', 'output']
    },
    {
      id: 'inventory_sync',
      title: '📦 Inventory Sync',
      description: 'Real-time inventory availability',
      prompt: 'Cache inventory status with short TTL for freshness',
      nodes: ['input', 'cache_l1', 'output']
    },
    {
      id: 'personalization',
      title: '✨ Personalization',
      description: 'User recommendations and preferences',
      prompt: 'Cache personalized recommendations per user',
      nodes: ['input', 'cache_l1', 'cache_l2', 'gemini', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom E-commerce',
      description: 'Describe your own e-commerce use case',
      prompt: '',
      nodes: []
    }
  ],

  saas: [
    {
      id: 'api_caching',
      title: '🔌 API Caching',
      description: 'Multi-tenant API response caching',
      prompt: 'Cache API responses with tenant isolation',
      nodes: ['input', 'cache_l1', 'cache_l2', 'output']
    },
    {
      id: 'ai_features',
      title: '🤖 AI Features',
      description: 'AI-powered product features',
      prompt: 'Cache AI completions for SaaS features',
      nodes: ['input', 'semantic_dedup', 'cache_l1', 'cache_l2', 'openai', 'output']
    },
    {
      id: 'analytics',
      title: '📊 Analytics',
      description: 'Dashboard data aggregation',
      prompt: 'Cache analytics queries and dashboard data',
      nodes: ['input', 'cache_l2', 'cache_l3', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom SaaS',
      description: 'Describe your own SaaS use case',
      prompt: '',
      nodes: []
    }
  ],

  general: [
    {
      id: 'api_basic',
      title: '🔌 API Caching',
      description: 'Basic API response caching',
      prompt: 'Cache API responses to reduce latency',
      nodes: ['input', 'cache_l1', 'cache_l2', 'output']
    },
    {
      id: 'llm_caching',
      title: '🤖 LLM Caching',
      description: 'Cache AI model responses',
      prompt: 'Cache LLM completions to save costs',
      nodes: ['input', 'semantic_dedup', 'cache_l1', 'cache_l2', 'openai', 'output']
    },
    {
      id: 'database',
      title: '🗄️ Database Query',
      description: 'Cache expensive database queries',
      prompt: 'Cache database query results',
      nodes: ['input', 'cache_l1', 'cache_l2', 'cache_l3', 'output']
    },
    {
      id: 'custom',
      title: '✏️ Custom',
      description: 'Describe your own use case',
      prompt: '',
      nodes: []
    }
  ]
};

export const SECTOR_NODES = {
  healthcare: [
    // Input
    { category: 'input', types: ['input'] },
    // Cache
    { category: 'cache', types: ['cache_l1', 'cache_l2', 'cache_l3'] },
    // Intelligence
    { category: 'intelligence', types: ['semantic_dedup', 'phi_filter'] },
    // LLM
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    // Compliance
    { category: 'compliance', types: ['hipaa_audit', 'encrypted_cache'] },
    // Output
    { category: 'output', types: ['output'] }
  ],

  finance: [
    { category: 'input', types: ['input'] },
    { category: 'cache', types: ['cache_l1', 'cache_l2', 'cache_l3'] },
    { category: 'intelligence', types: ['semantic_dedup', 'fraud_detector', 'transaction_validator'] },
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    { category: 'compliance', types: ['pci_audit', 'sox_logger'] },
    { category: 'output', types: ['output'] }
  ],

  legal: [
    { category: 'input', types: ['input'] },
    { category: 'cache', types: ['cache_l1', 'cache_l2', 'cache_l3'] },
    { category: 'intelligence', types: ['semantic_dedup'] },
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    { category: 'compliance', types: ['retention_policy', 'audit_logger'] },
    { category: 'output', types: ['output'] }
  ],

  ecommerce: [
    { category: 'input', types: ['input'] },
    { category: 'cache', types: ['cache_l1', 'cache_l2'] },
    { category: 'intelligence', types: ['semantic_dedup'] },
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    { category: 'output', types: ['output'] }
  ],

  saas: [
    { category: 'input', types: ['input'] },
    { category: 'cache', types: ['cache_l1', 'cache_l2', 'cache_l3'] },
    { category: 'intelligence', types: ['semantic_dedup'] },
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    { category: 'output', types: ['output'] }
  ],

  general: [
    { category: 'input', types: ['input'] },
    { category: 'cache', types: ['cache_l1', 'cache_l2', 'cache_l3'] },
    { category: 'intelligence', types: ['semantic_dedup'] },
    { category: 'llm', types: ['openai', 'anthropic', 'gemini'] },
    { category: 'output', types: ['output'] }
  ]
};

export const SECTOR_COMPLIANCE = {
  healthcare: {
    required: ['hipaa', 'phi'],
    autoAddNodes: ['phi_filter', 'hipaa_audit'],
    retention: '7 years',
    encryption: 'required'
  },
  finance: {
    required: ['pci_dss', 'sox'],
    autoAddNodes: ['pci_audit'],
    retention: '7 years',
    encryption: 'required'
  },
  legal: {
    required: ['data_retention'],
    autoAddNodes: ['retention_policy', 'audit_logger'],
    retention: '10 years',
    encryption: 'recommended'
  },
  ecommerce: {
    required: ['pci_dss', 'gdpr'],
    autoAddNodes: [],
    retention: '2 years',
    encryption: 'recommended'
  },
  saas: {
    required: ['soc2'],
    autoAddNodes: [],
    retention: '1 year',
    encryption: 'recommended'
  },
  general: {
    required: [],
    autoAddNodes: [],
    retention: '30 days',
    encryption: 'optional'
  }
};

export function getSectorConfig(sector) {
  return {
    templates: SECTOR_TEMPLATES[sector] || SECTOR_TEMPLATES.general,
    nodes: SECTOR_NODES[sector] || SECTOR_NODES.general,
    compliance: SECTOR_COMPLIANCE[sector] || SECTOR_COMPLIANCE.general
  };
}
