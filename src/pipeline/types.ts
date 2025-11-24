/**
 * Pipeline Composer - Data Model
 * 
 * Visual no-code cache orchestration for data lakehouses.
 * Think Zapier meets Unity Catalog for AI caching.
 */

// ============================================================
// NODE TYPES - The building blocks of pipelines
// ============================================================

export type NodeCategory = 'source' | 'cache' | 'validation' | 'llm' | 'output' | 'transform';

export interface NodeType {
  id: string;
  category: NodeCategory;
  name: string;
  icon: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  config: ConfigField[];
  // Smart defaults based on platform detection
  autoConfig?: (context: PipelineContext) => Partial<NodeConfig>;
}

export interface PortDefinition {
  id: string;
  name: string;
  type: 'prompt' | 'response' | 'embedding' | 'metadata' | 'trigger' | 'any';
  required?: boolean;
  multiple?: boolean; // Can accept multiple connections
}

export interface ConfigField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'code' | 'secret';
  default?: any;
  options?: { value: string; label: string }[]; // For select type
  description?: string;
  required?: boolean;
  advanced?: boolean; // Hide in basic mode
  validation?: string; // Regex or validation rule
}

// ============================================================
// NODE DEFINITIONS - Pre-built node library
// ============================================================

export const NODE_LIBRARY: NodeType[] = [
  // -------------------- DATA SOURCES --------------------
  {
    id: 'databricks',
    category: 'source',
    name: 'Databricks',
    icon: '🧱',
    description: 'Connect to Databricks workspace, Unity Catalog, or Delta Lake',
    inputs: [],
    outputs: [
      { id: 'data', name: 'Data', type: 'any' },
      { id: 'trigger', name: 'Change Trigger', type: 'trigger' }
    ],
    config: [
      { id: 'workspace_url', name: 'Workspace URL', type: 'string', required: true },
      { id: 'token', name: 'Access Token', type: 'secret', required: true },
      { id: 'catalog', name: 'Unity Catalog', type: 'string' },
      { id: 'schema', name: 'Schema', type: 'string' },
      { id: 'table', name: 'Table/View', type: 'string' },
      { id: 'query', name: 'SQL Query', type: 'code', advanced: true },
      { id: 'change_detection', name: 'Enable Change Detection', type: 'boolean', default: true },
    ],
    autoConfig: (ctx) => ({
      workspace_url: ctx.detected?.databricks?.workspaceUrl,
      catalog: ctx.detected?.databricks?.defaultCatalog,
    })
  },
  {
    id: 'snowflake',
    category: 'source',
    name: 'Snowflake',
    icon: '❄️',
    description: 'Connect to Snowflake data warehouse and Cortex AI',
    inputs: [],
    outputs: [
      { id: 'data', name: 'Data', type: 'any' },
      { id: 'trigger', name: 'Change Trigger', type: 'trigger' }
    ],
    config: [
      { id: 'account', name: 'Account Identifier', type: 'string', required: true },
      { id: 'username', name: 'Username', type: 'string', required: true },
      { id: 'password', name: 'Password', type: 'secret', required: true },
      { id: 'warehouse', name: 'Warehouse', type: 'string' },
      { id: 'database', name: 'Database', type: 'string' },
      { id: 'schema', name: 'Schema', type: 'string' },
      { id: 'query', name: 'SQL Query', type: 'code', advanced: true },
    ]
  },
  {
    id: 'vector_db',
    category: 'source',
    name: 'Vector Database',
    icon: '🔮',
    description: 'Connect to Pinecone, Weaviate, Qdrant, ChromaDB, or Milvus',
    inputs: [
      { id: 'query_embedding', name: 'Query Embedding', type: 'embedding' }
    ],
    outputs: [
      { id: 'results', name: 'Search Results', type: 'any' },
      { id: 'metadata', name: 'Result Metadata', type: 'metadata' }
    ],
    config: [
      { id: 'provider', name: 'Provider', type: 'select', required: true, options: [
        { value: 'pinecone', label: 'Pinecone' },
        { value: 'weaviate', label: 'Weaviate' },
        { value: 'qdrant', label: 'Qdrant' },
        { value: 'chromadb', label: 'ChromaDB' },
        { value: 'milvus', label: 'Milvus' },
        { value: 'pgvector', label: 'pgvector (PostgreSQL)' },
      ]},
      { id: 'api_key', name: 'API Key', type: 'secret' },
      { id: 'index', name: 'Index/Collection', type: 'string', required: true },
      { id: 'top_k', name: 'Top K Results', type: 'number', default: 5 },
      { id: 'threshold', name: 'Similarity Threshold', type: 'number', default: 0.7 },
    ]
  },
  {
    id: 'url_source',
    category: 'source',
    name: 'URL Monitor',
    icon: '🌐',
    description: 'Monitor web pages for changes and trigger cache invalidation',
    inputs: [],
    outputs: [
      { id: 'content', name: 'Page Content', type: 'any' },
      { id: 'trigger', name: 'Change Trigger', type: 'trigger' }
    ],
    config: [
      { id: 'url', name: 'URL', type: 'string', required: true },
      { id: 'check_interval', name: 'Check Interval (ms)', type: 'number', default: 900000 },
      { id: 'selector', name: 'CSS Selector', type: 'string', advanced: true },
      { id: 'headers', name: 'Custom Headers', type: 'json', advanced: true },
    ]
  },

  // -------------------- CACHE LAYERS --------------------
  {
    id: 'cache_l1',
    category: 'cache',
    name: 'L1 Hot Cache',
    icon: '🔥',
    description: 'In-memory edge cache with sub-5ms latency',
    inputs: [
      { id: 'request', name: 'Request', type: 'prompt', required: true }
    ],
    outputs: [
      { id: 'hit', name: 'Cache Hit', type: 'response' },
      { id: 'miss', name: 'Cache Miss', type: 'prompt' }
    ],
    config: [
      { id: 'ttl', name: 'TTL (seconds)', type: 'number', default: 300 },
      { id: 'max_size', name: 'Max Size (MB)', type: 'number', default: 100 },
    ]
  },
  {
    id: 'cache_l2',
    category: 'cache',
    name: 'L2 Warm Cache',
    icon: '🟠',
    description: 'Redis-backed distributed cache with <50ms latency',
    inputs: [
      { id: 'request', name: 'Request', type: 'prompt', required: true }
    ],
    outputs: [
      { id: 'hit', name: 'Cache Hit', type: 'response' },
      { id: 'miss', name: 'Cache Miss', type: 'prompt' }
    ],
    config: [
      { id: 'ttl', name: 'TTL (seconds)', type: 'number', default: 86400 },
      { id: 'namespace', name: 'Namespace', type: 'string', default: 'default' },
      { id: 'region', name: 'Region', type: 'select', options: [
        { value: 'us-east-1', label: 'US East (Virginia)' },
        { value: 'eu-west-1', label: 'EU West (Ireland)' },
        { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
        { value: 'auto', label: 'Auto (Nearest)' },
      ], default: 'auto' },
    ]
  },
  {
    id: 'cache_l3',
    category: 'cache',
    name: 'L3 Cold Cache',
    icon: '🧊',
    description: 'Vector-backed semantic cache for "infinite memory"',
    inputs: [
      { id: 'request', name: 'Request', type: 'prompt', required: true }
    ],
    outputs: [
      { id: 'hit', name: 'Semantic Match', type: 'response' },
      { id: 'miss', name: 'No Match', type: 'prompt' }
    ],
    config: [
      { id: 'similarity_threshold', name: 'Similarity Threshold', type: 'number', default: 0.92 },
      { id: 'embedding_model', name: 'Embedding Model', type: 'select', options: [
        { value: 'text-embedding-3-small', label: 'OpenAI Small' },
        { value: 'text-embedding-3-large', label: 'OpenAI Large' },
        { value: 'voyage-large-2', label: 'Voyage AI' },
        { value: 'bge-large-en-v1.5', label: 'BGE (Local)' },
      ]},
      { id: 'max_results', name: 'Max Results', type: 'number', default: 3 },
    ]
  },
  {
    id: 'cache_reasoning',
    category: 'cache',
    name: 'Reasoning Cache',
    icon: '🧠',
    description: 'Cache expensive reasoning traces from o1, Kimi, DeepSeek',
    inputs: [
      { id: 'request', name: 'Request', type: 'prompt', required: true }
    ],
    outputs: [
      { id: 'hit', name: 'Cached Reasoning', type: 'response' },
      { id: 'miss', name: 'Needs Reasoning', type: 'prompt' },
      { id: 'tokens', name: 'Reasoning Tokens', type: 'metadata' }
    ],
    config: [
      { id: 'cache_traces', name: 'Cache Reasoning Traces', type: 'boolean', default: true },
      { id: 'trace_ttl', name: 'Trace TTL (days)', type: 'number', default: 30 },
    ]
  },

  // -------------------- VALIDATION GATES --------------------
  {
    id: 'validation_cognitive',
    category: 'validation',
    name: 'Cognitive Validator',
    icon: '🛡️',
    description: 'Validate responses against knowledge base, detect hallucinations',
    inputs: [
      { id: 'response', name: 'LLM Response', type: 'response', required: true },
      { id: 'context', name: 'Source Context', type: 'any' }
    ],
    outputs: [
      { id: 'validated', name: 'Validated Response', type: 'response' },
      { id: 'rejected', name: 'Rejected Response', type: 'response' },
      { id: 'score', name: 'Confidence Score', type: 'metadata' }
    ],
    config: [
      { id: 'threshold', name: 'Confidence Threshold', type: 'number', default: 0.7 },
      { id: 'strict_mode', name: 'Strict Mode', type: 'boolean', default: false },
      { id: 'check_sources', name: 'Verify Against Sources', type: 'boolean', default: true },
    ]
  },
  {
    id: 'validation_freshness',
    category: 'validation',
    name: 'Freshness Gate',
    icon: '⏰',
    description: 'Check cache freshness, trigger refresh if stale',
    inputs: [
      { id: 'cached', name: 'Cached Response', type: 'response', required: true },
      { id: 'trigger', name: 'Change Trigger', type: 'trigger' }
    ],
    outputs: [
      { id: 'fresh', name: 'Fresh Response', type: 'response' },
      { id: 'stale', name: 'Stale (Needs Refresh)', type: 'prompt' }
    ],
    config: [
      { id: 'max_age', name: 'Max Age (seconds)', type: 'number', default: 3600 },
      { id: 'auto_refresh', name: 'Auto Refresh on Stale', type: 'boolean', default: false },
    ]
  },
  {
    id: 'validation_pii',
    category: 'validation',
    name: 'PII Filter',
    icon: '🔒',
    description: 'Detect and redact PII before caching (HIPAA/GDPR)',
    inputs: [
      { id: 'content', name: 'Content', type: 'any', required: true }
    ],
    outputs: [
      { id: 'clean', name: 'Redacted Content', type: 'any' },
      { id: 'detected', name: 'PII Detected', type: 'metadata' }
    ],
    config: [
      { id: 'mode', name: 'Mode', type: 'select', options: [
        { value: 'detect', label: 'Detect Only' },
        { value: 'redact', label: 'Redact' },
        { value: 'block', label: 'Block if PII Found' },
      ], default: 'redact' },
      { id: 'types', name: 'PII Types', type: 'json', default: '["email", "phone", "ssn", "credit_card"]' },
    ]
  },

  // -------------------- LLM PROVIDERS --------------------
  {
    id: 'llm_openai',
    category: 'llm',
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4, GPT-3.5-turbo, o1 reasoning models',
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'prompt', required: true },
      { id: 'context', name: 'Context', type: 'any' }
    ],
    outputs: [
      { id: 'response', name: 'Response', type: 'response' },
      { id: 'usage', name: 'Token Usage', type: 'metadata' }
    ],
    config: [
      { id: 'model', name: 'Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'o1-preview', label: 'o1 Preview (Reasoning)' },
        { value: 'o1-mini', label: 'o1 Mini' },
      ], default: 'gpt-4o' },
      { id: 'temperature', name: 'Temperature', type: 'number', default: 0.7 },
      { id: 'max_tokens', name: 'Max Tokens', type: 'number', default: 1000 },
    ]
  },
  {
    id: 'llm_anthropic',
    category: 'llm',
    name: 'Anthropic',
    icon: '🎭',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus, Haiku',
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'prompt', required: true },
      { id: 'context', name: 'Context', type: 'any' }
    ],
    outputs: [
      { id: 'response', name: 'Response', type: 'response' },
      { id: 'usage', name: 'Token Usage', type: 'metadata' }
    ],
    config: [
      { id: 'model', name: 'Model', type: 'select', options: [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      ], default: 'claude-3-5-sonnet-20241022' },
      { id: 'temperature', name: 'Temperature', type: 'number', default: 0.7 },
      { id: 'max_tokens', name: 'Max Tokens', type: 'number', default: 1000 },
    ]
  },

  // -------------------- OUTPUTS --------------------
  {
    id: 'output_webhook',
    category: 'output',
    name: 'Webhook',
    icon: '📤',
    description: 'Send results to external webhook endpoint',
    inputs: [
      { id: 'data', name: 'Data', type: 'any', required: true }
    ],
    outputs: [],
    config: [
      { id: 'url', name: 'Webhook URL', type: 'string', required: true },
      { id: 'method', name: 'Method', type: 'select', options: [
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
      ], default: 'POST' },
      { id: 'headers', name: 'Custom Headers', type: 'json' },
    ]
  },
  {
    id: 'output_delta',
    category: 'output',
    name: 'Delta Lake',
    icon: '📊',
    description: 'Write results to Databricks Delta Lake table',
    inputs: [
      { id: 'data', name: 'Data', type: 'any', required: true }
    ],
    outputs: [],
    config: [
      { id: 'table', name: 'Table Name', type: 'string', required: true },
      { id: 'mode', name: 'Write Mode', type: 'select', options: [
        { value: 'append', label: 'Append' },
        { value: 'overwrite', label: 'Overwrite' },
        { value: 'merge', label: 'Merge (Upsert)' },
      ], default: 'append' },
    ]
  },
  {
    id: 'output_analytics',
    category: 'output',
    name: 'Analytics Dashboard',
    icon: '📈',
    description: 'Track cache metrics, costs, and performance',
    inputs: [
      { id: 'event', name: 'Event', type: 'any', required: true }
    ],
    outputs: [],
    config: [
      { id: 'track_cost', name: 'Track Cost', type: 'boolean', default: true },
      { id: 'track_latency', name: 'Track Latency', type: 'boolean', default: true },
      { id: 'track_tokens', name: 'Track Tokens', type: 'boolean', default: true },
    ]
  },
];

// ============================================================
// PIPELINE STRUCTURE
// ============================================================

export interface PipelineNode {
  id: string;
  type: string; // References NodeType.id
  position: { x: number; y: number };
  config: NodeConfig;
  label?: string; // Custom label
}

export interface NodeConfig {
  [key: string]: any;
}

export interface PipelineConnection {
  id: string;
  source: { nodeId: string; portId: string };
  target: { nodeId: string; portId: string };
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
  settings: PipelineSettings;
  metadata: PipelineMetadata;
}

export interface PipelineSettings {
  namespace: string;
  defaultTtl: number;
  region: string;
  enableLogging: boolean;
  enableMetrics: boolean;
  alertThresholds?: {
    hitRateMin?: number;
    latencyMaxMs?: number;
    costMaxDaily?: number;
  };
}

export interface PipelineMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastDeployedAt?: string;
  status: 'draft' | 'deployed' | 'paused' | 'error';
  deploymentId?: string;
}

// ============================================================
// PIPELINE CONTEXT - For intelligent auto-configuration
// ============================================================

export interface PipelineContext {
  // Detected environment
  detected?: {
    databricks?: {
      workspaceUrl: string;
      defaultCatalog: string;
      currentCluster?: string;
    };
    snowflake?: {
      account: string;
      warehouse: string;
    };
    vectorDb?: {
      provider: string;
      endpoint: string;
    };
  };
  // User preferences
  preferences?: {
    defaultRegion: string;
    defaultTtl: number;
    complianceMode: 'standard' | 'hipaa' | 'gdpr';
  };
  // Current session
  session?: {
    userId: string;
    apiKey: string;
    namespace: string;
  };
}

// ============================================================
// PIPELINE TEMPLATES - Pre-built patterns
// ============================================================

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'rag' | 'analytics' | 'compliance' | 'cost-optimization';
  icon: string;
  pipeline: Omit<Pipeline, 'id' | 'metadata'>;
  estimatedSavings?: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'databricks-rag-basic',
    name: 'Databricks RAG Optimizer',
    description: 'Cache LLM responses in your Databricks RAG pipeline. Reduces inference costs by 90%.',
    category: 'rag',
    icon: '🧱',
    complexity: 'beginner',
    estimatedSavings: '$2,500/month at 100K queries',
    pipeline: {
      name: 'Databricks RAG Optimizer',
      version: 1,
      nodes: [
        { id: 'n1', type: 'databricks', position: { x: 100, y: 100 }, config: {} },
        { id: 'n2', type: 'vector_db', position: { x: 100, y: 250 }, config: { provider: 'chromadb' } },
        { id: 'n3', type: 'cache_l2', position: { x: 350, y: 175 }, config: { namespace: 'databricks/rag' } },
        { id: 'n4', type: 'llm_openai', position: { x: 550, y: 175 }, config: { model: 'gpt-4o' } },
        { id: 'n5', type: 'output_analytics', position: { x: 750, y: 175 }, config: {} },
      ],
      connections: [
        { id: 'c1', source: { nodeId: 'n1', portId: 'data' }, target: { nodeId: 'n2', portId: 'query_embedding' } },
        { id: 'c2', source: { nodeId: 'n2', portId: 'results' }, target: { nodeId: 'n3', portId: 'request' } },
        { id: 'c3', source: { nodeId: 'n3', portId: 'miss' }, target: { nodeId: 'n4', portId: 'prompt' } },
        { id: 'c4', source: { nodeId: 'n4', portId: 'response' }, target: { nodeId: 'n5', portId: 'event' } },
      ],
      settings: {
        namespace: 'databricks/rag',
        defaultTtl: 86400,
        region: 'auto',
        enableLogging: true,
        enableMetrics: true,
      },
    },
  },
  {
    id: 'enterprise-compliance',
    name: 'Enterprise Compliance Pipeline',
    description: 'Full audit trail, PII filtering, cognitive validation. HIPAA/GDPR ready.',
    category: 'compliance',
    icon: '🔒',
    complexity: 'advanced',
    pipeline: {
      name: 'Enterprise Compliance',
      version: 1,
      nodes: [
        { id: 'n1', type: 'cache_l2', position: { x: 100, y: 150 }, config: { namespace: 'enterprise/compliant' } },
        { id: 'n2', type: 'validation_pii', position: { x: 300, y: 150 }, config: { mode: 'redact' } },
        { id: 'n3', type: 'llm_anthropic', position: { x: 500, y: 100 }, config: { model: 'claude-3-5-sonnet-20241022' } },
        { id: 'n4', type: 'validation_cognitive', position: { x: 500, y: 250 }, config: { threshold: 0.8 } },
        { id: 'n5', type: 'output_analytics', position: { x: 700, y: 150 }, config: {} },
      ],
      connections: [
        { id: 'c1', source: { nodeId: 'n1', portId: 'miss' }, target: { nodeId: 'n2', portId: 'content' } },
        { id: 'c2', source: { nodeId: 'n2', portId: 'clean' }, target: { nodeId: 'n3', portId: 'prompt' } },
        { id: 'c3', source: { nodeId: 'n3', portId: 'response' }, target: { nodeId: 'n4', portId: 'response' } },
        { id: 'c4', source: { nodeId: 'n4', portId: 'validated' }, target: { nodeId: 'n5', portId: 'event' } },
      ],
      settings: {
        namespace: 'enterprise/compliant',
        defaultTtl: 604800,
        region: 'us-east-1',
        enableLogging: true,
        enableMetrics: true,
        alertThresholds: {
          hitRateMin: 70,
          latencyMaxMs: 500,
        },
      },
    },
  },
  {
    id: 'reasoning-optimizer',
    name: 'Reasoning Model Optimizer',
    description: 'Cache expensive o1/DeepSeek reasoning traces. Save 98% on thinking tokens.',
    category: 'cost-optimization',
    icon: '🧠',
    complexity: 'intermediate',
    estimatedSavings: '$10,000/month at 50K reasoning queries',
    pipeline: {
      name: 'Reasoning Optimizer',
      version: 1,
      nodes: [
        { id: 'n1', type: 'cache_reasoning', position: { x: 100, y: 150 }, config: { cache_traces: true } },
        { id: 'n2', type: 'llm_openai', position: { x: 350, y: 150 }, config: { model: 'o1-preview' } },
        { id: 'n3', type: 'cache_l2', position: { x: 550, y: 150 }, config: { ttl: 2592000 } }, // 30 days
        { id: 'n4', type: 'output_analytics', position: { x: 750, y: 150 }, config: {} },
      ],
      connections: [
        { id: 'c1', source: { nodeId: 'n1', portId: 'miss' }, target: { nodeId: 'n2', portId: 'prompt' } },
        { id: 'c2', source: { nodeId: 'n2', portId: 'response' }, target: { nodeId: 'n3', portId: 'request' } },
        { id: 'c3', source: { nodeId: 'n3', portId: 'hit' }, target: { nodeId: 'n4', portId: 'event' } },
      ],
      settings: {
        namespace: 'reasoning/o1',
        defaultTtl: 2592000,
        region: 'auto',
        enableLogging: true,
        enableMetrics: true,
      },
    },
  },
];

// ============================================================
// EXPORT
// ============================================================

export default {
  NODE_LIBRARY,
  PIPELINE_TEMPLATES,
};
