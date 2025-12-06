import { createHash } from 'crypto';

/**
 * Count-Min Sketch
 * 
 * A probabilistic data structure for estimating the frequency of events in a stream of data.
 * It uses sub-linear space and guarantees no under-estimation (only over-estimation with low probability).
 * 
 * Used here for: TinyLFU Cache Admission (tracking frequency of embedding lookups).
 * 
 * Parameters:
 * - width (w): impacts error bound (epsilon = e / w)
 * - depth (d): impacts error probability (delta = 1 / e^d)
 */
export class CountMinSketch {
    private width: number;
    private depth: number;
    private table: Int32Array; // Using Int32Array for counter matrix flattened
    private seeds: number[];

    constructor(width: number = 256, depth: number = 4) {
        this.width = width;
        this.depth = depth;
        // Flattened table: index = row * width + col
        this.table = new Int32Array(width * depth);

        // Deterministic seeds for hash functions
        this.seeds = Array.from({ length: depth }, (_, i) => i * 1337 + 7);
    }

    /**
     * Hash function wrapper
     * Uses SHA-256 for quality, folded into 32-bit integer
     */
    private hash(key: string, seed: number): number {
        const hash = createHash('sha256')
            .update(`${key}:${seed}`)
            .digest('hex')
            .substring(0, 8); // Take first 8 chars (32 bits)
        return parseInt(hash, 16);
    }

    /**
     * Add an item to the sketch
     */
    add(key: string): void {
        for (let i = 0; i < this.depth; i++) {
            const h = this.hash(key, this.seeds[i]);
            const col = Math.abs(h) % this.width;
            const row = i;
            this.table[row * this.width + col]++;
        }
    }

    /**
     * Estimate frequency of an item
     * Returns min(counter[i]) for all hash functions i
     */
    estimate(key: string): number {
        let minCount = Infinity;
        for (let i = 0; i < this.depth; i++) {
            const h = this.hash(key, this.seeds[i]);
            const col = Math.abs(h) % this.width;
            const count = this.table[i * this.width + col];
            if (count < minCount) {
                minCount = count;
            }
        }
        return minCount === Infinity ? 0 : minCount;
    }

    /**
     * Reset the sketch (aging)
     * Divides all counters by 2 to simulate a sliding window (freshness).
     */
    reset(): void {
        for (let i = 0; i < this.table.length; i++) {
            this.table[i] = this.table[i] >>> 1; // Bitwise divide by 2
        }
    }

    /**
     * Serialize for persistence (base64)
     */
    serialize(): string {
        const buffer = Buffer.from(this.table.buffer);
        return buffer.toString('base64');
    }
}
