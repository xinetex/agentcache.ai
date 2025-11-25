/**
 * Pipeline Validation Layer
 * Validates pipeline structure, node integrity, and security constraints
 */

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validates a pipeline object before save/load
 * @param {Object} pipeline - Pipeline object to validate
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If validation fails
 */
export function validatePipeline(pipeline) {
  // Structure validation
  if (!pipeline || typeof pipeline !== 'object') {
    throw new ValidationError('Pipeline must be an object');
  }

  if (!pipeline.name || typeof pipeline.name !== 'string') {
    throw new ValidationError('Pipeline must have a valid name', 'name');
  }

  if (pipeline.name.length > 255) {
    throw new ValidationError('Pipeline name must be less than 255 characters', 'name');
  }

  if (!Array.isArray(pipeline.nodes)) {
    throw new ValidationError('Pipeline must have a nodes array', 'nodes');
  }

  if (pipeline.nodes.length === 0) {
    throw new ValidationError('Pipeline must have at least one node', 'nodes');
  }

  if (!Array.isArray(pipeline.edges)) {
    throw new ValidationError('Pipeline must have an edges array', 'edges');
  }

  // Validate node IDs are unique
  const nodeIds = new Set();
  for (const node of pipeline.nodes) {
    if (!node.id) {
      throw new ValidationError('All nodes must have an ID', 'nodes');
    }
    if (nodeIds.has(node.id)) {
      throw new ValidationError(`Duplicate node ID found: ${node.id}`, 'nodes');
    }
    nodeIds.add(node.id);
  }

  // Validate edges reference existing nodes
  for (const edge of pipeline.edges) {
    if (!edge.source || !edge.target) {
      throw new ValidationError('All edges must have source and target', 'edges');
    }
    if (!nodeIds.has(edge.source)) {
      throw new ValidationError(`Edge references non-existent source node: ${edge.source}`, 'edges');
    }
    if (!nodeIds.has(edge.target)) {
      throw new ValidationError(`Edge references non-existent target node: ${edge.target}`, 'edges');
    }
  }

  // Detect circular dependencies
  if (hasCircularDependency(pipeline.nodes, pipeline.edges)) {
    throw new ValidationError('Pipeline contains circular dependencies', 'edges');
  }

  // Validate sector
  const validSectors = ['healthcare', 'finance', 'legal', 'ecommerce', 'saas', 'general'];
  if (pipeline.sector && !validSectors.includes(pipeline.sector)) {
    throw new ValidationError(`Invalid sector: ${pipeline.sector}`, 'sector');
  }

  return true;
}

/**
 * Detects circular dependencies using DFS
 * @param {Array} nodes - Pipeline nodes
 * @param {Array} edges - Pipeline edges
 * @returns {boolean} - True if circular dependency exists
 */
function hasCircularDependency(nodes, edges) {
  // Build adjacency list
  const graph = {};
  nodes.forEach(node => {
    graph[node.id] = [];
  });
  edges.forEach(edge => {
    graph[edge.source].push(edge.target);
  });

  const visited = new Set();
  const recursionStack = new Set();

  function dfs(nodeId) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of graph[nodeId] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true; // Circular dependency found
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of Object.keys(graph)) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }

  return false;
}

/**
 * Validates node configuration
 * @param {Object} node - Node object
 * @returns {boolean}
 */
export function validateNode(node) {
  if (!node.type || typeof node.type !== 'string') {
    throw new ValidationError('Node must have a valid type', 'type');
  }

  // Validate URLs if present
  if (node.data?.api_url) {
    try {
      const url = new URL(node.data.api_url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new ValidationError('Invalid URL protocol - must be http or https', 'api_url');
      }
    } catch (e) {
      throw new ValidationError('Invalid URL format', 'api_url');
    }
  }

  return true;
}

/**
 * Validates storage provider configuration
 * @param {Object} storageConfig - Storage configuration object
 * @returns {boolean}
 */
export function validateStorageConfig(storageConfig) {
  if (!storageConfig || typeof storageConfig !== 'object') {
    throw new ValidationError('Storage config must be an object');
  }

  const validProviders = ['s3', 'azure', 'gcp', 'jettythunder', 'lyve'];
  
  if (!storageConfig.provider || !validProviders.includes(storageConfig.provider)) {
    throw new ValidationError(`Invalid storage provider. Must be one of: ${validProviders.join(', ')}`, 'provider');
  }

  // Validate provider-specific configs
  if (storageConfig.provider === 'jettythunder') {
    if (!storageConfig.apiKey) {
      throw new ValidationError('JettyThunder provider requires apiKey', 'apiKey');
    }
    if (storageConfig.jettySpeedEnabled && typeof storageConfig.jettySpeedEnabled !== 'boolean') {
      throw new ValidationError('jettySpeedEnabled must be a boolean', 'jettySpeedEnabled');
    }
  }

  return true;
}

/**
 * Sanitizes pipeline name for safe storage
 * @param {string} name - Pipeline name
 * @returns {string} - Sanitized name
 */
export function sanitizePipelineName(name) {
  if (typeof name !== 'string') return '';
  
  // Remove any HTML tags
  const stripped = name.replace(/<[^>]*>/g, '');
  
  // Remove control characters and limit length
  return stripped
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, 255)
    .trim();
}
