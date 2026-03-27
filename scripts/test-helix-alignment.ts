/**
 * HELIX Alignment Design Verification Script
 * 
 * Tests that we can recover a linear transformation between two model
 * embedding spaces using the Procrustes alignment trainer.
 * 
 * This test uses a PURE LINEAR transform (no bias/offset) because
 * Procrustes solves for orthogonal/linear maps, not affine transforms.
 */

import { HelixAlignmentTrainer } from '../src/services/HelixAlignmentTrainer.js';
import { HelixEngine } from '../src/services/HelixEngine.js';
import { HelixMatrixMath } from '../src/services/HelixMatrixMath.js';

async function runTest() {
    const trainer = new HelixAlignmentTrainer();
    const dim = 8; // Small dimension for tractable gradient descent
    const samples = 50;

    // 1. Create a known linear transformation matrix (the "ground truth" alignment)
    // This is a simple permutation + scaling — something Procrustes CAN recover.
    const trueMatrix: number[][] = Array.from({ length: dim }, (_, i) => {
        const row = new Array(dim).fill(0);
        // Permute: shift indices by 1 with wrap-around, and scale by 0.8
        row[(i + 1) % dim] = 0.8;
        return row;
    });

    // 2. Generate random "Model A" vectors
    const modelA = Array.from({ length: samples }, () =>
        Array.from({ length: dim }, () => (Math.random() * 2 - 1) * 0.5)
    );

    // 3. Compute "Model B" = Model A * trueMatrix (deterministic linear transform)
    const modelB = HelixMatrixMath.multiply(modelA, trueMatrix);

    console.log("[Test] 🏃 Starting Helix Alignment Training...");
    console.log(`[Test] Dimensions: ${dim}, Samples: ${samples}`);

    const map = await trainer.train("Model-A", "Model-B", modelA, modelB);

    // 4. Verify on HELD-OUT test vectors (not used during training)
    let passed = 0;
    const testCount = 10;
    let totalSimilarity = 0;

    for (let t = 0; t < testCount; t++) {
        const testVectorA = Array.from({ length: dim }, () => (Math.random() * 2 - 1) * 0.5);
        
        // Ground truth: what Model B SHOULD produce
        const expectedB: number[] = new Array(dim).fill(0);
        for (let j = 0; j < dim; j++) {
            for (let k = 0; k < dim; k++) {
                expectedB[j] += testVectorA[k] * trueMatrix[k][j];
            }
        }

        // Our alignment: what our trained matrix produces
        const alignedB = HelixEngine.transform(testVectorA, map.matrix);

        // Measure cosine similarity
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < dim; i++) {
            dot += expectedB[i] * alignedB[i];
            normA += expectedB[i] * expectedB[i];
            normB += alignedB[i] * alignedB[i];
        }
        const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
        totalSimilarity += similarity;

        if (similarity > 0.90) passed++;
    }

    const avgSimilarity = totalSimilarity / testCount;
    console.log(`[Test] Average cosine similarity: ${avgSimilarity.toFixed(4)}`);
    console.log(`[Test] Passed: ${passed}/${testCount} vectors above 0.90 threshold`);

    if (passed >= 7) {
        console.log("[Test] ✅ HELIX SUCCESS: Alignment matrix recovered with sufficient accuracy.");
    } else {
        console.warn("[Test] ❌ HELIX PARTIAL: Alignment needs more iterations or better initialization.");
    }
}

runTest().catch(console.error);
