/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * Storage Provider Abstraction Layer
 * Unified interface for S3, Azure, GCP, JettyThunder, and Lyve Cloud
 */

export interface StorageOptions {
    onProgress?: (loaded: number, total: number) => void;
    folder?: string;
    metadata?: Record<string, string>;
}

export interface StorageDownloadOptions {
    onProgress?: (loaded: number, total: number) => void;
}

export interface StorageListOptions {
    limit?: number;
    continuationToken?: string;
}

export interface UploadResult {
    success: boolean;
    key?: string;
    url?: string;
    size?: number;
    provider?: string;
    accelerated?: boolean;
    metadata?: any;
    error?: string;
}

// ============================================================================
// INTERFACE SEGREGATION
// ============================================================================

export interface IStorageProvider {
    type: string;
    upload(file: File | Blob, options?: StorageOptions): Promise<UploadResult>;
    download(key: string, options?: StorageDownloadOptions): Promise<Blob>;
    delete(key: string): Promise<{ success: boolean; error?: string }>;
    generatePresignedUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface IListable {
    list(prefix?: string, options?: StorageListOptions): Promise<any>;
    getMetadata(key: string): Promise<any>;
}

export interface IAcceleratedTransfer {
    detectDesktopCDN(): Promise<boolean>;
    uploadViaDesktop(file: File | Blob, options?: StorageOptions): Promise<UploadResult>;
}

// ============================================================================
// DEPENDENCY INJECTION / REGISTRY PATTERN
// ============================================================================

export class StorageRegistry {
    private static providers: Map<string, new (config: any) => IStorageProvider> = new Map();

    static register(type: string, providerClass: new (config: any) => IStorageProvider) {
        this.providers.set(type, providerClass);
    }

    static create(config: any): IStorageProvider {
        const ProviderClass = this.providers.get(config.provider);
        if (!ProviderClass) {
            throw new Error(`Unknown storage provider: ${config.provider}`);
        }
        return new ProviderClass(config);
    }
}

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

/**
 * JettyThunder Storage Provider
 * Uses JettySpeed protocol for accelerated transfers
 */
export class JettyThunderProvider implements IStorageProvider, IListable, IAcceleratedTransfer {
    public type = 'jettythunder';
    private apiBaseUrl: string;
    private apiKey: string;
    private jettySpeedEnabled: boolean;
    private localCdnUrl: string;

    constructor(config: any) {
        this.apiBaseUrl = config.apiBaseUrl || 'https://jettythunder.app/api';
        this.apiKey = config.apiKey;
        this.jettySpeedEnabled = config.jettySpeedEnabled !== false; // Default true
        this.localCdnUrl = config.localCdnUrl || 'http://localhost:53777';
    }

    async detectDesktopCDN(): Promise<boolean> {
        try {
            const response = await fetch(`${this.localCdnUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(1000) // 1 second timeout
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async upload(file: File | Blob, options: StorageOptions = {}): Promise<UploadResult> {
        const { onProgress, folder = '', metadata = {} } = options;

        if (this.jettySpeedEnabled) {
            const desktopAvailable = await this.detectDesktopCDN();
            if (desktopAvailable) {
                return await this.uploadViaDesktop(file, { onProgress, folder, metadata });
            }
        }

        return await this.uploadViaAPI(file, { onProgress, folder, metadata });
    }

    async uploadViaDesktop(file: File | Blob, options: StorageOptions): Promise<UploadResult> {
        const { folder = '', metadata = {} } = options;
        const fileName = file instanceof File ? file.name : 'blob';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);
            formData.append('metadata', JSON.stringify(metadata));

            const response = await fetch(`${this.localCdnUrl}/jetty-speed/upload`, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiKey,
                    'X-File-Name': fileName,
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
        } catch (err: any) {
            console.warn('Desktop upload failed, falling back to API:', err);
            return await this.uploadViaAPI(file, options);
        }
    }

    async uploadViaAPI(file: File | Blob, options: StorageOptions): Promise<UploadResult> {
        const { folder = '', metadata = {} } = options;
        const fileName = file instanceof File ? file.name : 'blob';

        try {
            const presignResponse = await fetch(`${this.apiBaseUrl}/storage/presigned-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName,
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

            const xhr = new XMLHttpRequest();

            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && options.onProgress) {
                        options.onProgress(e.loaded, e.total);
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
        } catch (err: any) {
            return {
                success: false,
                error: err.message
            };
        }
    }

    async download(key: string, options: StorageDownloadOptions = {}): Promise<Blob> {
        const { onProgress } = options;

        try {
            const url = await this.generatePresignedUrl(key);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            if (onProgress && response.body) {
                const reader = response.body.getReader();
                const contentLength = +(response.headers.get('Content-Length') || 0);
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
        } catch (err: any) {
            throw new Error(`Download failed: ${err.message}`);
        }
    }

    async delete(key: string): Promise<{ success: boolean; error?: string }> {
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

    async list(prefix = '', options: StorageListOptions = {}): Promise<any> {
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

    async getMetadata(key: string): Promise<any> {
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

    async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
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
export class S3Provider implements IStorageProvider {
    public type = 's3';
    private bucket: string;
    private region: string;
    private accessKeyId: string;
    private secretAccessKey: string;

    constructor(config: any) {
        this.bucket = config.bucket;
        this.region = config.region || 'us-east-1';
        this.accessKeyId = config.accessKeyId;
        this.secretAccessKey = config.secretAccessKey;
    }

    async upload(file: File | Blob, options: StorageOptions = {}): Promise<UploadResult> {
        throw new Error('S3Provider not yet implemented - use JettyThunder provider');
    }

    async download(key: string, options: StorageDownloadOptions = {}): Promise<Blob> {
        throw new Error('S3Provider not yet implemented');
    }

    async delete(key: string): Promise<{ success: boolean; error?: string }> {
        throw new Error('S3Provider not yet implemented');
    }

    async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
        throw new Error('S3Provider not yet implemented');
    }
}

/**
 * Azure Blob Storage Provider
 */
export class AzureBlobProvider implements IStorageProvider {
    public type = 'azure';
    private accountName: string;
    private accountKey: string;
    private containerName: string;

    constructor(config: any) {
        this.accountName = config.accountName;
        this.accountKey = config.accountKey;
        this.containerName = config.containerName;
    }

    async upload(): Promise<UploadResult> { throw new Error('Not implemented'); }
    async download(): Promise<Blob> { throw new Error('Not implemented'); }
    async delete(): Promise<{ success: boolean }> { throw new Error('Not implemented'); }
    async generatePresignedUrl(): Promise<string> { throw new Error('Not implemented'); }
}

/**
 * Google Cloud Storage Provider
 */
export class GCPStorageProvider implements IStorageProvider {
    public type = 'gcp';
    private bucket: string;
    private projectId: string;
    private credentials: any;

    constructor(config: any) {
        this.bucket = config.bucket;
        this.projectId = config.projectId;
        this.credentials = config.credentials;
    }

    async upload(): Promise<UploadResult> { throw new Error('Not implemented'); }
    async download(): Promise<Blob> { throw new Error('Not implemented'); }
    async delete(): Promise<{ success: boolean }> { throw new Error('Not implemented'); }
    async generatePresignedUrl(): Promise<string> { throw new Error('Not implemented'); }
}

/**
 * Lyve Cloud Provider (Seagate)
 */
export class LyveCloudProvider implements IStorageProvider {
    public type = 'lyve';
    private endpoint: string;
    private accessKeyId: string;
    private secretAccessKey: string;
    private bucket: string;

    constructor(config: any) {
        this.endpoint = config.endpoint;
        this.accessKeyId = config.accessKeyId;
        this.secretAccessKey = config.secretAccessKey;
        this.bucket = config.bucket;
    }

    async upload(): Promise<UploadResult> { throw new Error('Not implemented'); }
    async download(): Promise<Blob> { throw new Error('Not implemented'); }
    async delete(): Promise<{ success: boolean }> { throw new Error('Not implemented'); }
    async generatePresignedUrl(): Promise<string> { throw new Error('Not implemented'); }
}

// ============================================================================
// SELF REGISTRATION
// ============================================================================

StorageRegistry.register('jettythunder', JettyThunderProvider);
StorageRegistry.register('s3', S3Provider);
StorageRegistry.register('azure', AzureBlobProvider);
StorageRegistry.register('gcp', GCPStorageProvider);
StorageRegistry.register('lyve', LyveCloudProvider);

// ============================================================================
// STORAGE CONFIGURATION EXPORTS
// ============================================================================

export const STORAGE_TIERS = {
    free: {
        name: 'Free',
        price: 0,
        storage: 5 * 1024 * 1024 * 1024,
        bandwidth: 10 * 1024 * 1024 * 1024,
        requests: 1000,
        jettySpeedEnabled: false,
        providers: ['jettythunder'],
        features: ['Basic caching', 'Standard upload/download', 'Community support']
    },
    pro: {
        name: 'Pro',
        price: 29,
        storage: 100 * 1024 * 1024 * 1024,
        bandwidth: 500 * 1024 * 1024 * 1024,
        requests: 100000,
        jettySpeedEnabled: true,
        providers: ['jettythunder', 's3', 'azure'],
        features: ['JettySpeed accelerated transfers (3-5x faster)', 'Multi-cloud support', 'Advanced caching strategies', 'Priority support', 'Analytics dashboard']
    },
    enterprise: {
        name: 'Enterprise',
        price: 299,
        storage: 1024 * 1024 * 1024 * 1024,
        bandwidth: 5 * 1024 * 1024 * 1024 * 1024,
        requests: 10000000,
        jettySpeedEnabled: true,
        providers: ['jettythunder', 's3', 'azure', 'gcp', 'lyve'],
        features: ['JettySpeed accelerated transfers (3-5x faster)', 'All cloud providers', 'Custom caching rules', 'HIPAA/SOC2 compliance', 'Dedicated support', 'SLA guarantees', 'Custom integrations']
    }
};

export function getRecommendedTier(sector: string): string {
    const recommendations: Record<string, string> = {
        healthcare: 'enterprise',
        finance: 'enterprise',
        legal: 'pro',
        ecommerce: 'pro',
        saas: 'pro',
        general: 'free'
    };
    return recommendations[sector] || 'free';
}

export function getRecommendedProvider(sector: string): string {
    const recommendations: Record<string, string> = {
        healthcare: 'jettythunder',
        finance: 'jettythunder',
        legal: 'jettythunder',
        ecommerce: 'jettythunder',
        saas: 'jettythunder',
        general: 'jettythunder'
    };
    return recommendations[sector] || 'jettythunder';
}
