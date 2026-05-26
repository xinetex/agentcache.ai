/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

/**
 * CayleyTransform: Classical implementation of Cayley-parameterized unitary adapters.
 *
 * Based on: "Quantum-enhanced Large Language Models on Quantum Hardware via
 * Cayley Unitary Adapters" (Aizpurua et al., 2026, arXiv:2605.05914)
 *
 * The Cayley transform maps a skew-symmetric matrix K to an orthogonal matrix Q:
 *
 *   Q = (I - K/2)(I + K/2)^{-1}
 *
 * where K = -K^T is skew-symmetric with n(n-1)/2 free parameters.
 *
 * This is a CLASSICAL implementation — the same math that runs on IBM's QPU,
 * executed on standard hardware. The advantage is extreme parameter efficiency:
 * a 4×4 orthogonal block needs only 6 free parameters (62.5% reduction vs dense).
 *
 * For AgentCache: Each sector ontology adapter is a block-diagonal unitary (BDU)
 * composed of independent 4×4 Cayley blocks. A d=576 adapter (SmolLM2-scale)
 * requires only 864 trainable parameters total.
 */

/**
 * Flat array representation of a matrix (row-major).
 */
export type FlatMatrix = Float64Array;

/**
 * Create an identity matrix of size n×n as a flat array.
 */
export function identity(n: number): FlatMatrix {
    const m = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        m[i * n + i] = 1.0;
    }
    return m;
}

/**
 * Build a skew-symmetric matrix K from its upper-triangular free parameters.
 *
 * For an n×n skew-symmetric matrix, there are n(n-1)/2 free parameters.
 * K[i][j] = params[idx], K[j][i] = -params[idx] for i < j.
 *
 * @param n Matrix dimension
 * @param params Upper-triangular parameters (length must be n*(n-1)/2)
 */
export function buildSkewSymmetric(n: number, params: number[]): FlatMatrix {
    const expectedLen = (n * (n - 1)) / 2;
    if (params.length !== expectedLen) {
        throw new Error(`Expected ${expectedLen} parameters for ${n}×${n} skew-symmetric matrix, got ${params.length}`);
    }

    const K = new Float64Array(n * n);
    let idx = 0;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            K[i * n + j] = params[idx];
            K[j * n + i] = -params[idx];
            idx++;
        }
    }

    return K;
}

/**
 * Matrix multiplication C = A × B for n×n flat matrices.
 */
export function matmul(A: FlatMatrix, B: FlatMatrix, n: number): FlatMatrix {
    const C = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += A[i * n + k] * B[k * n + j];
            }
            C[i * n + j] = sum;
        }
    }
    return C;
}

/**
 * Matrix-vector multiplication y = A × x for n×n flat matrix and n-vector.
 */
export function matvec(A: FlatMatrix, x: number[], n: number): number[] {
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            y[i] += A[i * n + j] * x[j];
        }
    }
    return y;
}

/**
 * Invert a small n×n matrix using Gauss-Jordan elimination.
 * For n=4 (our primary use case), this is fast and numerically stable.
 */
export function invert(M: FlatMatrix, n: number): FlatMatrix {
    // Augmented matrix [M | I]
    const aug = new Float64Array(n * 2 * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            aug[i * 2 * n + j] = M[i * n + j];
        }
        aug[i * 2 * n + n + i] = 1.0;
    }

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
        // Find pivot
        let maxVal = Math.abs(aug[col * 2 * n + col]);
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            const val = Math.abs(aug[row * 2 * n + col]);
            if (val > maxVal) {
                maxVal = val;
                maxRow = row;
            }
        }

        if (maxVal < 1e-12) {
            throw new Error('Matrix is singular or near-singular');
        }

        // Swap rows
        if (maxRow !== col) {
            for (let j = 0; j < 2 * n; j++) {
                const tmp = aug[col * 2 * n + j];
                aug[col * 2 * n + j] = aug[maxRow * 2 * n + j];
                aug[maxRow * 2 * n + j] = tmp;
            }
        }

        // Scale pivot row
        const pivot = aug[col * 2 * n + col];
        for (let j = 0; j < 2 * n; j++) {
            aug[col * 2 * n + j] /= pivot;
        }

        // Eliminate column
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = aug[row * 2 * n + col];
            for (let j = 0; j < 2 * n; j++) {
                aug[row * 2 * n + j] -= factor * aug[col * 2 * n + j];
            }
        }
    }

    // Extract inverse
    const inv = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            inv[i * n + j] = aug[i * 2 * n + n + j];
        }
    }
    return inv;
}

/**
 * Compute the Cayley transform of a skew-symmetric matrix K:
 *
 *   Q = (I - K/2)(I + K/2)^{-1}
 *
 * Result is an orthogonal matrix (Q^T Q = I).
 *
 * @param n Block dimension (e.g., 4 for 2-qubit equivalent)
 * @param params Upper-triangular free parameters (length n*(n-1)/2)
 * @returns Orthogonal matrix Q as flat array
 */
export function cayleyTransform(n: number, params: number[]): FlatMatrix {
    const K = buildSkewSymmetric(n, params);
    const I = identity(n);

    // I - K/2
    const ImK = new Float64Array(n * n);
    for (let i = 0; i < n * n; i++) {
        ImK[i] = I[i] - K[i] / 2;
    }

    // I + K/2
    const IpK = new Float64Array(n * n);
    for (let i = 0; i < n * n; i++) {
        IpK[i] = I[i] + K[i] / 2;
    }

    // Q = (I - K/2)(I + K/2)^{-1}
    const IpKinv = invert(IpK, n);
    return matmul(ImK, IpKinv, n);
}

/**
 * Build a block-diagonal unitary (BDU) from multiple Cayley blocks.
 *
 * Given dimension d and block size b, creates d/b independent orthogonal blocks,
 * each parameterized by b*(b-1)/2 free parameters.
 *
 * @param d Total adapter dimension (must be divisible by blockSize)
 * @param blockSize Size of each Cayley block (default 4 = 2-qubit equivalent)
 * @param allParams All free parameters concatenated (length = numBlocks * paramsPerBlock)
 * @returns Block-diagonal orthogonal matrix as flat array
 */
export function blockDiagonalUnitary(
    d: number,
    blockSize: number,
    allParams: number[]
): FlatMatrix {
    if (d % blockSize !== 0) {
        throw new Error(`Dimension ${d} must be divisible by block size ${blockSize}`);
    }

    const numBlocks = d / blockSize;
    const paramsPerBlock = (blockSize * (blockSize - 1)) / 2;
    const expectedParams = numBlocks * paramsPerBlock;

    if (allParams.length !== expectedParams) {
        throw new Error(`Expected ${expectedParams} total parameters (${numBlocks} blocks × ${paramsPerBlock}), got ${allParams.length}`);
    }

    // Build the full block-diagonal matrix
    const BDU = new Float64Array(d * d); // initialized to 0

    for (let b = 0; b < numBlocks; b++) {
        const blockParams = allParams.slice(b * paramsPerBlock, (b + 1) * paramsPerBlock);
        const Q = cayleyTransform(blockSize, blockParams);

        // Place block on the diagonal
        const offset = b * blockSize;
        for (let i = 0; i < blockSize; i++) {
            for (let j = 0; j < blockSize; j++) {
                BDU[(offset + i) * d + (offset + j)] = Q[i * blockSize + j];
            }
        }
    }

    return BDU;
}

/**
 * Apply a BDU adapter to a vector (forward pass).
 *
 * This is the hot path during inference — transforms the LLM's projection
 * layer output through the Cayley adapter.
 *
 * Optimized: instead of building the full d×d matrix, applies each block
 * independently to its slice of the input vector. O(d × blockSize) instead of O(d²).
 *
 * @param input Input vector of dimension d
 * @param d Total dimension
 * @param blockSize Cayley block size
 * @param allParams Adapter parameters
 * @returns Transformed vector
 */
export function applyAdapter(
    input: number[],
    d: number,
    blockSize: number,
    allParams: number[]
): number[] {
    const numBlocks = d / blockSize;
    const paramsPerBlock = (blockSize * (blockSize - 1)) / 2;
    const output = new Array(d);

    for (let b = 0; b < numBlocks; b++) {
        const blockParams = allParams.slice(b * paramsPerBlock, (b + 1) * paramsPerBlock);
        const Q = cayleyTransform(blockSize, blockParams);

        const offset = b * blockSize;
        const slice = input.slice(offset, offset + blockSize);
        const transformed = matvec(Q, slice, blockSize);

        for (let i = 0; i < blockSize; i++) {
            output[offset + i] = transformed[i];
        }
    }

    return output;
}

/**
 * Get adapter metadata for a given configuration.
 */
export function getAdapterStats(d: number, blockSize: number = 4) {
    const numBlocks = d / blockSize;
    const paramsPerBlock = (blockSize * (blockSize - 1)) / 2;
    const totalParams = numBlocks * paramsPerBlock;
    const denseParams = d * d;
    const compressionRatio = 1 - totalParams / denseParams;

    return {
        dimension: d,
        blockSize,
        numBlocks,
        paramsPerBlock,
        totalParams,
        denseParams,
        compressionRatio: Number(compressionRatio.toFixed(6)),
        equivalentQubits: Math.log2(blockSize),
    };
}
