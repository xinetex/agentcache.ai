/**
 * @agentcache/overflow-client
 * 
 * Partner SDK for integrating AgentCache as overflow/fallback layer
 * Use this to add AgentCache behind your existing cache (Redis, Memcached, etc)
 */

class AgentCacheOverflow {
  constructor(config) {
    if (!config.partnerId) {
      throw new Error('partnerId is required');
    }
    if (!config.apiKey) {
      throw new Error('apiKey is required');
    }
    
    this.partnerId = config.partnerId;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://agentcache.ai';
    this.revenueShare = config.revenueShare || 0.30;
    this.timeout = config.timeout || 5000; // 5s timeout
    
    // Metrics
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalLatency: 0
    };
  }
  
  /**
   * Check AgentCache for cached response
   * 
   * @param {Object} options
   * @param {string} options.customerId - Your customer's ID
   * @param {Object} options.request - Original LLM request
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Cache response
   */
  async get(options) {
    const { customerId, request, metadata } = options;
    
    if (!customerId) {
      throw new Error('customerId is required');
    }
    if (!request) {
      throw new Error('request object is required');
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/overflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-ID': this.partnerId,
          'X-Partner-Key': this.apiKey
        },
        body: JSON.stringify({
          customer_id: customerId,
          original_request: request,
          metadata: metadata || {},
          action: 'get'
        }),
        signal: AbortSignal.timeout(this.timeout)
      });
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      if (response.ok && data.hit) {
        // Cache HIT
        this.stats.hits++;
        this.stats.totalLatency += latency;
        
        return {
          hit: true,
          response: data.response,
          latency: latency,
          source: 'agentcache',
          billing: data.billing
        };
      } else {
        // Cache MISS
        this.stats.misses++;
        
        return {
          hit: false,
          latency: latency,
          cacheKey: data.cache_key
        };
      }
    } catch (err) {
      this.stats.errors++;
      console.error('AgentCache overflow error:', err);
      
      // Fail open - return miss so primary system can handle
      return {
        hit: false,
        error: err.message
      };
    }
  }
  
  /**
   * Store response in AgentCache for future use
   * 
   * @param {Object} options
   * @param {string} options.customerId - Your customer's ID
   * @param {Object} options.request - Original LLM request
   * @param {Object} options.response - LLM response to cache
   * @returns {Promise<Object>} Set response
   */
  async set(options) {
    const { customerId, request, response } = options;
    
    if (!customerId || !request || !response) {
      throw new Error('customerId, request, and response are required');
    }
    
    try {
      const result = await fetch(`${this.baseUrl}/api/overflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-ID': this.partnerId,
          'X-Partner-Key': this.apiKey
        },
        body: JSON.stringify({
          customer_id: customerId,
          original_request: request,
          response: response,
          action: 'set'
        }),
        signal: AbortSignal.timeout(this.timeout)
      });
      
      const data = await result.json();
      
      return {
        success: result.ok,
        cacheKey: data.cache_key,
        latency: data.latency
      };
    } catch (err) {
      console.error('AgentCache set error:', err);
      // Fail silently for set operations
      return {
        success: false,
        error: err.message
      };
    }
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;
    const avgLatency = this.stats.hits > 0 
      ? (this.stats.totalLatency / this.stats.hits).toFixed(0) 
      : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      errors: this.stats.errors,
      hit_rate: parseFloat(hitRate),
      avg_latency_ms: parseInt(avgLatency),
      revenue_share: this.revenueShare
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalLatency: 0
    };
  }
}

// Export for CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentCacheOverflow;
}

export default AgentCacheOverflow;
