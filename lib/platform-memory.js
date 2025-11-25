/**
 * Platform Cognitive Memory
 * AgentCache.ai uses its own cognitive memory infrastructure
 * The platform becomes smarter as more users interact with it
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Memory namespaces for different platform functions
export const NAMESPACES = {
  WIZARD: 'platform/studio/wizard',           // Pipeline generation patterns
  COMPLEXITY: 'platform/billing/complexity',  // Complexity calculation patterns
  OPTIMIZATION: 'platform/suggestions',       // Cost optimization advice
  COMPLIANCE: 'platform/compliance',          // Sector compliance patterns
  SUPPORT: 'platform/operations/support',     // User support patterns
  ONBOARDING: 'platform/onboarding'          // User onboarding flows
};

/**
 * Platform Memory Client
 * Manages cognitive memory for internal platform operations
 */
class PlatformMemory {
  constructor() {
    this.namespace = 'platform';
    // L1: In-memory cache for current session
    this.l1Cache = new Map();
    this.l1MaxAge = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if we've seen this pattern before
   * Uses L1 (memory) → L2 (Redis) → L3 (vector) hierarchy
   */
  async get(namespace, key, options = {}) {
    const cacheKey = `${namespace}:${key}`;
    
    // L1: Check in-memory cache
    if (this.l1Cache.has(cacheKey)) {
      const cached = this.l1Cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.l1MaxAge) {
        return {
          hit: true,
          tier: 'L1',
          data: cached.data,
          latency_ms: 0
        };
      }
      // Expired, remove
      this.l1Cache.delete(cacheKey);
    }
    
    // L2: Check PostgreSQL (simulating Redis for now)
    const startTime = Date.now();
    try {
      const results = await sql`
        SELECT data, confidence, created_at, hit_count
        FROM platform_memory_cache
        WHERE namespace = ${namespace}
          AND cache_key = ${key}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      if (results.length > 0) {
        const cached = results[0];
        
        // Update hit count and L1 cache
        await sql`
          UPDATE platform_memory_cache
          SET hit_count = hit_count + 1,
              last_hit_at = NOW()
          WHERE namespace = ${namespace} AND cache_key = ${key}
        `;
        
        // Warm L1
        this.l1Cache.set(cacheKey, {
          data: cached.data,
          timestamp: Date.now()
        });
        
        return {
          hit: true,
          tier: 'L2',
          data: cached.data,
          confidence: parseFloat(cached.confidence),
          hit_count: parseInt(cached.hit_count) + 1,
          latency_ms: Date.now() - startTime
        };
      }
      
      // L3: Vector search for semantic similarity (if enabled)
      if (options.semantic_search) {
        // TODO: Implement vector similarity search
        // For now, return cache miss
      }
      
      return {
        hit: false,
        tier: null,
        latency_ms: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Platform memory get error:', error);
      return { hit: false, error: error.message };
    }
  }

  /**
   * Store pattern in platform memory
   */
  async set(namespace, key, data, options = {}) {
    const {
      confidence = 1.0,
      ttl_hours = 24 * 7, // 7 days default
      reasoning = null,
      metadata = {}
    } = options;
    
    const cacheKey = `${namespace}:${key}`;
    
    try {
      // Store in L2 (PostgreSQL)
      await sql`
        INSERT INTO platform_memory_cache (
          namespace,
          cache_key,
          data,
          confidence,
          reasoning,
          metadata,
          expires_at
        )
        VALUES (
          ${namespace},
          ${key},
          ${JSON.stringify(data)},
          ${confidence},
          ${reasoning},
          ${JSON.stringify(metadata)},
          NOW() + INTERVAL '${ttl_hours} hours'
        )
        ON CONFLICT (namespace, cache_key)
        DO UPDATE SET
          data = EXCLUDED.data,
          confidence = EXCLUDED.confidence,
          reasoning = EXCLUDED.reasoning,
          metadata = EXCLUDED.metadata,
          updated_at = NOW(),
          expires_at = EXCLUDED.expires_at
      `;
      
      // Warm L1
      this.l1Cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      // Log to audit trail
      await sql`
        INSERT INTO platform_memory_audit (
          namespace,
          cache_key,
          action,
          confidence,
          metadata
        )
        VALUES (
          ${namespace},
          ${key},
          'set',
          ${confidence},
          ${JSON.stringify({ ttl_hours, ...metadata })}
        )
      `;
      
      return { success: true };
      
    } catch (error) {
      console.error('Platform memory set error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze patterns across multiple cache entries
   */
  async analyzePatterns(namespace, options = {}) {
    const { limit = 100, min_confidence = 0.7 } = options;
    
    try {
      const patterns = await sql`
        SELECT 
          cache_key,
          data,
          confidence,
          hit_count,
          created_at,
          last_hit_at
        FROM platform_memory_cache
        WHERE namespace = ${namespace}
          AND confidence >= ${min_confidence}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY hit_count DESC, confidence DESC
        LIMIT ${limit}
      `;
      
      // Analyze common patterns
      const analysis = {
        total_patterns: patterns.length,
        high_confidence: patterns.filter(p => parseFloat(p.confidence) >= 0.9).length,
        most_used: patterns.slice(0, 10).map(p => ({
          key: p.cache_key,
          hits: parseInt(p.hit_count),
          confidence: parseFloat(p.confidence)
        })),
        patterns: patterns
      };
      
      return analysis;
      
    } catch (error) {
      console.error('Pattern analysis error:', error);
      return { error: error.message };
    }
  }

  /**
   * Learn from user interaction
   * Stores successful patterns for future use
   */
  async learn(namespace, pattern, outcome, options = {}) {
    const { confidence = 0.8, context = {} } = options;
    
    // Generate key from pattern
    const key = this.generatePatternKey(pattern);
    
    // Store if outcome was successful
    if (outcome.success) {
      await this.set(namespace, key, {
        pattern,
        outcome,
        learned_at: new Date().toISOString(),
        context
      }, {
        confidence,
        reasoning: outcome.reasoning,
        metadata: { learning: true, ...context }
      });
    }
    
    return { learned: outcome.success, key };
  }

  /**
   * Generate cache key from pattern
   */
  generatePatternKey(pattern) {
    if (typeof pattern === 'string') {
      return pattern;
    }
    
    // Hash object pattern
    const str = JSON.stringify(pattern, Object.keys(pattern).sort());
    return Buffer.from(str).toString('base64').substring(0, 64);
  }

  /**
   * Prune old, low-confidence memories
   */
  async prune(namespace, options = {}) {
    const { max_age_days = 90, min_hit_count = 5 } = options;
    
    try {
      const result = await sql`
        DELETE FROM platform_memory_cache
        WHERE namespace = ${namespace}
          AND (
            (created_at < NOW() - INTERVAL '${max_age_days} days' AND hit_count < ${min_hit_count})
            OR expires_at < NOW()
          )
      `;
      
      return { pruned: result.count };
      
    } catch (error) {
      console.error('Prune error:', error);
      return { error: error.message };
    }
  }
}

// Singleton instance
export const platformMemory = new PlatformMemory();

/**
 * High-level helpers for specific platform operations
 */

/**
 * Wizard Intelligence: Learn pipeline generation patterns
 */
export async function wizardMemory(operation, data) {
  const namespace = NAMESPACES.WIZARD;
  
  switch (operation) {
    case 'suggest_nodes': {
      // Check if we've seen this sector + use case before
      const key = `nodes:${data.sector}:${data.use_case}`;
      const cached = await platformMemory.get(namespace, key);
      
      if (cached.hit) {
        return {
          suggestions: cached.data.nodes,
          confidence: cached.confidence,
          reason: `Based on ${cached.hit_count} similar pipelines`
        };
      }
      return null;
    }
    
    case 'learn_pipeline': {
      // Store successful pipeline pattern
      const key = `nodes:${data.sector}:${data.use_case}`;
      await platformMemory.learn(namespace, key, {
        success: true,
        nodes: data.nodes,
        reasoning: `User successfully created ${data.sector} pipeline`
      }, {
        confidence: 0.85,
        context: { sector: data.sector, complexity: data.complexity }
      });
      return { learned: true };
    }
    
    default:
      return null;
  }
}

/**
 * Complexity Intelligence: Learn complexity patterns
 */
export async function complexityMemory(operation, data) {
  const namespace = NAMESPACES.COMPLEXITY;
  
  switch (operation) {
    case 'predict': {
      // Predict complexity based on node types
      const nodeTypes = data.nodes.map(n => n.type).sort().join(',');
      const key = `complexity:${nodeTypes}:${data.sector}`;
      
      const cached = await platformMemory.get(namespace, key);
      if (cached.hit) {
        return {
          predicted_tier: cached.data.tier,
          predicted_score: cached.data.score,
          confidence: cached.confidence,
          based_on: cached.hit_count
        };
      }
      return null;
    }
    
    case 'learn_result': {
      // Store actual complexity result
      const nodeTypes = data.nodes.map(n => n.type).sort().join(',');
      const key = `complexity:${nodeTypes}:${data.sector}`;
      
      await platformMemory.set(namespace, key, {
        tier: data.tier,
        score: data.score,
        cost: data.cost
      }, {
        confidence: 0.95,
        reasoning: `Calculated complexity for ${data.nodes.length} nodes`,
        metadata: { sector: data.sector }
      });
      return { learned: true };
    }
    
    default:
      return null;
  }
}

/**
 * Optimization Intelligence: Learn optimization patterns
 */
export async function optimizationMemory(operation, data) {
  const namespace = NAMESPACES.OPTIMIZATION;
  
  switch (operation) {
    case 'suggest': {
      // Suggest optimizations based on complexity tier
      const key = `optimize:${data.complexity_tier}:${data.sector}`;
      
      const cached = await platformMemory.get(namespace, key);
      if (cached.hit && cached.data.suggestions) {
        return {
          suggestions: cached.data.suggestions,
          confidence: cached.confidence,
          proven_savings: cached.data.avg_savings
        };
      }
      return null;
    }
    
    case 'learn_optimization': {
      // Learn from successful optimization
      const key = `optimize:${data.from_tier}:${data.sector}`;
      
      const existing = await platformMemory.get(namespace, key);
      const suggestions = existing.hit ? existing.data.suggestions : [];
      
      // Add new successful optimization
      suggestions.push({
        change: data.change,
        savings: data.savings,
        success_rate: 1
      });
      
      await platformMemory.set(namespace, key, {
        suggestions,
        avg_savings: suggestions.reduce((sum, s) => sum + s.savings, 0) / suggestions.length
      }, {
        confidence: 0.9,
        reasoning: 'Learned from successful optimization'
      });
      
      return { learned: true };
    }
    
    default:
      return null;
  }
}

/**
 * Compliance Intelligence: Learn sector compliance patterns
 */
export async function complianceMemory(operation, data) {
  const namespace = NAMESPACES.COMPLIANCE;
  
  switch (operation) {
    case 'validate': {
      // Check common compliance issues for sector
      const key = `compliance:${data.sector}`;
      
      const cached = await platformMemory.get(namespace, key);
      if (cached.hit) {
        const requiredNodes = cached.data.required_nodes || [];
        const missing = requiredNodes.filter(
          required => !data.nodes.some(n => n.type === required)
        );
        
        if (missing.length > 0) {
          return {
            warnings: missing.map(node => ({
              type: 'missing_compliance_node',
              node: node,
              message: `${cached.data.compliance_names[node]} typically required`,
              confidence: cached.confidence,
              based_on: cached.hit_count
            }))
          };
        }
      }
      return { warnings: [] };
    }
    
    case 'learn_requirements': {
      // Learn compliance requirements from successful deployments
      const key = `compliance:${data.sector}`;
      
      const existing = await platformMemory.get(namespace, key);
      const stats = existing.hit ? existing.data : {
        required_nodes: {},
        compliance_names: {},
        total_pipelines: 0
      };
      
      // Count node usage
      data.nodes.forEach(node => {
        if (node.type.includes('audit') || node.type.includes('filter')) {
          stats.required_nodes[node.type] = (stats.required_nodes[node.type] || 0) + 1;
          stats.compliance_names[node.type] = node.name;
        }
      });
      
      stats.total_pipelines += 1;
      
      // Nodes used in >80% of pipelines are "required"
      const threshold = stats.total_pipelines * 0.8;
      const required = Object.entries(stats.required_nodes)
        .filter(([_, count]) => count >= threshold)
        .map(([node]) => node);
      
      await platformMemory.set(namespace, key, {
        ...stats,
        required_nodes: required
      }, {
        confidence: Math.min(0.95, stats.total_pipelines / 100),
        reasoning: `Based on ${stats.total_pipelines} ${data.sector} pipelines`
      });
      
      return { learned: true };
    }
    
    default:
      return null;
  }
}

export default platformMemory;
