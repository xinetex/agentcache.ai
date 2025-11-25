/**
 * Demo Data Loader
 * Pre-populates the studio with example pipelines for demos and screenshots
 */

export const DEMO_PIPELINES = [
  {
    name: 'HIPAA-Compliant RAG',
    sector: 'healthcare',
    isActive: true,
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    estimatedSavings: '$4,200/mo',
    nodes: [
      { 
        id: 'input-0', 
        type: 'input', 
        position: { x: 100, y: 200 },
        data: {
          label: 'INPUT',
          config: {},
          metrics: { hitRate: 87, latency: 48, savings: 0 }
        }
      },
      { 
        id: 'phi_filter-1', 
        type: 'phi_filter', 
        position: { x: 350, y: 200 },
        data: {
          label: 'PHI FILTER',
          config: { threshold: 0.95, redaction: 'mask' },
          metrics: { hitRate: 87, latency: 48, savings: 0 }
        }
      },
      { 
        id: 'cache_l1-2', 
        type: 'cache_l1', 
        position: { x: 600, y: 200 },
        data: {
          label: 'CACHE L1',
          config: { ttl: 300, max_size: '500MB' },
          metrics: { hitRate: 88, latency: 12, savings: 1200 }
        }
      },
      { 
        id: 'cache_l2-3', 
        type: 'cache_l2', 
        position: { x: 850, y: 200 },
        data: {
          label: 'CACHE L2',
          config: { ttl: 3600, storage: 'redis' },
          metrics: { hitRate: 85, latency: 35, savings: 1800 }
        }
      },
      { 
        id: 'openai-4', 
        type: 'openai', 
        position: { x: 1100, y: 200 },
        data: {
          label: 'OPENAI',
          config: { model: 'gpt-4', temperature: 0.7 },
          metrics: { hitRate: 0, latency: 850, savings: 0 }
        }
      },
      { 
        id: 'hipaa_audit-5', 
        type: 'hipaa_audit', 
        position: { x: 1350, y: 200 },
        data: {
          label: 'HIPAA AUDIT',
          config: { retention: '7 years', log_level: 'full' },
          metrics: { hitRate: 0, latency: 5, savings: 0 }
        }
      },
      { 
        id: 'output-6', 
        type: 'output', 
        position: { x: 1600, y: 200 },
        data: {
          label: 'OUTPUT',
          config: {},
          metrics: { hitRate: 87, latency: 48, savings: 0 }
        }
      }
    ],
    edges: [
      { id: 'e0', source: 'input-0', target: 'phi_filter-1', animated: true, type: 'smoothstep' },
      { id: 'e1', source: 'phi_filter-1', target: 'cache_l1-2', animated: true, type: 'smoothstep' },
      { id: 'e2', source: 'cache_l1-2', target: 'cache_l2-3', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e3', source: 'cache_l2-3', target: 'openai-4', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e4', source: 'openai-4', target: 'hipaa_audit-5', animated: true, type: 'smoothstep' },
      { id: 'e5', source: 'hipaa_audit-5', target: 'output-6', animated: true, type: 'smoothstep' }
    ]
  },
  {
    name: 'Real-Time Fraud Detection',
    sector: 'finance',
    isActive: true,
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    estimatedSavings: '$6,500/mo',
    nodes: [
      { 
        id: 'input-0', 
        type: 'input', 
        position: { x: 100, y: 200 },
        data: {
          label: 'INPUT',
          config: {},
          metrics: { hitRate: 85, latency: 38, savings: 0 }
        }
      },
      { 
        id: 'fraud_detector-1', 
        type: 'fraud_detector', 
        position: { x: 350, y: 200 },
        data: {
          label: 'FRAUD DETECTOR',
          config: { threshold: 0.8, check_velocity: true },
          metrics: { hitRate: 85, latency: 38, savings: 0 }
        }
      },
      { 
        id: 'cache_l1-2', 
        type: 'cache_l1', 
        position: { x: 600, y: 200 },
        data: {
          label: 'CACHE L1',
          config: { ttl: 120, max_size: '500MB' },
          metrics: { hitRate: 90, latency: 8, savings: 2200 }
        }
      },
      { 
        id: 'openai-3', 
        type: 'openai', 
        position: { x: 850, y: 200 },
        data: {
          label: 'OPENAI',
          config: { model: 'gpt-4', temperature: 0.3 },
          metrics: { hitRate: 0, latency: 780, savings: 0 }
        }
      },
      { 
        id: 'pci_audit-4', 
        type: 'pci_audit', 
        position: { x: 1100, y: 200 },
        data: {
          label: 'PCI AUDIT',
          config: { retention: '7 years' },
          metrics: { hitRate: 0, latency: 3, savings: 0 }
        }
      },
      { 
        id: 'output-5', 
        type: 'output', 
        position: { x: 1350, y: 200 },
        data: {
          label: 'OUTPUT',
          config: {},
          metrics: { hitRate: 85, latency: 38, savings: 0 }
        }
      }
    ],
    edges: [
      { id: 'e0', source: 'input-0', target: 'fraud_detector-1', animated: true, type: 'smoothstep' },
      { id: 'e1', source: 'fraud_detector-1', target: 'cache_l1-2', animated: true, type: 'smoothstep' },
      { id: 'e2', source: 'cache_l1-2', target: 'openai-3', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e3', source: 'openai-3', target: 'pci_audit-4', animated: true, type: 'smoothstep' },
      { id: 'e4', source: 'pci_audit-4', target: 'output-5', animated: true, type: 'smoothstep' }
    ]
  },
  {
    name: 'Legal Contract Analysis',
    sector: 'legal',
    isActive: false,
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    estimatedSavings: '$5,200/mo',
    nodes: [
      { 
        id: 'input-0', 
        type: 'input', 
        position: { x: 100, y: 200 },
        data: {
          label: 'INPUT',
          config: {},
          metrics: { hitRate: 83, latency: 78, savings: 0 }
        }
      },
      { 
        id: 'cache_l1-1', 
        type: 'cache_l1', 
        position: { x: 350, y: 200 },
        data: {
          label: 'CACHE L1',
          config: { ttl: 900, max_size: '750MB' },
          metrics: { hitRate: 83, latency: 15, savings: 1600 }
        }
      },
      { 
        id: 'cache_l2-2', 
        type: 'cache_l2', 
        position: { x: 600, y: 200 },
        data: {
          label: 'CACHE L2',
          config: { ttl: 7200, storage: 'postgresql' },
          metrics: { hitRate: 78, latency: 45, savings: 2400 }
        }
      },
      { 
        id: 'anthropic-3', 
        type: 'anthropic', 
        position: { x: 850, y: 200 },
        data: {
          label: 'ANTHROPIC',
          config: { model: 'claude-3-opus', temperature: 0.2 },
          metrics: { hitRate: 0, latency: 920, savings: 0 }
        }
      },
      { 
        id: 'output-4', 
        type: 'output', 
        position: { x: 1100, y: 200 },
        data: {
          label: 'OUTPUT',
          config: {},
          metrics: { hitRate: 83, latency: 78, savings: 0 }
        }
      }
    ],
    edges: [
      { id: 'e0', source: 'input-0', target: 'cache_l1-1', animated: true, type: 'smoothstep' },
      { id: 'e1', source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e2', source: 'cache_l2-2', target: 'anthropic-3', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e3', source: 'anthropic-3', target: 'output-4', animated: true, type: 'smoothstep' }
    ]
  },
  {
    name: 'E-commerce Recommendations',
    sector: 'ecommerce',
    isActive: true,
    savedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    estimatedSavings: '$4,100/mo',
    nodes: [
      { 
        id: 'input-0', 
        type: 'input', 
        position: { x: 100, y: 200 },
        data: {
          label: 'INPUT',
          config: {},
          metrics: { hitRate: 94, latency: 35, savings: 0 }
        }
      },
      { 
        id: 'cache_l1-1', 
        type: 'cache_l1', 
        position: { x: 350, y: 200 },
        data: {
          label: 'CACHE L1',
          config: { ttl: 180, max_size: '1GB' },
          metrics: { hitRate: 94, latency: 8, savings: 1800 }
        }
      },
      { 
        id: 'cache_l2-2', 
        type: 'cache_l2', 
        position: { x: 600, y: 200 },
        data: {
          label: 'CACHE L2',
          config: { ttl: 1800, storage: 'redis' },
          metrics: { hitRate: 89, latency: 22, savings: 1500 }
        }
      },
      { 
        id: 'openai-3', 
        type: 'openai', 
        position: { x: 850, y: 200 },
        data: {
          label: 'OPENAI',
          config: { model: 'gpt-3.5-turbo', temperature: 0.7 },
          metrics: { hitRate: 0, latency: 650, savings: 0 }
        }
      },
      { 
        id: 'output-4', 
        type: 'output', 
        position: { x: 1100, y: 200 },
        data: {
          label: 'OUTPUT',
          config: {},
          metrics: { hitRate: 94, latency: 35, savings: 0 }
        }
      }
    ],
    edges: [
      { id: 'e0', source: 'input-0', target: 'cache_l1-1', animated: true, type: 'smoothstep' },
      { id: 'e1', source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e2', source: 'cache_l2-2', target: 'openai-3', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e3', source: 'openai-3', target: 'output-4', animated: true, type: 'smoothstep' }
    ]
  },
  {
    name: 'Multi-Tenant SaaS Cache',
    sector: 'saas',
    isActive: false,
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    estimatedSavings: '$3,800/mo',
    nodes: [
      { 
        id: 'input-0', 
        type: 'input', 
        position: { x: 100, y: 200 },
        data: {
          label: 'INPUT',
          config: {},
          metrics: { hitRate: 89, latency: 52, savings: 0 }
        }
      },
      { 
        id: 'cache_l1-1', 
        type: 'cache_l1', 
        position: { x: 350, y: 200 },
        data: {
          label: 'CACHE L1',
          config: { ttl: 300, namespace_isolation: true },
          metrics: { hitRate: 89, latency: 10, savings: 1400 }
        }
      },
      { 
        id: 'cache_l2-2', 
        type: 'cache_l2', 
        position: { x: 600, y: 200 },
        data: {
          label: 'CACHE L2',
          config: { ttl: 1800, storage: 'redis' },
          metrics: { hitRate: 84, latency: 32, savings: 1600 }
        }
      },
      { 
        id: 'semantic_dedup-3', 
        type: 'semantic_dedup', 
        position: { x: 850, y: 200 },
        data: {
          label: 'SEMANTIC DEDUP',
          config: { threshold: 0.92 },
          metrics: { hitRate: 78, latency: 45, savings: 800 }
        }
      },
      { 
        id: 'openai-4', 
        type: 'openai', 
        position: { x: 1100, y: 200 },
        data: {
          label: 'OPENAI',
          config: { model: 'gpt-4' },
          metrics: { hitRate: 0, latency: 820, savings: 0 }
        }
      },
      { 
        id: 'output-5', 
        type: 'output', 
        position: { x: 1350, y: 200 },
        data: {
          label: 'OUTPUT',
          config: {},
          metrics: { hitRate: 89, latency: 52, savings: 0 }
        }
      }
    ],
    edges: [
      { id: 'e0', source: 'input-0', target: 'cache_l1-1', animated: true, type: 'smoothstep' },
      { id: 'e1', source: 'cache_l1-1', target: 'cache_l2-2', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e2', source: 'cache_l2-2', target: 'semantic_dedup-3', label: 'MISS', animated: true, type: 'smoothstep' },
      { id: 'e3', source: 'semantic_dedup-3', target: 'openai-4', animated: true, type: 'smoothstep' },
      { id: 'e4', source: 'openai-4', target: 'output-5', animated: true, type: 'smoothstep' }
    ]
  }
];

/**
 * Load demo data into localStorage
 * @param {boolean} force - Force reload even if data exists
 */
export function loadDemoData(force = false) {
  const existing = localStorage.getItem('savedPipelines');
  
  // Only load if no data exists or force is true
  if (!existing || force || existing === '[]') {
    localStorage.setItem('savedPipelines', JSON.stringify(DEMO_PIPELINES));
    console.log('✅ Demo data loaded:', DEMO_PIPELINES.length, 'pipelines');
    return true;
  }
  
  console.log('ℹ️ Demo data already exists, skipping load');
  return false;
}

/**
 * Check if we're in demo mode
 */
export function isDemoMode() {
  return window.location.search.includes('demo=true') || 
         window.location.pathname.includes('/demo');
}

/**
 * Initialize demo mode if needed
 */
export function initDemoMode() {
  if (isDemoMode()) {
    loadDemoData(true); // Force reload in demo mode
  }
}
