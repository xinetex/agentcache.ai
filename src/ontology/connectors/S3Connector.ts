/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { DataLakeConnector, DataLakeSource } from '../DataLakeConnector.js';

/**
 * S3Connector: Ingests data from S3-compatible object stores.
 * Supports AWS S3, MinIO, Lyve Cloud, and any S3-compatible endpoint.
 * Uses @aws-sdk/client-s3 (already in project dependencies).
 */
export class S3Connector extends DataLakeConnector {

    async ingest(source: DataLakeSource): Promise<string> {
        if (!source.uri) {
            throw new Error('[S3Connector] S3 URI is required (e.g., s3://bucket/key).');
        }

        const { bucket, key } = this.parseS3Uri(source.uri);

        console.log(`[S3Connector] Reading s3://${bucket}/${key}`);

        try {
            // Dynamic import to avoid loading AWS SDK unless S3 connector is used
            const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

            const client = new S3Client({
                region: process.env.AWS_REGION || 'us-east-1',
                // Supports custom endpoints for Lyve Cloud / MinIO
                ...(process.env.S3_ENDPOINT ? {
                    endpoint: process.env.S3_ENDPOINT,
                    forcePathStyle: true,
                } : {}),
            });

            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await client.send(command);

            if (!response.Body) {
                throw new Error(`[S3Connector] Empty response body for s3://${bucket}/${key}`);
            }

            // Stream to string
            const chunks: Uint8Array[] = [];
            for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
                chunks.push(chunk);
            }

            return Buffer.concat(chunks).toString('utf-8');

        } catch (error: any) {
            console.error(`[S3Connector] Failed to read s3://${bucket}/${key}:`, error.message);
            throw new Error(`S3 Ingestion Error: ${error.message}`);
        }
    }

    private parseS3Uri(uri: string): { bucket: string; key: string } {
        // Support both s3://bucket/key and bucket/key
        const cleaned = uri.replace(/^s3:\/\//, '');
        const slashIndex = cleaned.indexOf('/');

        if (slashIndex === -1) {
            throw new Error(`[S3Connector] Invalid S3 URI: "${uri}". Expected format: s3://bucket/key`);
        }

        return {
            bucket: cleaned.substring(0, slashIndex),
            key: cleaned.substring(slashIndex + 1),
        };
    }
}

export const s3Connector = new S3Connector();
