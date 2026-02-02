
import { redis } from '../lib/redis.js';

export interface SynapseSignal {
    sector: "ROBOTICS" | "BIOLOGICS" | "FINANCE" | "PHOTONICS";
    type: "ANOMALY" | "OPTIMIZATION" | "WARNING" | "DISCOVERY";
    message: string;
    data?: any;
}

export class CortexBridge {

    /**
     * Store a "Synapse firing" (Insight/Event) from a Sector Agent.
     */
    async synapse(signal: SynapseSignal) {
        // 1. Store in Short Term Memory (Redis List for UI Stream)
        const entry = {
            id: Date.now().toString(),
            ts: Date.now(),
            ...signal
        };

        // Keep last 50 synapses for Mission Control Feed
        await redis.lpush('cortex:stream:synapses', JSON.stringify(entry));
        await redis.ltrim('cortex:stream:synapses', 0, 49);

        // 2. Update Vector Count (Simulation)
        // In a real implementation, we'd upsert to Pinecone here via HierarchicalMemory
        if (Math.random() > 0.7) {
            await redis.incr('cortex:stats:vectors');
        }

        console.log(`[CORTEX] 🧠 Synapse Fired: [${signal.sector}] ${signal.message}`);
        return entry;
    }

    /**
     * Retrieve recent context.
     * Real implementation would use vector search.
     * MVP: Returns recent warnings from other sectors.
     */
    async recall(excludeSector: string): Promise<SynapseSignal[]> {
        const raw = await redis.lrange('cortex:stream:synapses', 0, 10);
        const all: SynapseSignal[] = raw.map(s => JSON.parse(s));

        // Filter for warnings from OTHER sectors (e.g., Robot checks Finance Risk)
        return all.filter(s => s.sector !== excludeSector && s.type === 'WARNING');
    }

    async getStats() {
        const vectors = await redis.get('cortex:stats:vectors');
        const synapseCount = await redis.llen('cortex:stream:synapses');

        return {
            vectors: parseInt(vectors as string || '1240'), // Base count
            active_synapses: synapseCount,
            health: "OPTIMAL"
        };
    }
}
