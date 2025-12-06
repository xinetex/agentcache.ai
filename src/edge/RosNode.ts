import { redactPII } from '../lib/pii/redactor.js';
import { MultiModalEncoder } from '../lib/llm/multimodal.js';

export interface SensorData {
    type: 'camera' | 'lidar' | 'text';
    payload: Buffer | string | any;
    timestamp: number;
}

export interface Action {
    command: string;
    confidence: number;
    source: 'cache' | 'compute';
}

interface MemoryEngram {
    vector: number[];
    action: Action;
}

/**
 * The Edge Brain.
 * Runs locally on the robot (ROS Node).
 */
export class RosNode {
    private id: string;
    private hiveUrl: string;

    // Updated: Memory is now Vector-Based, not Key-Value
    private memory: MemoryEngram[] = [];

    // The "Eyes"
    private encoder = new MultiModalEncoder();
    private SIMILARITY_THRESHOLD = 0.85; // 85% match required for Zero-Shot Action

    constructor(id: string, hiveUrl: string = 'http://localhost:3000/api/hive') {
        this.id = id;
        this.hiveUrl = hiveUrl;
    }

    /**
     * The main cognitive loop: Sensation -> Perception -> Action
     */
    async process(sensor: SensorData): Promise<Action> {
        // 1. Perception (Multi-Modal Embedding)
        // Map raw sensor data to Semantic Vector Space
        const queryVector = await this.encoder.embed(sensor.payload);

        // 2. Privacy Check (The Barrier)
        let safePayload = sensor.payload;
        if (typeof sensor.payload === 'string') {
            const redacted = redactPII(sensor.payload);
            if (redacted.riskScore > 0) {
                console.log(`[${this.id}] 🛡️ PII Detected & Redacted (Risk: ${redacted.riskScore})`);
                safePayload = redacted.redacted;
            }
        }

        // 3. Check L0 (Local Vector RAM) - Fuzzy Matching
        const match = this.findNearestNeighbor(queryVector);

        if (match && match.similarity > this.SIMILARITY_THRESHOLD) {
            console.log(`[${this.id}] 🧠 Memory Recall: ${(match.similarity * 100).toFixed(1)}% match`);
            return { ...match.engram.action, source: 'cache' };
        }

        // 4. Check L1/Hive (Cloud)
        const cachedMatch = await this.queryHiveVector(queryVector);
        if (cachedMatch && cachedMatch.similarity > this.SIMILARITY_THRESHOLD) {
            // Learn locally (Downlink)
            this.memory.push(cachedMatch.engram);
            return { ...cachedMatch.engram.action, source: 'cache' };
        }

        // 5. Compute (The "Slow" Path)
        // In reality, this runs SLAM or Path Planning
        const action = this.computeAction(safePayload);

        // 6. Share Learning (Federated Update)
        // Store vector + action in memory
        this.learn(queryVector, action);

        return { ...action, source: 'compute' };
    }

    private findNearestNeighbor(query: number[]): { engram: MemoryEngram, similarity: number } | null {
        return this.findMatchInCollection(query, this.memory);
    }

    private findMatchInCollection(query: number[], collection: MemoryEngram[]): { engram: MemoryEngram, similarity: number } | null {
        let bestMatch: MemoryEngram | null = null;
        let maxSim = -1;

        for (const engram of collection) {
            const sim = this.encoder.cosineSimilarity(query, engram.vector);
            if (sim > maxSim) {
                maxSim = sim;
                bestMatch = engram;
            }
        }
        return bestMatch ? { engram: bestMatch, similarity: maxSim } : null;
    }

    private async queryHiveVector(query: number[]) {
        // Mock Cloud Implementation
        // In Test, we will monkey-patch this.
        return null;
    }

    private learn(vector: number[], action: Action) {
        this.memory.push({ vector, action });
        this.uploadToHiveVector(vector, action);
    }

    private async uploadToHiveVector(vector: number[], action: Action) {
        // Mock Upload
    }

    /**
     * Mock: Local Compute (Path Planning)
     */
    private computeAction(payload: any): Action {
        return {
            command: 'avoid_obstacle', // Generalize command
            confidence: 0.95,
            source: 'compute'
        };
    }

    // Legacy methods removed or abstracted
}
