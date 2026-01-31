
/**
 * Holographic Associative Memory (Hopfield Network)
 * 
 * Based on the principles of John Hopfield (Nobel Prize in Physics 2024).
 * Stores patterns as energy minima in a dynamical system.
 * 
 * "The system constructs an energy determination landscape, and the 
 * dynamics of the system are such that it moves inevitably towards 
 * minimal energy states—the memories."
 */
export class HopfieldNetwork {
    private weights: Float32Array;
    private dimension: number;
    private capacity: number; // Approximate stable capacity ~ 0.14 * N

    constructor(dimension: number = 64) {
        this.dimension = dimension;
        // Flattened N x N matrix
        this.weights = new Float32Array(dimension * dimension);
        this.capacity = Math.floor(0.14 * dimension);
        this.reset();
    }

    reset() {
        this.weights.fill(0);
    }

    /**
     * "Learn" a pattern by sculpting the energy landscape.
     * Hebbian Learning: W += x * x^T
     * @param pattern Vector of length N (values roughly -1 to 1)
     */
    learn(pattern: number[]) {
        if (pattern.length !== this.dimension) {
            throw new Error(`Pattern dimension mismatch. Expected ${this.dimension}, got ${pattern.length}`);
        }

        // Zero-diagonal constraint (prevent self-excitation) is standard for discrete,
        // but for continuous we can sometimes relax it. We'll stick to standard Hebbian.
        for (let i = 0; i < this.dimension; i++) {
            for (let j = 0; j < this.dimension; j++) {
                if (i === j) {
                    this.weights[i * this.dimension + j] = 0;
                } else {
                    // W_ij += x_i * x_j
                    const update = pattern[i] * pattern[j];
                    // Normalization helps prevent saturation
                    this.weights[i * this.dimension + j] += update / this.dimension;
                }
            }
        }
    }

    /**
     * "Recall" or "Dream": Relax a noisy probe into a stored memory.
     * @param probe The noisy input vector
     * @param steps Number of relaxation steps (iterations)
     */
    async recall(probe: number[], steps: number = 5): Promise<{ state: number[], energyTrace: number[] }> {
        let state = [...probe];
        const energyTrace: number[] = [];
        const Beta = 10.0; // Inverse temperature (Higher = sharper/discrete, Lower = fuzzy/continuous)

        // Synchronous update
        for (let t = 0; t < steps; t++) {
            const nextState = new Array(this.dimension).fill(0);

            // Matrix-Vector Multiplication: W * state
            for (let i = 0; i < this.dimension; i++) {
                let sum = 0;
                for (let j = 0; j < this.dimension; j++) {
                    sum += this.weights[i * this.dimension + j] * state[j];
                }
                // Activation function with Temperature
                nextState[i] = Math.tanh(sum * Beta);
            }

            state = nextState;
            energyTrace.push(this.energy(state));
        }

        return { state, energyTrace };
    }

    /**
     * Calculate the "Energy" of a state.
     * E = -1/2 * x^T * W * x
     * Lower energy = "Better" memory match (Attractor Basin)
     */
    energy(state: number[]): number {
        let E = 0;
        for (let i = 0; i < this.dimension; i++) {
            for (let j = 0; j < this.dimension; j++) {
                E -= 0.5 * this.weights[i * this.dimension + j] * state[i] * state[j];
            }
        }
        return E;
    }

    /**
     * Utility: Inspect the holograph
     */
    getStats() {
        return {
            dimension: this.dimension,
            theoreticalCapacity: this.capacity,
            memoryUsageBytes: this.weights.byteLength
        };
    }
}
