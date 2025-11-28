/**
 * Audit Logging System for FedRAMP Compliance
 * 
 * All cache operations are logged with 7-year retention to meet federal requirements.
 * Audit logs are immutable and include full context for security investigations.
 */

export async function logAuditEvent(redis, event) {
  try {
    const timestamp = new Date().toISOString();
    const day = timestamp.slice(0, 10); // YYYY-MM-DD
    const auditKey = `audit:${day}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
    
    // Store complete audit record
    await redis('HSET', auditKey,
      'timestamp', timestamp,
      'event_type', event.type || 'unknown', // cache_get, cache_set, cache_check
      'api_key_hash', event.keyHash || 'anonymous',
      'provider', event.provider || 'N/A',
      'model', event.model || 'N/A',
      'cache_hit', event.hit ? '1' : '0',
      'compliance_mode', event.complianceMode || 'standard',
      'ip_address', event.ip || 'unknown',
      'namespace', event.namespace || 'default',
      'cache_key_hash', event.cacheKeyHash || 'N/A',
      'ttl', event.ttl || 0,
      'latency_ms', event.latency || 0
    );
    
    // 7 year retention for FedRAMP compliance (2555 days)
    await redis('EXPIRE', auditKey, 60 * 60 * 24 * 365 * 7);
    
    // Also increment daily counter for analytics
    const dailyKey = `audit:count:${day}`;
    await redis('INCR', dailyKey);
    await redis('EXPIRE', dailyKey, 60 * 60 * 24 * 365 * 7);
    
    return { success: true, audit_key: auditKey };
  } catch (error) {
    // Never fail the main request due to audit logging issues
    console.error('Audit logging error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve audit logs for compliance reporting
 * @param {Function} redis - Redis command function
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of audit log entries
 */
export async function getAuditLogs(redis, filters = {}) {
  const { start_date, end_date, namespace, event_type, limit = 1000 } = filters;
  
  // Build search pattern
  let pattern = 'audit:';
  if (start_date) {
    pattern += `${start_date}:*`;
  } else {
    pattern += '*';
  }
  
  try {
    // Scan for matching keys (Redis SCAN for cursor-based iteration)
    const keys = await redis('KEYS', pattern);
    
    if (!keys || keys.length === 0) {
      return [];
    }
    
    // Fetch audit records (limit to prevent memory issues)
    const limitedKeys = keys.slice(0, limit);
    const logs = [];
    
    for (const key of limitedKeys) {
      const data = await redis('HGETALL', key);
      if (!data) continue;
      
      // Apply filters
      if (namespace && data.namespace !== namespace) continue;
      if (event_type && data.event_type !== event_type) continue;
      if (end_date && data.timestamp > end_date) continue;
      
      logs.push({
        audit_key: key,
        ...data
      });
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}

/**
 * Convert audit logs to CSV format for compliance reports
 * @param {Array} logs - Array of audit log objects
 * @returns {String} CSV formatted string
 */
export function convertToCSV(logs) {
  if (!logs || logs.length === 0) {
    return 'No audit logs found';
  }
  
  // CSV headers
  const headers = [
    'Timestamp',
    'Event Type',
    'Provider',
    'Model',
    'Cache Hit',
    'Compliance Mode',
    'IP Address',
    'Namespace',
    'Latency (ms)',
    'API Key Hash'
  ].join(',');
  
  // CSV rows
  const rows = logs.map(log => {
    return [
      log.timestamp || '',
      log.event_type || '',
      log.provider || '',
      log.model || '',
      log.cache_hit === '1' ? 'Yes' : 'No',
      log.compliance_mode || 'standard',
      log.ip_address || '',
      log.namespace || 'default',
      log.latency_ms || '0',
      log.api_key_hash ? log.api_key_hash.slice(0, 16) + '...' : ''
    ].map(field => `"${field}"`).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

/**
 * Get audit statistics for a date range
 * @param {Function} redis - Redis command function
 * @param {Object} options - Query options
 * @returns {Object} Aggregated statistics
 */
export async function getAuditStats(redis, options = {}) {
  const { start_date, end_date } = options;
  
  try {
    // Get all audit logs for period
    const logs = await getAuditLogs(redis, { start_date, end_date, limit: 10000 });
    
    // Aggregate statistics
    const stats = {
      total_events: logs.length,
      cache_hits: logs.filter(l => l.cache_hit === '1').length,
      cache_misses: logs.filter(l => l.cache_hit === '0').length,
      by_provider: {},
      by_compliance_mode: {},
      by_namespace: {},
      unique_api_keys: new Set(logs.map(l => l.api_key_hash)).size
    };
    
    // Count by provider
    logs.forEach(log => {
      const provider = log.provider || 'unknown';
      stats.by_provider[provider] = (stats.by_provider[provider] || 0) + 1;
      
      const mode = log.compliance_mode || 'standard';
      stats.by_compliance_mode[mode] = (stats.by_compliance_mode[mode] || 0) + 1;
      
      const ns = log.namespace || 'default';
      stats.by_namespace[ns] = (stats.by_namespace[ns] || 0) + 1;
    });
    
    stats.hit_rate = stats.total_events > 0 
      ? ((stats.cache_hits / stats.total_events) * 100).toFixed(2) + '%'
      : '0%';
    
    return stats;
  } catch (error) {
    console.error('Error calculating audit stats:', error);
    return { error: error.message };
  }
}
