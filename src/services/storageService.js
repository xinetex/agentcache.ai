/**
 * Storage Service Layer
 * Handles all localStorage operations with error handling, quota management, and versioning
 */

import { validatePipeline, sanitizePipelineName } from '../utils/pipelineValidator.js';

export class QuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaError';
  }
}

export class StorageError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

const SCHEMA_VERSION = 2;
const STORAGE_KEY_PREFIX = 'agentcache_';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB localStorage limit

/**
 * Storage Service
 * Provides safe localStorage operations with validation and error handling
 */
export class StorageService {
  /**
   * Save data to localStorage with validation and error handling
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {Object} - Result object with success status
   */
  static save(key, data) {
    try {
      const fullKey = STORAGE_KEY_PREFIX + key;
      const serialized = JSON.stringify(data);

      // Check size before saving
      if (serialized.length > MAX_STORAGE_SIZE) {
        return {
          success: false,
          error: 'quota',
          message: 'Data exceeds 5MB storage limit. Consider deleting old pipelines.',
          size: serialized.length
        };
      }

      localStorage.setItem(fullKey, serialized);

      return {
        success: true,
        size: serialized.length
      };
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        return {
          success: false,
          error: 'quota',
          message: 'Storage quota exceeded. Clear old data to continue.',
          cause: err
        };
      }

      return {
        success: false,
        error: 'storage',
        message: `Failed to save data: ${err.message}`,
        cause: err
      };
    }
  }

  /**
   * Load data from localStorage with error handling
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} - Loaded data or default value
   */
  static load(key, defaultValue = null) {
    try {
      const fullKey = STORAGE_KEY_PREFIX + key;
      const item = localStorage.getItem(fullKey);

      if (item === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      return parsed;
    } catch (err) {
      console.error(`Failed to load ${key}:`, err);
      return defaultValue;
    }
  }

  /**
   * Remove data from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} - Success status
   */
  static remove(key) {
    try {
      const fullKey = STORAGE_KEY_PREFIX + key;
      localStorage.removeItem(fullKey);
      return true;
    } catch (err) {
      console.error(`Failed to remove ${key}:`, err);
      return false;
    }
  }

  /**
   * Get current storage usage
   * @returns {Object} - Usage statistics
   */
  static getStorageStats() {
    try {
      let totalSize = 0;
      let itemCount = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          const value = localStorage.getItem(key);
          totalSize += value ? value.length : 0;
          itemCount++;
        }
      }

      return {
        totalSize,
        itemCount,
        percentUsed: (totalSize / MAX_STORAGE_SIZE) * 100,
        maxSize: MAX_STORAGE_SIZE,
        available: MAX_STORAGE_SIZE - totalSize
      };
    } catch (err) {
      console.error('Failed to get storage stats:', err);
      return {
        totalSize: 0,
        itemCount: 0,
        percentUsed: 0,
        maxSize: MAX_STORAGE_SIZE,
        available: MAX_STORAGE_SIZE
      };
    }
  }

  /**
   * Clear all AgentCache storage
   * @returns {boolean} - Success status
   */
  static clearAll() {
    try {
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (err) {
      console.error('Failed to clear storage:', err);
      return false;
    }
  }
}

/**
 * Pipeline Storage Service
 * Specialized service for pipeline operations with validation and versioning
 */
export class PipelineStorageService {
  /**
   * Save a pipeline with validation and versioning
   * @param {Object} pipeline - Pipeline object to save
   * @returns {Object} - Result with success status
   */
  /**
   * Save a pipeline to the cloud and local storage
   * @param {Object} pipeline - Pipeline object
   * @param {string} token - Auth token (optional)
   * @returns {Object} - Result
   */
  static async savePipeline(pipeline, token = null) {
    try {
      // 1. Save locally first (optimistic UI)
      const localResult = this.savePipelineLocal(pipeline);

      if (!localResult.success) return localResult;

      // 2. If token provided, save to cloud
      if (token) {
        try {
          const response = await fetch('/api/pipelines', {
            method: 'POST', // or PUT if existing, but for now simplify
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(pipeline)
          });

          if (!response.ok) {
            console.warn('Failed to save to cloud:', await response.text());
            // We don't fail the operation because local save succeeded
          }
        } catch (err) {
          console.error('Cloud save error:', err);
        }
      }

      return localResult;
    } catch (err) {
      return {
        success: false,
        error: 'storage',
        message: err.message
      };
    }
  }

  /**
   * Internal local save method (original logic)
   */
  static savePipelineLocal(pipeline) {
    try {
      // Sanitize pipeline name
      pipeline.name = sanitizePipelineName(pipeline.name);

      // Validate pipeline structure
      validatePipeline(pipeline);

      // Add metadata
      const versionedPipeline = {
        ...pipeline,
        _v: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Load existing pipelines
      const existingPipelines = this.loadAllPipelines();

      // Check if pipeline already exists (by name)
      const existingIndex = existingPipelines.findIndex(p => p.name === pipeline.name);

      if (existingIndex !== -1) {
        // Update existing pipeline
        existingPipelines[existingIndex] = {
          ...versionedPipeline,
          savedAt: existingPipelines[existingIndex].savedAt // Preserve original save time
        };
      } else {
        // Add new pipeline
        existingPipelines.push(versionedPipeline);
      }

      // Save to storage
      const result = StorageService.save('pipelines', existingPipelines);

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        pipeline: versionedPipeline,
        isNew: existingIndex === -1
      };
    } catch (err) {
      return {
        success: false,
        error: 'validation',
        message: err.message,
        field: err.field || null
      };
    }
  }

  /**
   * Sync local pipelines to cloud
   * @param {string} token - Auth token
   */
  static async syncToCloud(token) {
    if (!token) return;

    const localPipelines = this.loadAllPipelines();

    // Simple sync: push all local pipelines to cloud
    // Real implementation would be smarter (diffing)
    for (const pipeline of localPipelines) {
      try {
        await fetch('/api/pipelines', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(pipeline)
        });
      } catch (err) {
        console.error(`Failed to sync pipeline ${pipeline.name}:`, err);
      }
    }
  }

  /**
   * Load pipelines from cloud
   * @param {string} token 
   */
  static async loadFromCloud(token) {
    if (!token) return [];

    try {
      const response = await fetch('/api/pipelines', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data.pipelines || [];
      }
    } catch (err) {
      console.error('Failed to load from cloud:', err);
    }
    return [];
  }

  /**
   * Load all pipelines with migration support
   * @returns {Array} - Array of pipelines
   */
  static loadAllPipelines() {
    const pipelines = StorageService.load('pipelines', []);

    // Migrate old schema if needed
    return pipelines.map(pipeline => this.migratePipeline(pipeline));
  }

  /**
   * Load a single pipeline by name
   * @param {string} name - Pipeline name
   * @returns {Object|null} - Pipeline object or null
   */
  static loadPipeline(name) {
    const pipelines = this.loadAllPipelines();
    return pipelines.find(p => p.name === name) || null;
  }

  /**
   * Delete a pipeline by name
   * @param {string} name - Pipeline name
   * @returns {Object} - Result with success status
   */
  static deletePipeline(name) {
    try {
      const pipelines = this.loadAllPipelines();
      const filtered = pipelines.filter(p => p.name !== name);

      if (filtered.length === pipelines.length) {
        return {
          success: false,
          error: 'not_found',
          message: `Pipeline "${name}" not found`
        };
      }

      const result = StorageService.save('pipelines', filtered);
      return result;
    } catch (err) {
      return {
        success: false,
        error: 'storage',
        message: err.message
      };
    }
  }

  /**
   * Migrate old pipeline schema to current version
   * @param {Object} pipeline - Pipeline object
   * @returns {Object} - Migrated pipeline
   */
  static migratePipeline(pipeline) {
    // No version = v1 (original schema)
    if (!pipeline._v) {
      return {
        ...pipeline,
        _v: SCHEMA_VERSION,
        updatedAt: pipeline.savedAt || new Date().toISOString()
      };
    }

    // Already current version
    if (pipeline._v === SCHEMA_VERSION) {
      return pipeline;
    }

    // Add future migrations here
    return pipeline;
  }

  /**
   * Get pipeline statistics
   * @returns {Object} - Statistics object
   */
  static getPipelineStats() {
    const pipelines = this.loadAllPipelines();

    const stats = {
      total: pipelines.length,
      active: pipelines.filter(p => p.isActive).length,
      inactive: pipelines.filter(p => !p.isActive).length,
      bySector: {}
    };

    // Count by sector
    pipelines.forEach(p => {
      const sector = p.sector || 'general';
      stats.bySector[sector] = (stats.bySector[sector] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export pipelines as JSON
   * @param {Array} pipelineNames - Names of pipelines to export (or null for all)
   * @returns {string} - JSON string
   */
  static exportPipelines(pipelineNames = null) {
    const allPipelines = this.loadAllPipelines();
    const toExport = pipelineNames
      ? allPipelines.filter(p => pipelineNames.includes(p.name))
      : allPipelines;

    return JSON.stringify({
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      pipelines: toExport
    }, null, 2);
  }

  /**
   * Import pipelines from JSON
   * @param {string} jsonString - JSON string to import
   * @returns {Object} - Result with success status
   */
  static importPipelines(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (!data.pipelines || !Array.isArray(data.pipelines)) {
        return {
          success: false,
          error: 'invalid_format',
          message: 'Invalid import format'
        };
      }

      const existingPipelines = this.loadAllPipelines();
      let imported = 0;
      let skipped = 0;

      for (const pipeline of data.pipelines) {
        try {
          validatePipeline(pipeline);

          // Check for duplicates
          if (!existingPipelines.find(p => p.name === pipeline.name)) {
            existingPipelines.push(this.migratePipeline(pipeline));
            imported++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.warn(`Skipping invalid pipeline: ${err.message}`);
          skipped++;
        }
      }

      const result = StorageService.save('pipelines', existingPipelines);

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        imported,
        skipped
      };
    } catch (err) {
      return {
        success: false,
        error: 'parse_error',
        message: `Failed to parse JSON: ${err.message}`
      };
    }
  }
}
