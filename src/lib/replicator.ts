import { db } from '../db/client';
import { knowledgeNodes } from '../db/schema';
import { eq } from 'drizzle-orm';

export class Replicator {
    /**
     * Simulates replicating a data item (knowledge node) to a target region.
     * In a real system, this would trigger data movement (e.g., S3 Cross-Region Replication).
     * Here, it updates the metadata to indicate availability.
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
            currentLocations.push(targetRegion);

            // 3. Save back to DB
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
