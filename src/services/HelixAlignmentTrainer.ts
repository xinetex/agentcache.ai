/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { HelixMatrixMath } from './HelixMatrixMath.js';
import { alignmentMapService, AlignmentMap } from './AlignmentMapService.js';

export class HelixAlignmentTrainer {
    /**
     * Train an alignment map between source and target embedding sets.
     * sourceVectors: N x D1
     * targetVectors: N x D2
     */
    async train(sourceModel: string, targetModel: string, sourceVectors: number[][], targetVectors: number[][]): Promise<AlignmentMap> {
        console.log(`[HelixTrainer] 🏋️ Training alignment for ${sourceModel} -> ${targetModel} (${sourceVectors.length} samples)`);

        if (sourceVectors.length !== targetVectors.length) {
            throw new Error("Source and target vector counts must match.");
        }

        // Align manifolds
        const matrix = HelixMatrixMath.solveProcrustes(sourceVectors, targetVectors);

        const map: AlignmentMap = {
            sourceModel,
            targetModel,
            matrix
        };

        // Persist
        await alignmentMapService.storeMap(map);
        console.log(`[HelixTrainer] ✅ Alignment matrix generated and stored.`);

        return map;
    }
}

export const helixAlignmentTrainer = new HelixAlignmentTrainer();
