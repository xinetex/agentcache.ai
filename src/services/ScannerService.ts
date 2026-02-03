
import { db } from '../db/client.js';
import { signals } from '../db/schema.js';
import { sql, eq, desc } from 'drizzle-orm';

export class ScannerService {

    /**
     * Report a signal finding from an agent
     */
    static async reportSignal(agentId: string, data: {
        target: string;
        type: string;
        strength: number;
        lat: number;
        lon: number;
        metadata: any;
    }) {
        console.log(`📡 Signal Detected by ${agentId}: ${data.target} (${data.strength}dBm)`);

        // Insert new signal
        // We accumulate history rather than just updating, to show "movement" or "persistence" over time per plan
        await db.insert(signals).values({
            agentId,
            target: data.target,
            type: data.type,
            strength: data.strength,
            lat: data.lat,
            lon: data.lon,
            metadata: data.metadata,
        });

        return { success: true };
    }

    /**
     * Get aggregated signals for heatmap visualization
     * Returns strongest recent signal for each distinct target
     */
    static async getHeatmapData() {
        // Simple strategy: Get the latest 500 signals
        // In a real heatmap, we might grid this aggregation server-side

        const recentSignals = await db.select()
            .from(signals)
            .orderBy(desc(signals.seenAt))
            .limit(500);

        return recentSignals;
    }
}
