/**
 * Pipeline Composer API
 * 
 * Endpoints:
 * - GET /api/pipeline/nodes      - Get available node library
 * - GET /api/pipeline/templates  - Get pipeline templates
 * - POST /api/pipeline/detect    - Detect user's platform/environment
 * - POST /api/pipeline/suggest   - Get intelligent config suggestions
 * - POST /api/pipeline/validate  - Validate pipeline configuration
 * - POST /api/pipeline/generate  - Generate deployment code
 * - POST /api/pipeline/save      - Save pipeline (CRUD)
 * - GET /api/pipeline/:id        - Get saved pipeline
 * - GET /api/pipeline            - List user's pipelines
 */

// Node library - simplified for API (full version in types.ts)
const NODE_LIBRARY = [
  // Sources
  { id: 'databricks', category: 'source', name: 'Databricks', icon: '🧱', description: 'Connect to Databricks workspace, Unity Catalog, or Delta Lake' },
  { id: 'snowflake', category: 'source', name: 'Snowflake', icon: '❄️', description: 'Connect to Snowflake data warehouse and Cortex AI' },
  { id: 'vector_db', category: 'source', name: 'Vector Database', icon: '🔮', description: 'Connect to Pinecone, Weaviate, Qdrant, ChromaDB, or Milvus' },
  { id: 'url_source', category: 'source', name: 'URL Monitor', icon: '🌐', description: 'Monitor web pages for changes and trigger cache invalidation' },
  // Cache layers
  { id: 'cache_l1', category: 'cache', name: 'L1 Hot Cache', icon: '🔥', description: 'In-memory edge cache with sub-5ms latency' },
  { id: 'cache_l2', category: 'cache', name: 'L2 Warm Cache', icon: '🟠', description: 'Redis-backed distributed cache with <50ms latency' },
  { id: 'cache_l3', category: 'cache', name: 'L3 Cold Cache', icon: '🧊', description: 'Vector-backed semantic cache for "infinite memory"' },
  { id: 'cache_reasoning', category: 'cache', name: 'Reasoning Cache', icon: '🧠', description: 'Cache expensive reasoning traces from o1, Kimi, DeepSeek' },
  // Validation
  { id: 'validation_cognitive', category: 'validation', name: 'Cognitive Validator', icon: '🛡️', description: 'Validate responses against knowledge base, detect hallucinations' },
  { id: 'validation_freshness', category: 'validation', name: 'Freshness Gate', icon: '⏰', description: 'Check cache freshness, trigger refresh if stale' },
  { id: 'validation_pii', category: 'validation', name: 'PII Filter', icon: '🔒', description: 'Detect and redact PII before caching (HIPAA/GDPR)' },
  // LLM
  { id: 'llm_openai', category: 'llm', name: 'OpenAI', icon: '🤖', description: 'GPT-4, GPT-3.5-turbo, o1 reasoning models' },
  { id: 'llm_anthropic', category: 'llm', name: 'Anthropic', icon: '🎭', description: 'Claude 3.5 Sonnet, Claude 3 Opus, Haiku' },
  // Outputs
  { id: 'output_webhook', category: 'output', name: 'Webhook', icon: '📤', description: 'Send results to external webhook endpoint' },
  { id: 'output_delta', category: 'output', name: 'Delta Lake', icon: '📊', description: 'Write results to Databricks Delta Lake table' },
  { id: 'output_analytics', category: 'output', name: 'Analytics Dashboard', icon: '📈', description: 'Track cache metrics, costs, and performance' },
  { id: 'storage_s3', category: 'output', name: 'S3 Storage', icon: '🗄️', description: 'Save artifacts and logs to S3-compatible storage' },
];

const PIPELINE_TEMPLATES = [
  {
    id: 'databricks-rag-basic',
    name: 'Databricks RAG Optimizer',
    description: 'Cache LLM responses in your Databricks RAG pipeline. Reduces inference costs by 90%.',
    category: 'rag',
    icon: '🧱',
    complexity: 'beginner',
    estimatedSavings: '$2,500/month at 100K queries',
  },
  {
    id: 'enterprise-compliance',
    name: 'Enterprise Compliance Pipeline',
    description: 'Full audit trail, PII filtering, cognitive validation. HIPAA/GDPR ready.',
    category: 'compliance',
    icon: '🔒',
    complexity: 'advanced',
  },
  {
    id: 'reasoning-optimizer',
    name: 'Reasoning Model Optimizer',
    description: 'Cache expensive o1/DeepSeek reasoning traces. Save 98% on thinking tokens.',
    category: 'cost-optimization',
    icon: '🧠',
    complexity: 'intermediate',
    estimatedSavings: '$10,000/month at 50K reasoning queries',
  },
  {
    id: 'multi-region',
    name: 'Multi-Region Cache',
    description: 'Global cache with automatic failover and region-aware routing.',
    category: 'analytics',
    icon: '🌍',
    complexity: 'advanced',
  },
  {
    id: 'semantic-dedup',
    name: 'Semantic Deduplication',
    description: 'Find semantically similar queries and serve cached responses. 70% cost reduction.',
    category: 'cost-optimization',
    icon: '🎯',
    complexity: 'intermediate',
    estimatedSavings: '$5,000/month at 200K queries',
  },
];

// Platform detection heuristics
function detectPlatform(config) {
  const detected = { platforms: [], suggestions: [] };

  // Databricks detection
  if (config.env?.DATABRICKS_HOST || config.env?.DATABRICKS_TOKEN || config.packages?.includes('databricks-sdk')) {
    detected.platforms.push({
      id: 'databricks',
      name: 'Databricks',
      confidence: 0.95,
      config: {
        workspace_url: config.env?.DATABRICKS_HOST,
        catalog: config.env?.DATABRICKS_CATALOG || 'main',
      }
    });
    detected.suggestions.push({
      title: 'Use Unity Catalog namespaces',
      description: 'Map AgentCache namespaces to Unity Catalog schemas for governance',
      priority: 'high',
    });
  }

  // Snowflake detection
  if (config.env?.SNOWFLAKE_ACCOUNT || config.env?.SNOWFLAKE_USER || config.packages?.includes('snowflake-connector-python')) {
    detected.platforms.push({
      id: 'snowflake',
      name: 'Snowflake',
      confidence: 0.95,
      config: {
        account: config.env?.SNOWFLAKE_ACCOUNT,
        warehouse: config.env?.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
      }
    });
    detected.suggestions.push({
      title: 'Enable Cortex AI caching',
      description: 'Cache Snowflake Cortex LLM function results for major cost savings',
      priority: 'high',
    });
  }

  // Vector DB detection
  const vectorDbs = [
    { key: 'PINECONE_API_KEY', name: 'Pinecone', id: 'pinecone' },
    { key: 'WEAVIATE_URL', name: 'Weaviate', id: 'weaviate' },
    { key: 'QDRANT_URL', name: 'Qdrant', id: 'qdrant' },
    { key: 'CHROMADB_HOST', name: 'ChromaDB', id: 'chromadb' },
  ];

  for (const vdb of vectorDbs) {
    if (config.env?.[vdb.key]) {
      detected.platforms.push({
        id: 'vector_db',
        name: vdb.name,
        provider: vdb.id,
        confidence: 0.9,
        config: {
          provider: vdb.id,
        }
      });
      detected.suggestions.push({
        title: `Cache ${vdb.name} embeddings`,
        description: 'Avoid regenerating embeddings for repeated content',
        priority: 'medium',
      });
      break;
    }
  }

  // LLM provider detection
  if (config.env?.OPENAI_API_KEY) {
    detected.platforms.push({
      id: 'llm_openai',
      name: 'OpenAI',
      confidence: 1.0,
    });
  }

  if (config.env?.ANTHROPIC_API_KEY) {
    detected.platforms.push({
      id: 'llm_anthropic',
      name: 'Anthropic',
      confidence: 1.0,
    });
  }

  // Use case detection from packages
  if (config.packages?.includes('langchain') || config.packages?.includes('llama-index')) {
    detected.suggestions.push({
      title: 'Enable RAG optimization',
      description: 'Detected LangChain/LlamaIndex - enable RAG-specific caching patterns',
      priority: 'high',
      template: 'databricks-rag-basic',
    });
  }

  if (config.packages?.includes('transformers') || config.packages?.includes('sentence-transformers')) {
    detected.suggestions.push({
      title: 'Cache embedding generation',
      description: 'Cache transformer embeddings to reduce GPU compute costs',
      priority: 'medium',
    });
  }

  return detected;
}

// Suggest optimal configuration based on use case
function suggestConfig(useCase, platforms, volume) {
  const suggestions = {
    ttl: 86400, // 24h default
    cacheStrategy: 'multi-layer',
    namespace: 'default',
    estimatedSavings: { monthly: 0, percentage: 0 },
    recommendedNodes: [],
    alerts: [],
  };

  // Volume-based recommendations
  const monthlyQueries = volume?.monthly || 10000;
  const avgCostPerQuery = 0.03; // $0.03 avg for GPT-4

  if (monthlyQueries > 100000) {
    suggestions.cacheStrategy = 'aggressive';
    suggestions.ttl = 604800; // 1 week for high volume
    suggestions.recommendedNodes.push('cache_l1', 'cache_l2', 'cache_l3');
    suggestions.alerts.push({
      type: 'cost',
      threshold: monthlyQueries * avgCostPerQuery * 0.3, // Alert at 30% of expected
      message: 'Daily cost exceeds expected threshold',
    });
  } else if (monthlyQueries > 10000) {
    suggestions.cacheStrategy = 'balanced';
    suggestions.recommendedNodes.push('cache_l2', 'cache_l3');
  } else {
    suggestions.cacheStrategy = 'conservative';
    suggestions.recommendedNodes.push('cache_l2');
  }

  // Use case specific recommendations
  switch (useCase) {
    case 'rag':
      suggestions.namespace = 'rag/retrieval';
      suggestions.ttl = 86400;
      suggestions.recommendedNodes.push('vector_db', 'validation_freshness');
      suggestions.estimatedSavings.percentage = 85;
      break;

    case 'chatbot':
      suggestions.namespace = 'chat/sessions';
      suggestions.ttl = 3600; // 1 hour for conversational
      suggestions.recommendedNodes.push('validation_cognitive');
      suggestions.estimatedSavings.percentage = 60;
      break;

    case 'analytics':
      suggestions.namespace = 'analytics/queries';
      suggestions.ttl = 1800; // 30 min for analytics
      suggestions.recommendedNodes.push('output_analytics');
      suggestions.estimatedSavings.percentage = 70;
      break;

    case 'compliance':
      suggestions.namespace = 'enterprise/compliant';
      suggestions.ttl = 604800;
      suggestions.recommendedNodes.push('validation_pii', 'validation_cognitive');
      suggestions.estimatedSavings.percentage = 50;
      break;

    case 'reasoning':
      suggestions.namespace = 'reasoning/traces';
      suggestions.ttl = 2592000; // 30 days
      suggestions.recommendedNodes.push('cache_reasoning');
      suggestions.estimatedSavings.percentage = 95;
      break;
  }

  // Calculate estimated savings
  const baselineCost = monthlyQueries * avgCostPerQuery;
  suggestions.estimatedSavings.monthly = Math.round(baselineCost * (suggestions.estimatedSavings.percentage / 100));

  // Platform-specific additions
  if (platforms?.includes('databricks')) {
    suggestions.namespace = `databricks/${suggestions.namespace}`;
    suggestions.recommendedNodes.push('output_delta');
  }

  if (platforms?.includes('snowflake')) {
    suggestions.namespace = `snowflake/${suggestions.namespace}`;
  }

  return suggestions;
}

// Validate pipeline configuration
function validatePipeline(pipeline) {
  const errors = [];
  const warnings = [];

  if (!pipeline.nodes || pipeline.nodes.length === 0) {
    errors.push({ code: 'EMPTY_PIPELINE', message: 'Pipeline must have at least one node' });
    return { valid: false, errors, warnings };
  }

  // Check for unconnected nodes
  const connectedNodes = new Set();
  for (const conn of (pipeline.connections || [])) {
    connectedNodes.add(conn.source.nodeId);
    connectedNodes.add(conn.target.nodeId);
  }

  for (const node of pipeline.nodes) {
    if (!connectedNodes.has(node.id) && pipeline.nodes.length > 1) {
      warnings.push({
        code: 'UNCONNECTED_NODE',
        message: `Node "${node.label || node.type}" is not connected to other nodes`,
        nodeId: node.id
      });
    }
  }

  // Check for required configurations
  for (const node of pipeline.nodes) {
    const nodeType = NODE_LIBRARY.find(n => n.id === node.type);
    if (!nodeType) {
      errors.push({
        code: 'UNKNOWN_NODE',
        message: `Unknown node type: ${node.type}`,
        nodeId: node.id
      });
    }
  }

  // Check for cycles (simplified)
  // In production, would do full topological sort

  // Check cache layer ordering
  const cacheOrder = ['cache_l1', 'cache_l2', 'cache_l3'];
  const cacheNodes = pipeline.nodes
    .filter(n => n.type.startsWith('cache_'))
    .map(n => cacheOrder.indexOf(n.type))
    .filter(i => i !== -1);

  for (let i = 1; i < cacheNodes.length; i++) {
    if (cacheNodes[i] < cacheNodes[i - 1]) {
      warnings.push({
        code: 'CACHE_ORDER',
        message: 'Cache layers should be ordered L1 → L2 → L3 for optimal performance',
      });
      break;
    }
  }

  // Check for LLM without cache
  const hasLlm = pipeline.nodes.some(n => n.type.startsWith('llm_'));
  const hasCache = pipeline.nodes.some(n => n.type.startsWith('cache_'));

  if (hasLlm && !hasCache) {
    warnings.push({
      code: 'NO_CACHE',
      message: 'LLM node detected without cache layer - consider adding caching to reduce costs',
    });
  }

  // Check settings
  if (!pipeline.settings?.namespace) {
    warnings.push({
      code: 'NO_NAMESPACE',
      message: 'No namespace configured - using "default"',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5)),
  };
}

// Generate deployment code for different platforms
function generateCode(pipeline, target = 'python') {
  const code = {};

  if (target === 'python' || target === 'all') {
    code.python = generatePythonCode(pipeline);
  }

  if (target === 'javascript' || target === 'all') {
    code.javascript = generateJavaScriptCode(pipeline);
  }

  if (target === 'databricks' || target === 'all') {
    code.databricks = generateDatabricksCode(pipeline);
  }

  if (target === 'curl' || target === 'all') {
    code.curl = generateCurlCode(pipeline);
  }

  return code;
}

function generatePythonCode(pipeline) {
  const namespace = pipeline.settings?.namespace || 'default';
  const ttl = pipeline.settings?.defaultTtl || 86400;

  let imports = `from agentcache import AgentCache, CacheConfig\n`;
  let config = `\n# Pipeline: ${pipeline.name || 'Untitled'}\n`;
  config += `cache = AgentCache(\n`;
  config += `    api_key="${'{{AGENTCACHE_API_KEY}}'}",\n`;
  config += `    namespace="${namespace}",\n`;
  config += `    default_ttl=${ttl},\n`;
  config += `)\n\n`;

  // Generate node handlers
  let handlers = `# Cache wrapper for LLM calls\n`;
  handlers += `@cache.cached(ttl=${ttl})\n`;
  handlers += `async def cached_llm_call(prompt: str, model: str = "gpt-4o"):\n`;
  handlers += `    # Your LLM call here\n`;
  handlers += `    response = await openai.chat.completions.create(\n`;
  handlers += `        model=model,\n`;
  handlers += `        messages=[{"role": "user", "content": prompt}]\n`;
  handlers += `    )\n`;
  handlers += `    return response.choices[0].message.content\n`;

  handlers += `    return response.choices[0].message.content\n`;

  // Generate storage handlers
  if (pipeline.nodes.some(n => n.type === 'storage_s3')) {
    handlers += `\n# S3 Storage Handler\n`;
    handlers += `async def save_to_s3(data: str, key: str):\n`;
    handlers += `    # Requires boto3\n`;
    handlers += `    import boto3\n`;
    handlers += `    s3 = boto3.client('s3')\n`;
    handlers += `    s3.put_object(Bucket='agentcache-data', Key=key, Body=data)\n`;
  }

  return imports + config + handlers;
}

function generateJavaScriptCode(pipeline) {
  const namespace = pipeline.settings?.namespace || 'default';
  const ttl = pipeline.settings?.defaultTtl || 86400;

  return `import { AgentCache } from 'agentcache';

// Pipeline: ${pipeline.name || 'Untitled'}
const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  namespace: '${namespace}',
  defaultTtl: ${ttl},
});

// Cache wrapper for LLM calls
async function cachedLLMCall(prompt, model = 'gpt-4o') {
  return cache.cached(async () => {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  }, { ttl: ${ttl} });
}

export { cache, cachedLLMCall };
`;
}

function generateDatabricksCode(pipeline) {
  const namespace = pipeline.settings?.namespace || 'databricks/rag';
  const ttl = pipeline.settings?.defaultTtl || 86400;

  return `# Databricks Notebook - AgentCache Pipeline
# Pipeline: ${pipeline.name || 'Untitled'}

# COMMAND ----------

# Install AgentCache
%pip install agentcache

# COMMAND ----------

from agentcache import AgentCache
import mlflow

# Initialize cache
cache = AgentCache(
    api_key=dbutils.secrets.get("agentcache", "api_key"),
    namespace="${namespace}",
    default_ttl=${ttl},
)

# Log cache metrics to MLflow
mlflow.set_experiment("/AgentCache/metrics")

# COMMAND ----------

# Cached RAG function
@cache.cached(ttl=${ttl})
def rag_query(query: str, context: list) -> str:
    """
    Execute RAG query with caching.
    Cache hit = ~5ms, Cache miss = ~2000ms
    """
    prompt = f"""Context: {context}
    
Question: {query}

Answer based on the context provided:"""
    
    # Your LLM call here
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# COMMAND ----------

# Log results to Delta table
def log_to_delta(query, response, cached, latency_ms):
    """Log cache analytics to Delta Lake."""
    spark.createDataFrame([{
        "timestamp": datetime.now(),
        "query": query,
        "cached": cached,
        "latency_ms": latency_ms,
        "namespace": "${namespace}",
    }]).write.mode("append").saveAsTable("${namespace.replace('/', '_')}_logs")
`;
}

function generateCurlCode(pipeline) {
  const namespace = pipeline.settings?.namespace || 'default';
  const ttl = pipeline.settings?.defaultTtl || 86400;

  return `# AgentCache REST API - Pipeline: ${pipeline.name || 'Untitled'}

# Check cache before LLM call
curl -X POST https://api.agentcache.ai/v1/cache/get \\
  -H "Authorization: Bearer $AGENTCACHE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "your-prompt-hash",
    "namespace": "${namespace}"
  }'

# Store response in cache
curl -X POST https://api.agentcache.ai/v1/cache/set \\
  -H "Authorization: Bearer $AGENTCACHE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "your-prompt-hash",
    "value": "LLM response here",
    "namespace": "${namespace}",
    "ttl": ${ttl}
  }'

# Get cache analytics
curl -X GET "https://api.agentcache.ai/v1/analytics?namespace=${namespace}" \\
  -H "Authorization: Bearer $AGENTCACHE_API_KEY"
`;
}

// Main handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';

  try {
    // GET /api/pipeline/nodes - Node library
    if (req.method === 'GET' && path.endsWith('/nodes')) {
      return res.status(200).json({
        success: true,
        nodes: NODE_LIBRARY,
        categories: ['source', 'cache', 'validation', 'llm', 'output'],
      });
    }

    // GET /api/pipeline/templates - Pipeline templates
    if (req.method === 'GET' && path.endsWith('/templates')) {
      return res.status(200).json({
        success: true,
        templates: PIPELINE_TEMPLATES,
      });
    }

    // POST /api/pipeline/detect - Platform detection
    if (req.method === 'POST' && path.endsWith('/detect')) {
      const config = req.body || {};
      const detected = detectPlatform(config);

      return res.status(200).json({
        success: true,
        ...detected,
      });
    }

    // POST /api/pipeline/suggest - Configuration suggestions
    if (req.method === 'POST' && path.endsWith('/suggest')) {
      const { useCase, platforms, volume } = req.body || {};
      const suggestions = suggestConfig(useCase, platforms, volume);

      return res.status(200).json({
        success: true,
        suggestions,
      });
    }

    // POST /api/pipeline/validate - Validate pipeline
    if (req.method === 'POST' && path.endsWith('/validate')) {
      const pipeline = req.body?.pipeline;

      if (!pipeline) {
        return res.status(400).json({
          success: false,
          error: 'Pipeline configuration required',
        });
      }

      const validation = validatePipeline(pipeline);

      return res.status(200).json({
        success: true,
        validation,
      });
    }

    // POST /api/pipeline/generate - Generate deployment code
    if (req.method === 'POST' && path.endsWith('/generate')) {
      const { pipeline, target = 'all' } = req.body || {};

      if (!pipeline) {
        return res.status(400).json({
          success: false,
          error: 'Pipeline configuration required',
        });
      }

      const code = generateCode(pipeline, target);

      return res.status(200).json({
        success: true,
        code,
        target,
      });
    }

    // Default: list endpoints
    return res.status(200).json({
      success: true,
      api: 'Pipeline Composer',
      version: '1.0.0',
      endpoints: [
        { method: 'GET', path: '/api/pipeline/nodes', description: 'Get available node library' },
        { method: 'GET', path: '/api/pipeline/templates', description: 'Get pipeline templates' },
        { method: 'POST', path: '/api/pipeline/detect', description: 'Detect platform/environment' },
        { method: 'POST', path: '/api/pipeline/suggest', description: 'Get config suggestions' },
        { method: 'POST', path: '/api/pipeline/validate', description: 'Validate pipeline' },
        { method: 'POST', path: '/api/pipeline/generate', description: 'Generate deployment code' },
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
