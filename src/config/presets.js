/**
 * Pre-built Pipeline Presets
 * Production-ready pipelines for each sector
 * Like Databricks Solution Accelerators
 */

export const PIPELINE_PRESETS = {
  healthcare: [
    {
      id: 'hipaa_rag',
      name: 'HIPAA-Compliant RAG',
      description: 'Production RAG with PHI protection and audit logging',
      icon: '⚕️',
      tier: 'enterprise',
      estimatedSavings: '$4,200/mo',
      metrics: {
        hitRate: 0.88,
        latency: 67,
        savingsPerRequest: 1.40
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'phi_filter', 
          position: { x: 350, y: 200 },
          config: { 
            detection_threshold: 0.95,
            redaction_mode: 'mask'
          }
        },
        { 
          type: 'cache_l1', 
          position: { x: 600, y: 200 },
          config: { ttl: 300, max_size: '500MB' }
        },
        { 
          type: 'cache_l2', 
          position: { x: 850, y: 200 },
          config: { ttl: 3600, storage: 'redis' }
        },
        { 
          type: 'openai', 
          position: { x: 1100, y: 200 },
          config: { model: 'gpt-4', temperature: 0.7 }
        },
        { 
          type: 'hipaa_audit', 
          position: { x: 1350, y: 200 },
          config: { retention: '7 years', log_level: 'full' }
        },
        { type: 'output', position: { x: 1600, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'phi_filter-1' },
        { source: 'phi_filter-1', target: 'cache_l1-2' },
        { source: 'cache_l1-2', target: 'cache_l2-3', label: 'MISS' },
        { source: 'cache_l2-3', target: 'openai-4', label: 'MISS' },
        { source: 'openai-4', target: 'hipaa_audit-5' },
        { source: 'hipaa_audit-5', target: 'output-6' }
      ],
      tags: ['rag', 'hipaa', 'phi', 'audit'],
      useCase: 'Clinical decision support, patient record retrieval',
      compliance: ['HIPAA', 'PHI Detection'],
      recommended: true
    },
    {
      id: 'ehr_integration',
      name: 'EHR System Cache',
      description: 'High-performance caching for electronic health records',
      icon: '🏥',
      tier: 'professional',
      estimatedSavings: '$2,800/mo',
      metrics: {
        hitRate: 0.92,
        latency: 45,
        savingsPerRequest: 0.95
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 600, max_size: '1GB' }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 7200, storage: 'redis' }
        },
        { 
          type: 'encrypted_cache', 
          position: { x: 850, y: 200 },
          config: { encryption: 'AES-256' }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS' },
        { source: 'cache_l2-2', target: 'encrypted_cache-3', label: 'MISS' },
        { source: 'encrypted_cache-3', target: 'output-4' }
      ],
      tags: ['ehr', 'performance', 'encryption'],
      useCase: 'Fast EHR queries, patient lookup',
      compliance: ['Encryption at Rest']
    }
  ],

  finance: [
    {
      id: 'fraud_detection',
      name: 'Real-Time Fraud Detection',
      description: 'Sub-50ms fraud scoring with compliance audit',
      icon: '🔎',
      tier: 'enterprise',
      estimatedSavings: '$6,500/mo',
      metrics: {
        hitRate: 0.85,
        latency: 38,
        savingsPerRequest: 2.10
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'fraud_detector', 
          position: { x: 350, y: 200 },
          config: { threshold: 0.8, check_velocity: true }
        },
        { 
          type: 'cache_l1', 
          position: { x: 600, y: 200 },
          config: { ttl: 120, max_size: '500MB' }
        },
        { 
          type: 'openai', 
          position: { x: 850, y: 200 },
          config: { model: 'gpt-4', temperature: 0.3 }
        },
        { 
          type: 'pci_audit', 
          position: { x: 1100, y: 200 },
          config: { retention: '7 years' }
        },
        { type: 'output', position: { x: 1350, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'fraud_detector-1' },
        { source: 'fraud_detector-1', target: 'cache_l1-2' },
        { source: 'cache_l1-2', target: 'openai-3', label: 'MISS' },
        { source: 'openai-3', target: 'pci_audit-4' },
        { source: 'pci_audit-4', target: 'output-5' }
      ],
      tags: ['fraud', 'pci-dss', 'real-time'],
      useCase: 'Transaction fraud scoring, risk analysis',
      compliance: ['PCI-DSS', 'SOX'],
      recommended: true
    },
    {
      id: 'kyc_verification',
      name: 'KYC Compliance Pipeline',
      description: 'Know Your Customer verification with full audit trail',
      icon: '🔍',
      tier: 'enterprise',
      estimatedSavings: '$3,100/mo',
      metrics: {
        hitRate: 0.78,
        latency: 95,
        savingsPerRequest: 1.85
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l2', 
          position: { x: 350, y: 200 },
          config: { ttl: 86400, storage: 'postgresql' }
        },
        { 
          type: 'anthropic', 
          position: { x: 600, y: 200 },
          config: { model: 'claude-3-opus' }
        },
        { 
          type: 'pci_audit', 
          position: { x: 850, y: 200 },
          config: { retention: '7 years', log_pii: false }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l2-1' },
        { source: 'cache_l2-1', target: 'anthropic-2', label: 'MISS' },
        { source: 'anthropic-2', target: 'pci_audit-3' },
        { source: 'pci_audit-3', target: 'output-4' }
      ],
      tags: ['kyc', 'compliance', 'identity'],
      useCase: 'Customer verification, AML compliance',
      compliance: ['KYC', 'AML']
    }
  ],

  legal: [
    {
      id: 'contract_analysis',
      name: 'Legal Contract Analysis',
      description: 'AI-powered contract review with confidentiality protection',
      icon: '⚖️',
      tier: 'enterprise',
      estimatedSavings: '$5,200/mo',
      metrics: {
        hitRate: 0.83,
        latency: 78,
        savingsPerRequest: 1.95
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 900, max_size: '750MB' }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 7200, storage: 'postgresql' }
        },
        { 
          type: 'anthropic', 
          position: { x: 850, y: 200 },
          config: { model: 'claude-3-opus', temperature: 0.2 }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS' },
        { source: 'cache_l2-2', target: 'anthropic-3', label: 'MISS' },
        { source: 'anthropic-3', target: 'output-4' }
      ],
      tags: ['legal', 'contracts', 'compliance'],
      useCase: 'Contract review, legal research, clause extraction',
      compliance: ['Attorney-Client Privilege'],
      recommended: true
    },
    {
      id: 'case_law_search',
      name: 'Case Law Search Cache',
      description: 'Fast semantic search across legal precedents',
      icon: '📚',
      tier: 'professional',
      estimatedSavings: '$2,400/mo',
      metrics: {
        hitRate: 0.91,
        latency: 52,
        savingsPerRequest: 1.10
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'semantic_dedup', 
          position: { x: 350, y: 200 },
          config: { threshold: 0.88 }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 14400, storage: 'redis' }
        },
        { 
          type: 'openai', 
          position: { x: 850, y: 200 },
          config: { model: 'gpt-4' }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'semantic_dedup-1' },
        { source: 'semantic_dedup-1', target: 'cache_l2-2' },
        { source: 'cache_l2-2', target: 'openai-3', label: 'MISS' },
        { source: 'openai-3', target: 'output-4' }
      ],
      tags: ['legal', 'research', 'semantic-search'],
      useCase: 'Case law research, precedent analysis',
      compliance: []
    }
  ],

  ecommerce: [
    {
      id: 'product_recommendations',
      name: 'AI Product Recommendations',
      description: 'Personalized product suggestions with high-speed caching',
      icon: '🛍️',
      tier: 'professional',
      estimatedSavings: '$4,100/mo',
      metrics: {
        hitRate: 0.94,
        latency: 35,
        savingsPerRequest: 0.75
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 180, max_size: '1GB' }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 1800, storage: 'redis' }
        },
        { 
          type: 'openai', 
          position: { x: 850, y: 200 },
          config: { model: 'gpt-3.5-turbo', temperature: 0.7 }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS' },
        { source: 'cache_l2-2', target: 'openai-3', label: 'MISS' },
        { source: 'openai-3', target: 'output-4' }
      ],
      tags: ['ecommerce', 'recommendations', 'personalization'],
      useCase: 'Product recommendations, upselling, cross-selling',
      recommended: true
    },
    {
      id: 'customer_support',
      name: 'E-commerce Support Bot',
      description: 'AI customer support with order context caching',
      icon: '💬',
      tier: 'starter',
      estimatedSavings: '$1,900/mo',
      metrics: {
        hitRate: 0.87,
        latency: 48,
        savingsPerRequest: 0.65
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 300 }
        },
        { 
          type: 'semantic_dedup', 
          position: { x: 600, y: 200 },
          config: { threshold: 0.90 }
        },
        { 
          type: 'openai', 
          position: { x: 850, y: 200 },
          config: { model: 'gpt-3.5-turbo' }
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'semantic_dedup-2', label: 'MISS' },
        { source: 'semantic_dedup-2', target: 'openai-3' },
        { source: 'openai-3', target: 'output-4' }
      ],
      tags: ['ecommerce', 'support', 'chatbot'],
      useCase: 'Customer support, order status, FAQ',
      recommended: true
    }
  ],

  saas: [
    {
      id: 'multi_tenant_api',
      name: 'Multi-Tenant API Cache',
      description: 'Isolated caching per tenant with cost allocation',
      icon: '☁️',
      tier: 'professional',
      estimatedSavings: '$3,800/mo',
      metrics: {
        hitRate: 0.89,
        latency: 52,
        savingsPerRequest: 1.25
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 300, namespace_isolation: true }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 1800, storage: 'redis' }
        },
        { 
          type: 'semantic_dedup', 
          position: { x: 850, y: 200 },
          config: { threshold: 0.92 }
        },
        { 
          type: 'openai', 
          position: { x: 1100, y: 200 },
          config: { model: 'gpt-4' }
        },
        { type: 'output', position: { x: 1350, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS' },
        { source: 'cache_l2-2', target: 'semantic_dedup-3', label: 'MISS' },
        { source: 'semantic_dedup-3', target: 'openai-4' },
        { source: 'openai-4', target: 'output-5' }
      ],
      tags: ['multi-tenant', 'saas', 'isolation'],
      useCase: 'B2B SaaS AI features, per-customer caching',
      recommended: true
    }
  ],

  general: [
    {
      id: 'basic_llm_cache',
      name: 'Basic LLM Cache',
      description: 'Simple, fast caching for any LLM API',
      icon: '🤖',
      tier: 'starter',
      estimatedSavings: '$1,200/mo',
      metrics: {
        hitRate: 0.82,
        latency: 48,
        savingsPerRequest: 0.85
      },
      nodes: [
        { type: 'input', position: { x: 100, y: 200 }, config: {} },
        { 
          type: 'cache_l1', 
          position: { x: 350, y: 200 },
          config: { ttl: 600 }
        },
        { 
          type: 'cache_l2', 
          position: { x: 600, y: 200 },
          config: { ttl: 3600 }
        },
        { 
          type: 'openai', 
          position: { x: 850, y: 200 },
          config: {}
        },
        { type: 'output', position: { x: 1100, y: 200 }, config: {} }
      ],
      edges: [
        { source: 'input-0', target: 'cache_l1-1' },
        { source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS' },
        { source: 'cache_l2-2', target: 'openai-3', label: 'MISS' },
        { source: 'openai-3', target: 'output-4' }
      ],
      tags: ['simple', 'starter', 'llm'],
      useCase: 'Basic chatbots, simple API caching',
      recommended: true
    }
  ]
};

export function getPresetsBySector(sector) {
  return PIPELINE_PRESETS[sector] || PIPELINE_PRESETS.general;
}

export function getPresetById(presetId) {
  for (const presets of Object.values(PIPELINE_PRESETS)) {
    const preset = presets.find(p => p.id === presetId);
    if (preset) return preset;
  }
  return null;
}

export function getRecommendedPresets(sector) {
  const presets = getPresetsBySector(sector);
  return presets.filter(p => p.recommended);
}
