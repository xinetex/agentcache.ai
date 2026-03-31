import { describe, it, expect } from 'vitest';
import { TurboQuantService } from '../../src/services/TurboQuantService.js';

describe('TurboQuantService (ACTQ)', () => {
    it('should preserve energy after FWHT', () => {
        const n = 1024;
        const original = new Float32Array(n);
        for (let i = 0; i < n; i++) original[i] = Math.random();

        const transformed = new Float32Array(original);
        TurboQuantService.fwht(transformed);

        let sumOrig = 0;
        let sumTrans = 0;
        for (let i = 0; i < n; i++) {
            sumOrig += original[i] * original[i];
            sumTrans += transformed[i] * transformed[i];
        }

        // Parseval's theorem: energy should be preserved
        expect(sumTrans).toBeCloseTo(sumOrig, 2);
    });

    it('should compress and decompress with high fidelity', () => {
        // Create a fake 1536-dim embedding (unit-norm)
        const d = 1536;
        const original = new Array(d).fill(0).map(() => (Math.random() - 0.5) * 2);
        const norm = Math.sqrt(original.reduce((acc, v) => acc + v * v, 0));
        const unitVec = original.map(v => v / norm);

        const compressed = TurboQuantService.compress(unitVec);
        const reconstructed = TurboQuantService.decompress(compressed);

        expect(reconstructed.length).toBe(d);

        const similarity = TurboQuantService.cosineSimilarity(unitVec, reconstructed);
        console.log(`[ACTQ] Cosine Similarity: ${similarity.toFixed(4)}`);
        
        // Threshold for 3-bit quantization is typically > 0.98 for high-dim vectors
        expect(similarity).toBeGreaterThan(0.95);
    });

    it('should achieve significant compression ratio', () => {
        const d = 1536;
        const original = new Array(d).fill(0).map(() => Math.random());
        const compressed = TurboQuantService.compress(original);

        const originalBytes = d * 4; // 32-bit float
        const compressedBytes = compressed.length;
        const ratio = originalBytes / compressedBytes;

        console.log(`[ACTQ] Original size: ${originalBytes} bytes`);
        console.log(`[ACTQ] Compressed size: ${compressedBytes} bytes`);
        console.log(`[ACTQ] Ratio: ${ratio.toFixed(2)}x`);

        // 1536 * 3 bits = 4608 bits = 576 bytes. Header is 12 bytes. 
        // 2048 (padded) * 3 bits = 6144 bits = 768 bytes.
        // Total should be around 780 bytes.
        // 6144 / 780 = ~7.8x relative to 32-bit.
        expect(ratio).toBeGreaterThan(6);
    });
});
