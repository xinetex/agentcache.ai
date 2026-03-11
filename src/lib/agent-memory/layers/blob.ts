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
 * Blob Layer - Object storage for large artifacts
 * 
 * Handles: documents, media, model outputs, context snapshots
 * Backends: Seagate Lyve Cloud / S3 (production), Local filesystem (dev)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BlobMetadata {
  namespace: string;
  createdAt: Date;
  size: number;
  contentType?: string;
  checksum?: string;
}

export class BlobLayer {
  private s3Client: S3Client | null = null;
  private bucket: string = '';
  private localPath: string;

  constructor() {
    this.localPath = path.join(process.cwd(), '.agent-blobs');
    this.initializeS3();
  }

  private initializeS3(): void {
    const endpoint = process.env.LYVE_ENDPOINT || process.env.AWS_S3_ENDPOINT;
    const accessKey = process.env.LYVE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.LYVE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.LYVE_BUCKET || process.env.AWS_S3_BUCKET;
    const region = process.env.LYVE_REGION || process.env.AWS_REGION || 'us-east-1';

    if (endpoint && accessKey && secretKey && bucket) {
      try {
        this.s3Client = new S3Client({
          endpoint,
          region,
          credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
          },
          forcePathStyle: true, // Required for Lyve Cloud
        });
        this.bucket = bucket;
        console.log('[BlobLayer] Connected to S3/Lyve Cloud:', endpoint);
      } catch (error) {
        console.warn('[BlobLayer] S3 init failed, using local storage:', error);
      }
    } else {
      console.warn('[BlobLayer] No S3 credentials, using local storage');
    }
  }

  /**
   * Store blob
   */
  async put(key: string, data: any, metadata: BlobMetadata): Promise<string> {
    const buffer = this.toBuffer(data);
    const contentType = metadata.contentType || this.inferContentType(key, data);

    if (this.s3Client) {
      try {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.makeS3Key(key),
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            namespace: metadata.namespace,
            createdAt: metadata.createdAt.toISOString(),
            checksum: metadata.checksum || '',
          },
        }));

        return `s3://${this.bucket}/${this.makeS3Key(key)}`;
      } catch (error) {
        console.error('[BlobLayer] S3 put failed:', error);
        // Fall through to local storage
      }
    }

    // Local storage fallback
    return this.localPut(key, buffer, metadata);
  }

  /**
   * Get blob
   */
  async get(key: string): Promise<Buffer | null> {
    if (this.s3Client) {
      try {
        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.makeS3Key(key),
        }));

        if (response.Body) {
          const chunks: Uint8Array[] = [];
          for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks);
        }
      } catch (error: any) {
        if (error.name !== 'NoSuchKey') {
          console.error('[BlobLayer] S3 get failed:', error);
        }
      }
    }

    // Local fallback
    return this.localGet(key);
  }

  /**
   * Delete blob
   */
  async delete(key: string): Promise<void> {
    if (this.s3Client) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.makeS3Key(key),
        }));
      } catch (error) {
        console.error('[BlobLayer] S3 delete failed:', error);
      }
    }

    // Also delete local copy
    await this.localDelete(key);
  }

  /**
   * Check if blob exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.s3Client) {
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.makeS3Key(key),
        }));
        return true;
      } catch (error: any) {
        if (error.name !== 'NotFound') {
          console.error('[BlobLayer] S3 exists check failed:', error);
        }
      }
    }

    return this.localExists(key);
  }

  /**
   * Get blob URL (for direct access)
   */
  getUrl(key: string): string {
    if (this.s3Client) {
      const endpoint = process.env.LYVE_ENDPOINT || process.env.AWS_S3_ENDPOINT;
      return `${endpoint}/${this.bucket}/${this.makeS3Key(key)}`;
    }
    return `file://${this.localPath}/${this.makeLocalPath(key)}`;
  }

  // ==========================================================================
  // LOCAL STORAGE
  // ==========================================================================

  private async localPut(key: string, buffer: Buffer, metadata: BlobMetadata): Promise<string> {
    const filePath = path.join(this.localPath, this.makeLocalPath(key));
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    // Store metadata
    await fs.writeFile(
      `${filePath}.meta`,
      JSON.stringify(metadata, null, 2)
    );

    return `file://${filePath}`;
  }

  private async localGet(key: string): Promise<Buffer | null> {
    const filePath = path.join(this.localPath, this.makeLocalPath(key));

    try {
      return await fs.readFile(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[BlobLayer] Local read failed:', error);
      }
      return null;
    }
  }

  private async localDelete(key: string): Promise<void> {
    const filePath = path.join(this.localPath, this.makeLocalPath(key));

    try {
      await fs.unlink(filePath);
      await fs.unlink(`${filePath}.meta`).catch(() => { });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[BlobLayer] Local delete failed:', error);
      }
    }
  }

  private async localExists(key: string): Promise<boolean> {
    const filePath = path.join(this.localPath, this.makeLocalPath(key));

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private makeS3Key(key: string): string {
    // Ensure clean S3 key
    return `agent-memory/${key.replace(/:/g, '/')}`;
  }

  private makeLocalPath(key: string): string {
    // Convert key to safe file path
    return key.replace(/:/g, '/').replace(/[^a-zA-Z0-9/._-]/g, '_');
  }

  private toBuffer(data: any): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof Uint8Array) return Buffer.from(data);
    if (typeof data === 'string') return Buffer.from(data, 'utf8');
    return Buffer.from(JSON.stringify(data), 'utf8');
  }

  private inferContentType(key: string, data: any): string {
    const ext = path.extname(key).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };

    if (mimeTypes[ext]) return mimeTypes[ext];
    if (typeof data === 'string') return 'text/plain';
    if (Buffer.isBuffer(data)) return 'application/octet-stream';
    return 'application/json';
  }
}

export default BlobLayer;
