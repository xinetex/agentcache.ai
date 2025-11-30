/**
 * Starter Pipeline Generator
 * Generates sector-specific cache configurations with cost savings projections
 */

const SECTOR_PRESETS = {
  healthcare: {
    name: 'HIPAA-Compliant Patient Data Cache',
    description: 'Secure caching for electronic health records and clinical queries',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'EHR API', config: { endpoint: '/api/patients' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (256MB)', config: { ttl: 300, size: '256MB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 3600, provider: 'redis' } },
      { id: 'compliance-1', type: 'hipaa_encryption', label: 'HIPAA Encryption', config: { encrypt: true, audit: true } },
      { id: 'db-1', type: 'database', label: 'PostgreSQL', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'compliance-1' },
      { from: 'compliance-1', to: 'db-1' },
    ],
    complexity: 'moderate',
    estimatedHitRate: 0.82,
    projectedSavings: 2400,
    avgLatency: 145,
    compliance: ['HIPAA', 'SOC2'],
  },
  
  finance: {
    name: 'PCI-DSS Trading & Market Data Cache',
    description: 'Real-time market data caching with fraud detection',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'Market Data API', config: { endpoint: '/api/market' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (512MB)', config: { ttl: 60, size: '512MB' } },
      { id: 'validation-1', type: 'fraud_check', label: 'Fraud Detection', config: { threshold: 0.95 } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 300, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'TimescaleDB', config: { type: 'timescaledb' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'validation-1' },
      { from: 'validation-1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'moderate',
    estimatedHitRate: 0.75,
    projectedSavings: 3800,
    avgLatency: 98,
    compliance: ['PCI-DSS', 'SOC2'],
  },
  
  ecommerce: {
    name: 'Product Catalog & Cart Cache',
    description: 'High-performance product and inventory caching',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'Product API', config: { endpoint: '/api/products' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (1GB)', config: { ttl: 3600, size: '1GB' } },
      { id: 'cdn-1', type: 'cdn', label: 'CDN Edge Cache', config: { provider: 'cloudflare' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 7200, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'MongoDB', config: { type: 'mongodb' } },
    ],
    connections: [
      { from: 'source-1', to: 'cdn-1' },
      { from: 'cdn-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'moderate',
    estimatedHitRate: 0.88,
    projectedSavings: 1900,
    avgLatency: 112,
    compliance: [],
  },
  
  filestorage: {
    name: 'File Metadata & Deduplication Cache',
    description: 'Seagate Lyve Cloud integration with file deduplication',
    nodes: [
      { id: 'source-1', type: 'seagate_lyve', label: 'Seagate Lyve Cloud', config: { bucket: 'production' } },
      { id: 'dedup-1', type: 'file_dedup', label: 'File Deduplication', config: { checksum: 'sha256' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'Metadata Cache', config: { ttl: 1800, size: '512MB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 7200, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'PostgreSQL', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'dedup-1' },
      { from: 'dedup-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'complex',
    estimatedHitRate: 0.79,
    projectedSavings: 5200,
    avgLatency: 156,
    compliance: ['SOC2'],
  },
  
  legal: {
    name: 'Document Analysis & Contract Cache',
    description: 'Privilege-protected legal document caching',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'Document API', config: { endpoint: '/api/documents' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (256MB)', config: { ttl: 600, size: '256MB' } },
      { id: 'privilege-1', type: 'privilege_filter', label: 'Privilege Protection', config: { redact: true } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 1800, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'PostgreSQL', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'privilege-1' },
      { from: 'privilege-1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'moderate',
    estimatedHitRate: 0.71,
    projectedSavings: 2100,
    avgLatency: 167,
    compliance: ['SOC2'],
  },
  
  education: {
    name: 'Learning Management System Cache',
    description: 'Course content and student data caching',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'LMS API', config: { endpoint: '/api/courses' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (512MB)', config: { ttl: 1800, size: '512MB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 3600, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'PostgreSQL', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'simple',
    estimatedHitRate: 0.85,
    projectedSavings: 1600,
    avgLatency: 124,
    compliance: ['FERPA'],
  },
  
  enterprise: {
    name: 'Multi-Tier Enterprise Cache',
    description: 'Comprehensive caching with all features enabled',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'Enterprise API', config: { endpoint: '/api/data' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (1GB)', config: { ttl: 600, size: '1GB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 3600, provider: 'redis' } },
      { id: 'cache-l3', type: 'cache_l3', label: 'L3 Semantic', config: { provider: 'qdrant' } },
      { id: 'db-1', type: 'database', label: 'PostgreSQL', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'cache-l3' },
      { from: 'cache-l3', to: 'db-1' },
    ],
    complexity: 'complex',
    estimatedHitRate: 0.91,
    projectedSavings: 6400,
    avgLatency: 89,
    compliance: ['SOC2', 'ISO27001'],
  },
  
  developer: {
    name: 'API Response Cache',
    description: 'Simple REST API caching layer',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'REST API', config: { endpoint: '/api' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (256MB)', config: { ttl: 300, size: '256MB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 900, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'Database', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'simple',
    estimatedHitRate: 0.78,
    projectedSavings: 1200,
    avgLatency: 105,
    compliance: [],
  },
  
  datascience: {
    name: 'Model Inference & Dataset Cache',
    description: 'ML model outputs and training data caching',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'ML API', config: { endpoint: '/api/inference' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache (2GB)', config: { ttl: 600, size: '2GB' } },
      { id: 'cache-l3', type: 'cache_l3', label: 'Vector Cache', config: { provider: 'qdrant' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 1800, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'Vector DB', config: { type: 'qdrant' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l3' },
      { from: 'cache-l3', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'complex',
    estimatedHitRate: 0.83,
    projectedSavings: 4700,
    avgLatency: 178,
    compliance: [],
  },
  
  general: {
    name: 'Standard Cache Pipeline',
    description: 'General-purpose two-tier caching',
    nodes: [
      { id: 'source-1', type: 'http_api', label: 'API', config: { endpoint: '/api' } },
      { id: 'cache-l1', type: 'cache_l1', label: 'L1 Cache', config: { ttl: 300, size: '256MB' } },
      { id: 'cache-l2', type: 'cache_l2', label: 'L2 Redis', config: { ttl: 900, provider: 'redis' } },
      { id: 'db-1', type: 'database', label: 'Database', config: { type: 'postgresql' } },
    ],
    connections: [
      { from: 'source-1', to: 'cache-l1' },
      { from: 'cache-l1', to: 'cache-l2' },
      { from: 'cache-l2', to: 'db-1' },
    ],
    complexity: 'simple',
    estimatedHitRate: 0.75,
    projectedSavings: 1000,
    avgLatency: 135,
    compliance: [],
  },
};

export function generateStarterPipeline(sector, priority = 'balanced') {
  const preset = SECTOR_PRESETS[sector] || SECTOR_PRESETS.general;
  
  // Adjust based on priority
  let adjustedPreset = { ...preset };
  
  if (priority === 'fast') {
    // Lower TTLs, more aggressive caching
    adjustedPreset.nodes = preset.nodes.map(node => {
      if (node.type.includes('cache')) {
        return {
          ...node,
          config: { ...node.config, ttl: Math.floor(node.config.ttl * 0.5) }
        };
      }
      return node;
    });
    adjustedPreset.avgLatency = Math.floor(preset.avgLatency * 0.8);
    adjustedPreset.projectedSavings = Math.floor(preset.projectedSavings * 0.9);
  } else if (priority === 'cost') {
    // Higher TTLs, more conservative
    adjustedPreset.nodes = preset.nodes.map(node => {
      if (node.type.includes('cache')) {
        return {
          ...node,
          config: { ...node.config, ttl: Math.floor(node.config.ttl * 1.5) }
        };
      }
      return node;
    });
    adjustedPreset.avgLatency = Math.floor(preset.avgLatency * 1.2);
    adjustedPreset.projectedSavings = Math.floor(preset.projectedSavings * 1.3);
  }
  
  return adjustedPreset;
}

export function getSectorList() {
  return Object.keys(SECTOR_PRESETS);
}

export function getSectorInfo(sector) {
  return SECTOR_PRESETS[sector] || SECTOR_PRESETS.general;
}

/**
 * Convert preset to lab-compatible strategy configuration
 * Used by game system to store validated strategies
 */
export function presetToLabStrategy(sector, priority = 'balanced') {
  const preset = generateStarterPipeline(sector, priority);
  
  // Extract tier information from nodes
  const hasL1 = preset.nodes.some(n => n.type === 'cache_l1');
  const hasL2 = preset.nodes.some(n => n.type === 'cache_l2');
  const hasL3 = preset.nodes.some(n => n.type === 'cache_l3');
  
  const l1Node = preset.nodes.find(n => n.type === 'cache_l1');
  const l2Node = preset.nodes.find(n => n.type === 'cache_l2');
  const l3Node = preset.nodes.find(n => n.type === 'cache_l3');
  
  return {
    name: preset.name,
    slug: preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    version: 1,
    sector: sector,
    useCase: preset.description,
    
    tiers: {
      L1: {
        enabled: hasL1,
        ttl: l1Node?.config?.ttl || 300,
        maxSize: l1Node?.config?.size || '256MB',
        policy: 'LRU',
        compression: false,
        encryption: preset.compliance.includes('HIPAA') || preset.compliance.includes('PCI-DSS'),
        prefetchEnabled: false,
        writeThrough: true,
      },
      L2: {
        enabled: hasL2,
        ttl: l2Node?.config?.ttl || 3600,
        maxSize: '1GB',
        policy: 'LRU',
        compression: true,
        encryption: preset.compliance.includes('HIPAA') || preset.compliance.includes('PCI-DSS'),
        prefetchEnabled: false,
        writeThrough: true,
      },
      L3: {
        enabled: hasL3,
        ttl: l3Node?.config?.ttl || 7200,
        maxSize: '5GB',
        policy: 'LRU',
        semantic: hasL3 && l3Node?.config?.provider === 'qdrant',
        similarityThreshold: 0.85,
        compression: true,
        encryption: false,
      },
    },
    
    validation: {
      hipaa: preset.compliance.includes('HIPAA'),
      pciDss: preset.compliance.includes('PCI-DSS'),
      soc2: preset.compliance.includes('SOC2') || preset.compliance.includes('ISO27001'),
      piiFilter: preset.compliance.includes('HIPAA') || preset.compliance.includes('FERPA'),
      phiFilter: preset.compliance.includes('HIPAA'),
      maxStalenessSeconds: priority === 'fast' ? 60 : priority === 'cost' ? 3600 : 600,
    },
    
    targets: {
      minHitRate: preset.estimatedHitRate * 100,
      maxLatencyP95: preset.avgLatency * 1.5, // p95 is ~1.5x avg
      maxCostPer1k: (preset.projectedSavings / 1000000) * 2.4, // Based on 1M queries/mo
    },
    
    complianceFlags: preset.compliance,
    tags: [sector, priority, preset.complexity],
  };
}
