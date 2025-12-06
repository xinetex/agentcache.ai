import { db } from '../db/client';
import { knowledgeNodes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generatePresignedUrl } from '../../lib/aws-sig-v4.js';

export class Replicator {
    /**
     * Checks if the object actively exists in the target region's S3 bucket.
     * Uses a HEAD request via a presigned URL to verify existence without downloading.
     */
    async verifyRemoteExistence(key: string, region: string): Promise<boolean> {
        // Map region to endpoint (simplistic mapping for MVP)
        // In production, this would use a proper region-map config
        const endpoints: Record<string, string> = {
            'us-east-1': 'https://s3.us-east-1.lyvecloud.seagate.com',
            'us-west-1': 'https://s3.us-west-1.lyvecloud.seagate.com',
            'ap-southeast-1': 'https://s3.ap-southeast-1.lyvecloud.seagate.com'
        };

        const endpoint = endpoints[region] || endpoints['us-east-1'];
        const bucket = process.env.LYVE_BUCKET || 'jettydata-prod';

        try {
            const url = generatePresignedUrl({
                method: 'HEAD',
                bucket,
                key,
                region,
                endpoint,
                accessKeyId: process.env.LYVE_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.LYVE_SECRET_ACCESS_KEY || '',
                expiresIn: 300 // 5 minutes
            });

            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            console.warn(`Replicator: Failed to verify existence in ${region}`, e);
            return false;
        }
    }

    /**
     * Simulates replicating a data item (knowledge node) to a target region.
     * NOW verifies existence before "confirming" replication.
     */
    async replicate(key: string, targetRegion: string): Promise<{ success: boolean; locations: string[] }> {
        // 1. Fetch current node
        const nodes = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, key));

        if (nodes.length === 0) {
            throw new Error(`Knowledge node not found: ${key}`);
        }

        const node = nodes[0];
        const value = node.value as any;

        // 2. Update locations
        const currentLocations: string[] = value.replica_locations || ['us-east']; // Default home region

        if (!currentLocations.includes(targetRegion)) {
            // 3. Active Verification (New Logic)
            const exists = await this.verifyRemoteExistence(key, targetRegion);

            if (!exists) {
                // Trigger replication job? For MVP we assume the job was triggered elsewhere 
                // and we just fail to ACK if it's not there yet.
                // OR, we optimistically add it but log a warning.
                // Let's be strict: if it's not there, we don't say it is.
                console.warn(`Replicator: Object ${key} not found in ${targetRegion}. Replication incomplete.`);
                return { success: false, locations: currentLocations };
            }

            currentLocations.push(targetRegion);

            // 4. Save back to DB
            await db.update(knowledgeNodes)
                .set({
                    value: { ...value, replica_locations: currentLocations },
                    lastVerifiedAt: new Date()
                })
                .where(eq(knowledgeNodes.key, key));
        }

        return { success: true, locations: currentLocations };
    }

    /**
     * Checks where a key is currently available.
     */
    async getLocations(key: string): Promise<string[]> {
        const nodes = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.key, key));
        if (nodes.length === 0) return [];
        return (nodes[0].value as any).replica_locations || ['us-east'];
    }
}

export const replicator = new Replicator();
