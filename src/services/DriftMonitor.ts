/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Sector } from './ChaosRecoveryEngine.js';
import { observabilityService } from './ObservabilityService.js';

export interface LatentAnchor {
    id: string;
    sector: Sector;
    version: string;
    embedding: number[];      // The "Canonical" latent vector
    description: string;       // Human-readable exemplar
}

/**
 * DriftMonitor
 * 
 * Implements Phase 14 "Latent Anchor Layer".
 * It pins the swarm's semantic coherence by comparing current agent outputs
 * against versioned "Anchor Beliefs." If the drift (cosine distance) exceeds
 * a threshold, it triggers adaptive anchoring (re-prompting with anchors).
 */
export class DriftMonitor {
    private anchors = new Map<Sector, LatentAnchor[]>();

    /**
     * Register a canonical anchor for a sector.
     */
    registerAnchor(anchor: LatentAnchor) {
        let sectorAnchors = this.anchors.get(anchor.sector);
        if (!sectorAnchors) {
            sectorAnchors = [];
            this.anchors.set(anchor.sector, sectorAnchors);
        }
        sectorAnchors.push(anchor);
    }

    /**
     * Measure the drift of a signal against the sector's anchors.
     * Higher score (0.0 - 1.0) means higher drift.
     */
    async measureDrift(sector: Sector, signalVector: number[]): Promise<number> {
        const sectorAnchors = this.anchors.get(sector);
        if (!sectorAnchors || sectorAnchors.length === 0) return 0;

        // Calculate maximum similarity to any anchor
        let maxSimilarity = 0;
        for (const anchor of sectorAnchors) {
            const similarity = this.cosineSimilarity(signalVector, anchor.embedding);
            if (similarity > maxSimilarity) maxSimilarity = similarity;
        }

        // Drift = 1.0 - best_similarity
        const drift = Math.max(0, 1.0 - maxSimilarity);

        if (drift > 0.3) {
            await observabilityService.track({
                type: 'SEMANTIC_DRIFT' as any,
                description: `High Semantic Drift detected in ${sector}: ${drift.toFixed(2)}`,
                metadata: { sector, drift }
            });
        }

        return drift;
    }

    async initializeDefaultAnchors(generateFn: (text: string) => Promise<number[]>) {
        // Finance Anchor: High Precision Instrument Trading
        this.registerAnchor({
            id: 'finance-anchor-1',
            sector: 'finance',
            version: '1.0.0',
            embedding: await generateFn('Execute buy order for 100 shares of AAPL at 150.00 on NASDAQ.'),
            description: 'Canonical Finance Trade'
        });

        // Legal Anchor: Contractual Compliance
        this.registerAnchor({
            id: 'legal-anchor-1',
            sector: 'legal',
            version: '1.0.0',
            embedding: await generateFn('This agreement is governed by the laws of the State of Delaware.'),
            description: 'Canonical Legal Clause'
        });

        // Healthcare Anchor: Patient Privacy & Diagnosis
        this.registerAnchor({
            id: 'healthcare-anchor-1',
            sector: 'healthcare',
            version: '1.0.0',
            embedding: await generateFn('Patient records must be stored behind HIPAA-compliant encrypted volumes.'),
            description: 'Canonical Healthcare Policy'
        });

        // Robotics Anchor: Motion Planning & Safety
        this.registerAnchor({
            id: 'robotics-anchor-1',
            sector: 'robotics',
            version: '1.0.0',
            embedding: await generateFn('Inverse kinematics solution found within 5ms for the 6-DOF manipulator.'),
            description: 'Canonical Robotics Kinematics'
        });

        // Biotech Anchor: Protein Folding & Synthesis
        this.registerAnchor({
            id: 'biotech-anchor-1',
            sector: 'biotech',
            version: '1.0.0',
            embedding: await generateFn('Simulate peptide binding affinity for the target protease receptor.'),
            description: 'Canonical Biotech Protein Binding'
        });

        // Energy Anchor: Grid Stability & Distribution
        this.registerAnchor({
            id: 'energy-anchor-1',
            sector: 'energy',
            version: '1.0.0',
            embedding: await generateFn('Sustain grid frequency at 60Hz during peak photovoltaic surge.'),
            description: 'Canonical Energy Grid Ops'
        });
        
        console.log(`[DriftMonitor] ⚓ Latent Anchor Layer Initialized with ${this.anchors.size} sectors.`);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        const denominator = Math.sqrt(magA) * Math.sqrt(magB);
        return denominator === 0 ? 0 : dot / denominator;
    }
}

export const driftMonitor = new DriftMonitor();
