
import { redis } from '../lib/redis.js';

export interface SynapseSignal {
    sector: "ROBOTICS" | "BIOLOGICS" | "FINANCE" | "PHOTONICS" | "LEGAL" | "HEALTHCARE" | "ENERGY" | "BIOTECH";
    type: "ANOMALY" | "OPTIMIZATION" | "WARNING" | "DISCOVERY" | "OPTIMIZATION_REQUIRED" | "ENTITY_RESOLUTION";
    message: string;
    data?: any;
    // Phase 6: Semantic Backbone properties
    entities?: string[];
    relations?: Array<{ subject: string; predicate: string; object: string }>;
    ontologyRef?: string; // e.g. "finance@1.1.0"
}

export class CortexBridge {

    async synapse(signal: SynapseSignal) {
        // 1. Store in Semantic Stream (Redis Stream for scalable processing)
        // Format for XADD: key * field value [field value ...]
        const entry = {
            ts: Date.now().toString(),
            ...signal,
            data: signal.data ? JSON.stringify(signal.data) : '',
            entities: signal.entities ? JSON.stringify(signal.entities) : '',
            relations: signal.relations ? JSON.stringify(signal.relations) : ''
        };

        // XADD cortex:stream:synapses * message "..." sector "..." type "..."
        // Flatten object for Redis Stream
        const args: string[] = [];
        for (const [k, v] of Object.entries(entry)) {
            args.push(k, String(v));
        }

        const id = await redis.xadd('cortex:stream:synapses', '*', ...args);
        
        // Trim to keep buffer manageable (approx 1000 items)
        await redis.xtrim('cortex:stream:synapses', 'MAXLEN', '~', 1000);

        // 2. Update Vector Count (Simulation)
        if (Math.random() > 0.7) {
            await redis.incr('cortex:stats:vectors');
        }

        console.log(`[CORTEX] 🧠 Synapse Streamed [${id}]: [${signal.sector}] ${signal.message}`);
        return { id, ...entry };
    }

    /**
     * Retrieve recent context from Stream.
     */
    async recall(excludeSector: string): Promise<SynapseSignal[]> {
        // Fetch last 10 entries from stream
        const raw = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 10);
        
        const results: SynapseSignal[] = [];
        for (const [id, fields] of raw) {
            // Redis returns fields as flat array [k1, v1, k2, v2]
            const entry: any = {};
            for (let i = 0; i < fields.length; i += 2) {
                entry[fields[i]] = fields[i+1];
            }

            // Parse JSON fields
            if (entry.data) entry.data = JSON.parse(entry.data);
            if (entry.entities) entry.entities = JSON.parse(entry.entities);
            if (entry.relations) entry.relations = JSON.parse(entry.relations);

            if (entry.sector !== excludeSector && entry.type === 'WARNING') {
                results.push(entry);
            }
        }

        return results;
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

export const cortexBridge = new CortexBridge();
