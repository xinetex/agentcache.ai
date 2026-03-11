/**
 * BitAgent: High-performance, low-memory agent representation.
 * 
 * Instead of millions of Javascript objects, we use a single pre-allocated 
 * TypedArray (Float32Array) to store agent states. This avoids GC pressure
 * and allows for GPU-like memory access patterns.
 * 
 * Each agent uses 8 slots (32 bytes):
 * 0: posX
 * 1: posY
 * 2: velX
 * 3: velY
 * 4: targetX
 * 5: targetY
 * 6: sectorId (normalized float)
 * 7: intentScore (0.0 to 1.0)
 */
export class BitAgentPool {
    public buffer: Float32Array;
    public size: number;
    private stride = 8;

    constructor(maxAgents: number) {
        this.size = maxAgents;
        this.buffer = new Float32Array(maxAgents * this.stride);
    }

    /**
     * Randomly initialize agents within a coordinate space.
     */
    initialize(width: number, height: number, sectorId = 0) {
        for (let i = 0; i < this.size; i++) {
            const offset = i * this.stride;
            this.buffer[offset + 0] = Math.random() * width;  // posX
            this.buffer[offset + 1] = Math.random() * height; // posY
            this.buffer[offset + 2] = (Math.random() - 0.5) * 2; // velX
            this.buffer[offset + 3] = (Math.random() - 0.5) * 2; // velY
            this.buffer[offset + 4] = width / 2;  // targetX
            this.buffer[offset + 5] = height / 2; // targetY
            this.buffer[offset + 6] = sectorId;   // sectorId
            this.buffer[offset + 7] = Math.random(); // intentScore
        }
    }

    getAgent(index: number) {
        const offset = index * this.stride;
        return {
            posX: this.buffer[offset + 0],
            posY: this.buffer[offset + 1],
            velX: this.buffer[offset + 2],
            velY: this.buffer[offset + 3],
            targetX: this.buffer[offset + 4],
            targetY: this.buffer[offset + 5],
            sectorId: this.buffer[offset + 6],
            intentScore: this.buffer[offset + 7],
        };
    }

    setAgent(index: number, data: any) {
        const offset = index * this.stride;
        if (data.posX !== undefined) this.buffer[offset + 0] = data.posX;
        if (data.posY !== undefined) this.buffer[offset + 1] = data.posY;
        if (data.velX !== undefined) this.buffer[offset + 2] = data.velX;
        if (data.velY !== undefined) this.buffer[offset + 3] = data.velY;
        if (data.targetX !== undefined) this.buffer[offset + 4] = data.targetX;
        if (data.targetY !== undefined) this.buffer[offset + 5] = data.targetY;
        if (data.sectorId !== undefined) this.buffer[offset + 6] = data.sectorId;
        if (data.intentScore !== undefined) this.buffer[offset + 7] = data.intentScore;
    }
}
