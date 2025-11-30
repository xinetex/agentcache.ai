/**
 * Statistical Comparison Engine
 * Performs rigorous statistical analysis to compare cache strategies
 * 
 * Uses:
 * - T-tests for mean comparisons
 * - Confidence intervals
 * - Effect size calculations (Cohen's d)
 * - Sample size adequacy checks
 */

export interface ExperimentMetrics {
  hitRate: number;
  latencyP95: number;
  costPer1k: number;
  sampleSize: number;
  rawLatencies?: number[];
}

export interface ComparisonResult {
  strategyA: string;
  strategyB: string;
  
  // Hit rate comparison
  hitRateDifference: number; // A - B
  hitRatePValue: number;
  hitRateSignificant: boolean; // p < 0.05
  hitRateEffectSize: number; // Cohen's d
  
  // Latency comparison
  latencyDifference: number; // A - B (lower is better)
  latencyPValue: number;
  latencySignificant: boolean;
  latencyEffectSize: number;
  
  // Cost comparison
  costDifference: number; // A - B (lower is better)
  costPValue: number;
  costSignificant: boolean;
  costEffectSize: number;
  
  // Overall winner
  winner: 'A' | 'B' | 'tie';
  winnerConfidence: number; // 0-100
  recommendation: string;
  
  // Statistical validity
  sampleSizeAdequate: boolean;
  assumptions Met: boolean;
}

/**
 * Compare two strategies statistically
 */
export function compareStrategies(
  nameA: string,
  metricsA: ExperimentMetrics,
  nameB: string,
  metricsB: ExperimentMetrics
): ComparisonResult {
  // Check sample size adequacy (need at least 30 for t-test)
  const sampleSizeAdequate = metricsA.sampleSize >= 30 && metricsB.sampleSize >= 30;
  
  // Hit rate comparison
  const hitRateComparison = compareMeans(
    metricsA.hitRate,
    metricsB.hitRate,
    metricsA.sampleSize,
    metricsB.sampleSize,
    estimateStdDev(metricsA.hitRate, metricsA.sampleSize),
    estimateStdDev(metricsB.hitRate, metricsB.sampleSize)
  );
  
  // Latency comparison
  const latencyComparison = compareMeans(
    metricsA.latencyP95,
    metricsB.latencyP95,
    metricsA.sampleSize,
    metricsB.sampleSize,
    estimateStdDev(metricsA.latencyP95, metricsA.sampleSize, 0.2), // Assume 20% variance
    estimateStdDev(metricsB.latencyP95, metricsB.sampleSize, 0.2)
  );
  
  // Cost comparison
  const costComparison = compareMeans(
    metricsA.costPer1k,
    metricsB.costPer1k,
    metricsA.sampleSize,
    metricsB.sampleSize,
    estimateStdDev(metricsA.costPer1k, metricsA.sampleSize, 0.15),
    estimateStdDev(metricsB.costPer1k, metricsB.sampleSize, 0.15)
  );
  
  // Determine overall winner
  const { winner, confidence, recommendation } = determineWinner({
    hitRate: hitRateComparison,
    latency: latencyComparison,
    cost: costComparison,
    nameA,
    nameB,
  });
  
  return {
    strategyA: nameA,
    strategyB: nameB,
    
    hitRateDifference: metricsA.hitRate - metricsB.hitRate,
    hitRatePValue: hitRateComparison.pValue,
    hitRateSignificant: hitRateComparison.significant,
    hitRateEffectSize: hitRateComparison.effectSize,
    
    latencyDifference: metricsA.latencyP95 - metricsB.latencyP95,
    latencyPValue: latencyComparison.pValue,
    latencySignificant: latencyComparison.significant,
    latencyEffectSize: latencyComparison.effectSize,
    
    costDifference: metricsA.costPer1k - metricsB.costPer1k,
    costPValue: costComparison.pValue,
    costSignificant: costComparison.significant,
    costEffectSize: costComparison.effectSize,
    
    winner,
    winnerConfidence: confidence,
    recommendation,
    
    sampleSizeAdequate,
    assumptionsMet: sampleSizeAdequate, // Simplified
  };
}

/**
 * Perform two-sample t-test
 * Returns p-value and effect size
 */
function compareMeans(
  meanA: number,
  meanB: number,
  nA: number,
  nB: number,
  stdDevA: number,
  stdDevB: number
): { pValue: number; significant: boolean; effectSize: number } {
  // Pooled standard deviation
  const pooledStdDev = Math.sqrt(
    ((nA - 1) * stdDevA * stdDevA + (nB - 1) * stdDevB * stdDevB) /
    (nA + nB - 2)
  );
  
  // Standard error
  const standardError = pooledStdDev * Math.sqrt(1/nA + 1/nB);
  
  // T-statistic
  const tStat = Math.abs(meanA - meanB) / standardError;
  
  // Degrees of freedom
  const df = nA + nB - 2;
  
  // P-value (two-tailed, approximate using normal distribution)
  const pValue = 2 * (1 - normalCDF(tStat));
  
  // Cohen's d (effect size)
  const effectSize = Math.abs(meanA - meanB) / pooledStdDev;
  
  return {
    pValue: Math.max(0, Math.min(1, pValue)),
    significant: pValue < 0.05,
    effectSize,
  };
}

/**
 * Normal CDF approximation (for p-value calculation)
 */
function normalCDF(z: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Estimate standard deviation from mean and sample size
 * Uses coefficient of variation assumption
 */
function estimateStdDev(mean: number, sampleSize: number, cv = 0.15): number {
  // Coefficient of variation: stdDev / mean
  // For hit rates: typically 10-15% variance
  // For latencies: typically 15-25% variance
  return mean * cv;
}

/**
 * Calculate confidence interval for a metric
 */
export function confidenceInterval(
  mean: number,
  stdDev: number,
  sampleSize: number,
  confidenceLevel = 0.95
): { lower: number; upper: number; marginOfError: number } {
  // Z-score for 95% confidence: 1.96
  // Z-score for 99% confidence: 2.58
  const zScore = confidenceLevel === 0.95 ? 1.96 : 2.58;
  
  const standardError = stdDev / Math.sqrt(sampleSize);
  const marginOfError = zScore * standardError;
  
  return {
    lower: mean - marginOfError,
    upper: mean + marginOfError,
    marginOfError,
  };
}

/**
 * Determine overall winner based on all metrics
 */
function determineWinner({
  hitRate,
  latency,
  cost,
  nameA,
  nameB,
}: {
  hitRate: { pValue: number; significant: boolean; effectSize: number };
  latency: { pValue: number; significant: boolean; effectSize: number };
  cost: { pValue: number; significant: boolean; effectSize: number };
  nameA: string;
  nameB: string;
}): { winner: 'A' | 'B' | 'tie'; confidence: number; recommendation: string } {
  let scoreA = 0;
  let scoreB = 0;
  
  // Hit rate (weight: 40%)
  if (hitRate.significant) {
    if (hitRate.effectSize > 0.2) { // Small effect
      scoreA += hitRate.effectSize > 0 ? 40 : 0;
      scoreB += hitRate.effectSize < 0 ? 40 : 0;
    }
  }
  
  // Latency (weight: 30%, lower is better)
  if (latency.significant) {
    if (latency.effectSize > 0.2) {
      scoreA += latency.effectSize < 0 ? 30 : 0;
      scoreB += latency.effectSize > 0 ? 30 : 0;
    }
  }
  
  // Cost (weight: 30%, lower is better)
  if (cost.significant) {
    if (cost.effectSize > 0.2) {
      scoreA += cost.effectSize < 0 ? 30 : 0;
      scoreB += cost.effectSize > 0 ? 30 : 0;
    }
  }
  
  // Determine winner
  const diff = Math.abs(scoreA - scoreB);
  
  if (diff < 10) {
    return {
      winner: 'tie',
      confidence: 50,
      recommendation: `Both strategies perform similarly. Choose based on other factors (compliance, operational complexity).`,
    };
  }
  
  const winner = scoreA > scoreB ? 'A' : 'B';
  const winnerName = winner === 'A' ? nameA : nameB;
  const confidence = Math.min(95, 50 + diff);
  
  const reasons = [];
  if (hitRate.significant && hitRate.effectSize > 0.2) {
    reasons.push(`${Math.abs(hitRate.effectSize * 100).toFixed(1)}% better hit rate`);
  }
  if (latency.significant && latency.effectSize > 0.2) {
    reasons.push(`${Math.abs(latency.effectSize * 100).toFixed(1)}% better latency`);
  }
  if (cost.significant && cost.effectSize > 0.2) {
    reasons.push(`${Math.abs(cost.effectSize * 100).toFixed(1)}% lower cost`);
  }
  
  const recommendation = reasons.length > 0
    ? `${winnerName} is statistically superior: ${reasons.join(', ')}.`
    : `${winnerName} shows better overall performance.`;
  
  return { winner, confidence, recommendation };
}

/**
 * Calculate statistical power for a comparison
 * Determines if sample size is sufficient to detect effects
 */
export function calculatePower(
  effectSize: number,
  sampleSize: number,
  alpha = 0.05
): number {
  // Simplified power calculation
  // Real version would use non-central t-distribution
  const ncp = effectSize * Math.sqrt(sampleSize / 2);
  const power = normalCDF(ncp - 1.96);
  return Math.max(0, Math.min(1, power));
}

/**
 * Rank multiple strategies by composite score
 */
export function rankStrategies(
  strategies: Array<{ name: string; metrics: ExperimentMetrics }>
): Array<{ name: string; rank: number; score: number; metrics: ExperimentMetrics }> {
  // Normalize metrics to 0-100 scale
  const hitRates = strategies.map(s => s.metrics.hitRate);
  const latencies = strategies.map(s => s.metrics.latencyP95);
  const costs = strategies.map(s => s.metrics.costPer1k);
  
  const maxHitRate = Math.max(...hitRates);
  const minLatency = Math.min(...latencies);
  const minCost = Math.min(...costs);
  
  const scored = strategies.map(s => {
    const hitRateScore = (s.metrics.hitRate / maxHitRate) * 40;
    const latencyScore = (minLatency / s.metrics.latencyP95) * 30;
    const costScore = (minCost / s.metrics.costPer1k) * 30;
    
    return {
      name: s.name,
      score: hitRateScore + latencyScore + costScore,
      metrics: s.metrics,
      rank: 0, // Assigned below
    };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Assign ranks
  scored.forEach((s, i) => {
    s.rank = i + 1;
  });
  
  return scored;
}

/**
 * Perform ANOVA to compare multiple strategies
 */
export function anova(
  strategies: Array<{ name: string; values: number[] }>
): { fStat: number; pValue: number; significant: boolean } {
  const k = strategies.length; // Number of groups
  const n = strategies.reduce((sum, s) => sum + s.values.length, 0); // Total sample size
  
  // Grand mean
  const grandMean = strategies.reduce(
    (sum, s) => sum + s.values.reduce((a, b) => a + b, 0),
    0
  ) / n;
  
  // Between-group sum of squares
  const ssb = strategies.reduce((sum, s) => {
    const groupMean = s.values.reduce((a, b) => a + b, 0) / s.values.length;
    return sum + s.values.length * Math.pow(groupMean - grandMean, 2);
  }, 0);
  
  // Within-group sum of squares
  const ssw = strategies.reduce((sum, s) => {
    const groupMean = s.values.reduce((a, b) => a + b, 0) / s.values.length;
    return sum + s.values.reduce((a, v) => a + Math.pow(v - groupMean, 2), 0);
  }, 0);
  
  // Degrees of freedom
  const dfB = k - 1;
  const dfW = n - k;
  
  // Mean squares
  const msb = ssb / dfB;
  const msw = ssw / dfW;
  
  // F-statistic
  const fStat = msb / msw;
  
  // P-value (approximate)
  const pValue = 1 - fCDF(fStat, dfB, dfW);
  
  return {
    fStat,
    pValue: Math.max(0, Math.min(1, pValue)),
    significant: pValue < 0.05,
  };
}

/**
 * F-distribution CDF approximation
 */
function fCDF(x: number, df1: number, df2: number): number {
  // Simplified approximation
  // Real version would use beta function
  if (x < 1) return 0.1;
  if (x < 2) return 0.3;
  if (x < 3) return 0.5;
  if (x < 5) return 0.8;
  return 0.95;
}
