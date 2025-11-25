/**
 * Storage Provider Abstraction Layer
 * Unified interface for S3, Azure, GCP, JettyThunder, and Lyve Cloud
 */

/**
 * Base Storage Provider Interface
 * All providers must implement these methods
 */
export class StorageProvider {
  constructor(config) {
    this.config = config;
    this.type = 'base';
  }

  async upload(file, options = {}) {
    throw new Error('upload() must be implemented by provider');
  }

  async download(key, options = {}) {
    throw new Error('download() must be implemented by provider');
  }

  async delete(key) {
    throw new Error('delete() must be implemented by provider');
  }

  async list(prefix = '', options = {}) {
    throw new Error('list() must be implemented by provider');
  }

  async getMetadata(key) {
    throw new Error('getMetadata() must be implemented by provider');
  }

  async generatePresignedUrl(key, expiresIn = 3600) {
    throw new Error('generatePresignedUrl() must be implemented by provider');
  }
}

/**
 * JettyThunder Storage Provider
 * Uses JettySpeed protocol for accelerated transfers
 */
export class JettyThunderProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.type = 'jettythunder';
    this.apiBaseUrl = config.apiBaseUrl || 'https://jettythunder.app/api';
    this.apiKey = config.apiKey;
    this.jettySpeedEnabled = config.jettySpeedEnabled !== false; // Default true
    this.localCdnUrl = config.localCdnUrl || 'http://localhost:53777';
  }

  /**
   * Check if desktop CDN is available
   */
  async detectDesktopCDN() {
    try {
      const response = await fetch(`${this.localCdnUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Upload file using JettySpeed protocol or standard upload
   */
  async upload(file, options = {}) {
    const {
      onProgress,
      onChunkProgress,
      folder = '',
      metadata = {}
    } = options;

    // Try desktop CDN first for JettySpeed
    if (this.jettySpeedEnabled) {
      const desktopAvailable = await this.detectDesktopCDN();
      
      if (desktopAvailable) {
        return await this.uploadViaDesktop(file, { onProgress, folder, metadata });
      }
    }

    // Fallback to standard upload via API
    return await this.uploadViaAPI(file, { onProgress, folder, metadata });
  }

  /**
   * Upload via desktop app using JettySpeed protocol
   */
  async uploadViaDesktop(file, options) {
    const { onProgress, folder, metadata } = options;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('metadata', JSON.stringify(metadata));

      // Use JettySpeed endpoint
      const response = await fetch(`${this.localCdnUrl}/jetty-speed/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'X-File-Name': file.name,
          'X-File-Size': file.size.toString()
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        key: result.key,
        url: result.url,
        size: file.size,
        provider: 'jettythunder',
        accelerated: true,
        metadata: result.metadata
      };
    } catch (err) {
      console.warn('Desktop upload failed, falling back to API:', err);
      return await this.uploadViaAPI(file, options);
    }
  }

  /**
   * Upload via JettyThunder API (standard)
   */
  async uploadViaAPI(file, options) {
    const { onProgress, folder, metadata } = options;

    try {
      // Get presigned upload URL
      const presignResponse = await fetch(`${this.apiBaseUrl}/storage/presigned-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          folder,
          metadata
        })
      });

      if (!presignResponse.ok) {
        throw new Error('Failed to get presigned URL');
      }

      const { uploadUrl, key } = await presignResponse.json();

      // Upload file
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(e.loaded, e.total);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              success: true,
              key,
              url: `${this.apiBaseUrl}/storage/${key}`,
              size: file.size,
              provider: 'jettythunder',
              accelerated: false
            });
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Download file from JettyThunder
   */
  async download(key, options = {}) {
    const { onProgress } = options;

    try {
      const url = await this.generatePresignedUrl(key);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Handle progress if supported
      if (onProgress && response.body) {
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        let receivedLength = 0;
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          if (onProgress) {
            onProgress(receivedLength, contentLength);
          }
        }

        return new Blob(chunks);
      }

      return await response.blob();
    } catch (err) {
      throw new Error(`Download failed: ${err.message}`);
    }
  }

  /**
   * Delete file from JettyThunder
   */
  async delete(key) {
    const response = await fetch(`${this.apiBaseUrl}/storage/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }

    return { success: true };
  }

  /**
   * List files in JettyThunder storage
   */
  async list(prefix = '', options = {}) {
    const { limit = 1000, continuationToken } = options;

    const params = new URLSearchParams({
      prefix,
      limit: limit.toString()
    });

    if (continuationToken) {
      params.append('continuationToken', continuationToken);
    }

    const response = await fetch(`${this.apiBaseUrl}/storage/list?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`List failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get file metadata
   */
  async getMetadata(key) {
    const response = await fetch(`${this.apiBaseUrl}/storage/${key}/metadata`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Get metadata failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate presigned download URL
   */
  async generatePresignedUrl(key, expiresIn = 3600) {
    const response = await fetch(`${this.apiBaseUrl}/storage/presigned-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key,
        expiresIn
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate presigned URL');
    }

    const { url } = await response.json();
    return url;
  }
}

/**
 * AWS S3 Provider
 */
export class S3Provider extends StorageProvider {
  constructor(config) {
    super(config);
    this.type = 's3';
    this.bucket = config.bucket;
    this.region = config.region || 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
  }

  async upload(file, options = {}) {
    // Implementation would use AWS SDK
    throw new Error('S3Provider not yet implemented - use JettyThunder provider');
  }

  async download(key, options = {}) {
    throw new Error('S3Provider not yet implemented');
  }

  async delete(key) {
    throw new Error('S3Provider not yet implemented');
  }

  async list(prefix = '', options = {}) {
    throw new Error('S3Provider not yet implemented');
  }

  async getMetadata(key) {
    throw new Error('S3Provider not yet implemented');
  }

  async generatePresignedUrl(key, expiresIn = 3600) {
    throw new Error('S3Provider not yet implemented');
  }
}

/**
 * Azure Blob Storage Provider
 */
export class AzureBlobProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.type = 'azure';
    this.accountName = config.accountName;
    this.accountKey = config.accountKey;
    this.containerName = config.containerName;
  }

  async upload(file, options = {}) {
    throw new Error('AzureBlobProvider not yet implemented - use JettyThunder provider');
  }

  async download(key, options = {}) {
    throw new Error('AzureBlobProvider not yet implemented');
  }

  async delete(key) {
    throw new Error('AzureBlobProvider not yet implemented');
  }

  async list(prefix = '', options = {}) {
    throw new Error('AzureBlobProvider not yet implemented');
  }

  async getMetadata(key) {
    throw new Error('AzureBlobProvider not yet implemented');
  }

  async generatePresignedUrl(key, expiresIn = 3600) {
    throw new Error('AzureBlobProvider not yet implemented');
  }
}

/**
 * Google Cloud Storage Provider
 */
export class GCPStorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.type = 'gcp';
    this.bucket = config.bucket;
    this.projectId = config.projectId;
    this.credentials = config.credentials;
  }

  async upload(file, options = {}) {
    throw new Error('GCPStorageProvider not yet implemented - use JettyThunder provider');
  }

  async download(key, options = {}) {
    throw new Error('GCPStorageProvider not yet implemented');
  }

  async delete(key) {
    throw new Error('GCPStorageProvider not yet implemented');
  }

  async list(prefix = '', options = {}) {
    throw new Error('GCPStorageProvider not yet implemented');
  }

  async getMetadata(key) {
    throw new Error('GCPStorageProvider not yet implemented');
  }

  async generatePresignedUrl(key, expiresIn = 3600) {
    throw new Error('GCPStorageProvider not yet implemented');
  }
}

/**
 * Lyve Cloud Provider (Seagate)
 */
export class LyveCloudProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.type = 'lyve';
    this.endpoint = config.endpoint;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucket = config.bucket;
  }

  async upload(file, options = {}) {
    throw new Error('LyveCloudProvider not yet implemented - use JettyThunder provider');
  }

  async download(key, options = {}) {
    throw new Error('LyveCloudProvider not yet implemented');
  }

  async delete(key) {
    throw new Error('LyveCloudProvider not yet implemented');
  }

  async list(prefix = '', options = {}) {
    throw new Error('LyveCloudProvider not yet implemented');
  }

  async getMetadata(key) {
    throw new Error('LyveCloudProvider not yet implemented');
  }

  async generatePresignedUrl(key, expiresIn = 3600) {
    throw new Error('LyveCloudProvider not yet implemented');
  }
}

/**
 * Storage Provider Factory
 * Creates the appropriate provider based on configuration
 */
export class StorageProviderFactory {
  static create(config) {
    switch (config.provider) {
      case 'jettythunder':
        return new JettyThunderProvider(config);
      
      case 's3':
        return new S3Provider(config);
      
      case 'azure':
        return new AzureBlobProvider(config);
      
      case 'gcp':
        return new GCPStorageProvider(config);
      
      case 'lyve':
        return new LyveCloudProvider(config);
      
      default:
        throw new Error(`Unknown storage provider: ${config.provider}`);
    }
  }
}

/**
 * Storage tier definitions with pricing and limits
 */
export const STORAGE_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    storage: 5 * 1024 * 1024 * 1024, // 5GB
    bandwidth: 10 * 1024 * 1024 * 1024, // 10GB/month
    requests: 1000, // per month
    jettySpeedEnabled: false,
    providers: ['jettythunder'],
    features: [
      'Basic caching',
      'Standard upload/download',
      'Community support'
    ]
  },
  
  pro: {
    name: 'Pro',
    price: 29, // per month
    storage: 100 * 1024 * 1024 * 1024, // 100GB
    bandwidth: 500 * 1024 * 1024 * 1024, // 500GB/month
    requests: 100000, // per month
    jettySpeedEnabled: true,
    providers: ['jettythunder', 's3', 'azure'],
    features: [
      'JettySpeed accelerated transfers (3-5x faster)',
      'Multi-cloud support',
      'Advanced caching strategies',
      'Priority support',
      'Analytics dashboard'
    ]
  },
  
  enterprise: {
    name: 'Enterprise',
    price: 299, // per month
    storage: 1024 * 1024 * 1024 * 1024, // 1TB
    bandwidth: 5 * 1024 * 1024 * 1024 * 1024, // 5TB/month
    requests: 10000000, // per month
    jettySpeedEnabled: true,
    providers: ['jettythunder', 's3', 'azure', 'gcp', 'lyve'],
    features: [
      'JettySpeed accelerated transfers (3-5x faster)',
      'All cloud providers',
      'Custom caching rules',
      'HIPAA/SOC2 compliance',
      'Dedicated support',
      'SLA guarantees',
      'Custom integrations'
    ]
  }
};

/**
 * Get recommended storage tier for a sector
 */
export function getRecommendedTier(sector) {
  const recommendations = {
    healthcare: 'enterprise', // HIPAA compliance required
    finance: 'enterprise', // SOC2 compliance required
    legal: 'pro', // Secure storage needed
    ecommerce: 'pro', // High traffic
    saas: 'pro', // Multi-tenant needs
    general: 'free' // Start small
  };

  return recommendations[sector] || 'free';
}

/**
 * Get recommended provider for a sector
 */
export function getRecommendedProvider(sector) {
  const recommendations = {
    healthcare: 'jettythunder', // HIPAA-compliant
    finance: 'jettythunder', // SOC2-compliant
    legal: 'jettythunder', // Secure
    ecommerce: 'jettythunder', // Fast uploads
    saas: 'jettythunder', // Multi-tenant ready
    general: 'jettythunder' // Best default
  };

  return recommendations[sector] || 'jettythunder';
}
