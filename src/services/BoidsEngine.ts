import { BitAgentPool } from '../lib/swarm/BitAgent.js';

export interface BoidsConfig {
    maxSpeed: number;
    maxForce: number;
    neighborhoodRadius: number;
    separationWeight: number;
    alignmentWeight: number;
    cohesionWeight: number;
    targetWeight: number;
    width: number;
    height: number;
}

/**
 * BoidsEngine: High-performance simulation loop for massive swarms.
 * 
 * Implements Reynolds Rule for flocking behavior with Spatial Binning.
 */
export class BoidsEngine {
    private config: BoidsConfig = {
        maxSpeed: 2.5,
        maxForce: 0.1,
        neighborhoodRadius: 50,
        separationWeight: 1.5,
        alignmentWeight: 1.0,
        cohesionWeight: 1.0,
        targetWeight: 0.5,
        width: 1000,
        height: 1000
    };

    private binSize = 50;
    private binHeads: Int32Array | null = null;
    private nextAgent: Int32Array | null = null;

    /**
     * Compute a single frame update for the entire pool.
     */
    update(pool: BitAgentPool, dt: number) {
        const stride = 8;
        const size = pool.size;
        const { width, height, neighborhoodRadius } = this.config;

        // 1. Initialize/Reset Spatial Grid
        const cols = Math.ceil(width / this.binSize);
        const rows = Math.ceil(height / this.binSize);
        const numBins = cols * rows;

        if (!this.binHeads || this.binHeads.length !== numBins) {
            this.binHeads = new Int32Array(numBins);
        }
        if (!this.nextAgent || this.nextAgent.length !== size) {
            this.nextAgent = new Int32Array(size);
        }

        this.binHeads.fill(-1);

        // 2. Populate Grid (O(N))
        for (let i = 0; i < size; i++) {
            const offset = i * stride;
            const x = pool.buffer[offset + 0];
            const y = pool.buffer[offset + 1];

            const col = Math.max(0, Math.min(cols - 1, Math.floor(x / this.binSize)));
            const row = Math.max(0, Math.min(rows - 1, Math.floor(y / this.binSize)));
            const binIdx = row * cols + col;

            this.nextAgent[i] = this.binHeads[binIdx];
            this.binHeads[binIdx] = i;
        }

        // 3. Update Loop (O(N) with local neighborhood)
        const radiusSq = neighborhoodRadius * neighborhoodRadius;

        for (let i = 0; i < size; i++) {
            const offset = i * stride;
            
            let sepX = 0, sepY = 0, sepCount = 0;
            let aliX = 0, aliY = 0, aliCount = 0;
            let cohX = 0, cohY = 0, cohCount = 0;

            const ix = pool.buffer[offset + 0];
            const iy = pool.buffer[offset + 1];
            const ivx = pool.buffer[offset + 2];
            const ivy = pool.buffer[offset + 3];

            // Local Neighborhood Check via Grid
            const iCol = Math.floor(ix / this.binSize);
            const iRow = Math.floor(iy / this.binSize);

            for (let c = iCol - 1; c <= iCol + 1; c++) {
                if (c < 0 || c >= cols) continue;
                for (let r = iRow - 1; r <= iRow + 1; r++) {
                    if (r < 0 || r >= rows) continue;
                    
                    const binIdx = r * cols + c;
                    let j = this.binHeads[binIdx];
                    
                    // Limit neighbors per agent to avoid dense hot-spots slowing down the prototype
                    let neighborsChecked = 0;
                    while (j !== -1 && neighborsChecked < 50) {
                        if (i !== j) {
                            const jOffset = j * stride;
                            const jx = pool.buffer[jOffset + 0];
                            const jy = pool.buffer[jOffset + 1];

                            const dx = ix - jx;
                            const dy = iy - jy;
                            const distSq = dx * dx + dy * dy;

                            if (distSq > 0 && distSq < radiusSq) {
                                const dist = Math.sqrt(distSq);
                                const jvx = pool.buffer[jOffset + 2];
                                const jvy = pool.buffer[jOffset + 3];
                                
                                // Separation
                                sepX += dx / dist;
                                sepY += dy / dist;
                                sepCount++;

                                // Alignment
                                aliX += jvx;
                                aliY += jvy;
                                aliCount++;

                                // Cohesion
                                cohX += jx;
                                cohY += jy;
                                cohCount++;
                            }
                        }
                        j = this.nextAgent[j];
                        neighborsChecked++;
                    }
                }
            }

            let steerX = 0;
            let steerY = 0;

            if (sepCount > 0) {
                sepX /= sepCount; sepY /= sepCount;
                steerX += sepX * this.config.separationWeight;
                steerY += sepY * this.config.separationWeight;
            }

            if (aliCount > 0) {
                aliX /= aliCount; aliY /= aliCount;
                steerX += aliX * this.config.alignmentWeight;
                steerY += aliY * this.config.alignmentWeight;
            }

            if (cohCount > 0) {
                cohX /= cohCount; cohY /= cohCount;
                cohX -= ix; cohY -= iy;
                steerX += cohX * this.config.cohesionWeight;
                steerY += cohY * this.config.cohesionWeight;
            }

            // Target attraction (Bayesian Guidance)
            const tx = pool.buffer[offset + 4] - ix;
            const ty = pool.buffer[offset + 5] - iy;
            steerX += tx * this.config.targetWeight;
            steerY += ty * this.config.targetWeight;

            // Apply steering to velocity
            pool.buffer[offset + 2] += steerX * this.config.maxForce;
            pool.buffer[offset + 3] += steerY * this.config.maxForce;

            // Limit speed
            const speedSq = pool.buffer[offset + 2] ** 2 + pool.buffer[offset + 3] ** 2;
            if (speedSq > this.config.maxSpeed * this.config.maxSpeed) {
                const speed = Math.sqrt(speedSq);
                pool.buffer[offset + 2] = (pool.buffer[offset + 2] / speed) * this.config.maxSpeed;
                pool.buffer[offset + 3] = (pool.buffer[offset + 3] / speed) * this.config.maxSpeed;
            }

            // Update position (with wrap-around for prototype)
            pool.buffer[offset + 0] = (pool.buffer[offset + 0] + pool.buffer[offset + 2] + width) % width;
            pool.buffer[offset + 1] = (pool.buffer[offset + 1] + pool.buffer[offset + 3] + height) % height;
        }
    }

    getConfig() {
        return this.config;
    }

    setConfig(newConfig: Partial<BoidsConfig>) {
        this.config = { ...this.config, ...newConfig };
    }
}

export const boidsEngine = new BoidsEngine();
