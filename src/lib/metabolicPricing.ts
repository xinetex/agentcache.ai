/**
 * Metabolic Pricing Utility
 * 
 * Calculates "metabolic cost" of an operation based on:
 * 1. Base cost (SKU-specific)
 * 2. Evidence overhead (browser/storage proof cost)
 * 3. Trust-weighted adjustments (premium for higher confidence)
 * 4. Resource efficiency (discounts for low-latency, low-retry runs)
 */

export interface MetabolicPricingFactors {
    basePriceMicros: number;
    latencyMs: number;
    retries?: number;
    evidenceDensity: number; // 0 to 1
    confidence: number; // 0 to 1
    isBrowserBacked?: boolean;
}

export function calculateMetabolicPrice(factors: MetabolicPricingFactors): number {
    const { basePriceMicros, latencyMs, retries = 0, evidenceDensity, confidence, isBrowserBacked } = factors;

    // 1. Efficiency Tax - higher latency/retries increase "metabolic" drag
    const efficiencyDrag = 1 + (latencyMs / 1000) * 0.1 + (retries * 0.2);

    // 2. Proof Premium - browser-backed proofs are more expensive but more valuable
    const proofPremium = isBrowserBacked ? 1.5 : 1.0;

    // 3. Integrity Weight - higher confidence and evidence density increase the price
    // (since they provide more trust value to the buyer)
    const integrityWeight = 0.5 + (confidence * 0.3) + (evidenceDensity * 0.2);

    // Final calculation
    const metabolicPrice = basePriceMicros * efficiencyDrag * proofPremium * integrityWeight;

    return Math.round(metabolicPrice);
}

export function formatMicros(micros: number): string {
    return (micros / 1000000).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
    });
}
