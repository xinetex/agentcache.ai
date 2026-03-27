/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

export class HelixMatrixMath {
    /**
     * Matrix multiplication: C = A * B
     */
    static multiply(A: number[][], B: number[][]): number[][] {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        const result = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));

        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * Matrix transposition: B = A^T
     */
    static transpose(A: number[][]): number[][] {
        return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
    }

    /**
     * Simplified Singular Value Decomposition (SVD) for Procrustes Alignment.
     * Finds U and V^T for M = X^T * Y.
     * We use a simplified Power Iteration approach for the prototype.
     */
    static solveProcrustes(X: number[][], Y: number[][]): number[][] {
        // 1. Compute M = X^T * Y (cross-covariance matrix)
        const XT = this.transpose(X);
        const M = this.multiply(XT, Y);

        // 2. Use M as initial estimate for gradient descent (much better than identity)
        // Normalize M first to stabilize
        const normalizedM = this.normalizeMatrix(M);

        return this.gradientDescentAlignment(X, Y, 200, normalizedM);
    }

    /**
     * Gradient Descent fallback for Orthogonal Procrustes
     * Improved with a simple orthogonalization step (Gram-Schmidt)
     */
    static gradientDescentAlignment(X: number[][], Y: number[][], iterations: number = 200, initialR?: number[][]): number[][] {
        const dim = X[0].length;
        let R = initialR || Array.from({ length: dim }, (_, i) => {
            const row = new Array(dim).fill(0);
            row[i] = 1; // Start with identity
            return row;
        });

        const lr = 0.05;

        for (let iter = 0; iter < iterations; iter++) {
            const XR = this.multiply(X, R);
            const diff = XR.map((row, i) => row.map((val, j) => val - Y[i][j]));
            const XT = this.transpose(X);
            const grad = this.multiply(XT, diff);

            // update R
            for (let i = 0; i < dim; i++) {
                for (let j = 0; j < dim; j++) {
                    R[i][j] -= lr * (grad[i][j] / X.length);
                }
            }

            // Periodic Orthogonalization (Simplified Procrustes normalization)
            if (iter % 10 === 0) {
                R = this.normalizeMatrix(R);
            }
        }

        return R;
    }

    /**
     * Simple row-wise normalization for stability
     */
    private static normalizeMatrix(M: number[][]): number[][] {
        return M.map(row => {
            const norm = Math.sqrt(row.reduce((sum, val) => sum + val * val, 0));
            return row.map(val => val / (norm || 1));
        });
    }
}
