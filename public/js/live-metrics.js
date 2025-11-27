/**
 * Live Metrics Tracking and Visualization for AgentCache Studio
 */

class LiveMetricsTracker {
  constructor(dataFetcher) {
    this.fetcher = dataFetcher;
    this.history = [];
    this.startTime = Date.now();
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot() {
    const metrics = this.fetcher.getMetrics();
    const sessionDuration = Math.floor((Date.now() - this.startTime) / 1000);
    
    return {
      ...metrics,
      sessionDuration,
      avgLatencyHit: this.calculateAvgLatency(true),
      avgLatencyMiss: this.calculateAvgLatency(false),
      requestsPerMinute: this.calculateRPM(),
      projectedMonthlyCost: this.projectMonthlyCost(metrics),
      timestamp: Date.now()
    };
  }

  /**
   * Record API call result
   */
  recordCall(result) {
    this.history.push({
      timestamp: Date.now(),
      hit: result.hit,
      latency: result.latency,
      cost: result.cost,
      source: result.source
    });

    // Keep only last 100 calls
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Calculate average latency
   */
  calculateAvgLatency(isHit) {
    const filtered = this.history.filter(h => h.hit === isHit);
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, h) => acc + h.latency, 0);
    return Math.round(sum / filtered.length);
  }

  /**
   * Calculate requests per minute
   */
  calculateRPM() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentCalls = this.history.filter(h => h.timestamp > oneMinuteAgo);
    return recentCalls.length;
  }

  /**
   * Project monthly cost
   */
  projectMonthlyCost(metrics) {
    if (metrics.totalCalls === 0) return { without: 0, with: 0, savings: 0 };
    
    const avgCostPerCall = metrics.totalCost / metrics.cacheMisses || 0.002;
    const callsPerDay = metrics.totalCalls; // Assume current rate continues
    const callsPerMonth = callsPerDay * 30;
    
    const withoutCache = callsPerMonth * avgCostPerCall;
    const withCache = (callsPerMonth * (1 - metrics.hitRate / 100)) * avgCostPerCall;
    
    return {
      without: withoutCache,
      with: withCache,
      savings: withoutCache - withCache
    };
  }

  /**
   * Get latency chart data
   */
  getLatencyChartData() {
    return this.history.map((h, i) => ({
      index: i + 1,
      latency: h.latency,
      hit: h.hit
    }));
  }

  /**
   * Get cost timeline data
   */
  getCostTimelineData() {
    let cumulativeCost = 0;
    let cumulativeSaved = 0;
    
    return this.history.map((h, i) => {
      if (h.hit) {
        cumulativeSaved += 0.002; // Assumed cost per call
      } else {
        cumulativeCost += h.cost;
      }
      
      return {
        index: i + 1,
        cost: cumulativeCost,
        saved: cumulativeSaved
      };
    });
  }

  /**
   * Reset metrics
   */
  reset() {
    this.history = [];
    this.startTime = Date.now();
  }
}

/**
 * Session Report Generator
 */
class SessionReport {
  constructor(dataFetcher, metricsTracker) {
    this.fetcher = dataFetcher;
    this.metrics = metricsTracker;
    this.dataSourcesTested = new Set();
    this.scenariosRun = [];
  }

  /**
   * Record data source test
   */
  recordDataSourceTest(sourceId) {
    this.dataSourcesTested.add(sourceId);
  }

  /**
   * Record scenario run
   */
  recordScenarioRun(scenarioId, results) {
    this.scenariosRun.push({
      id: scenarioId,
      timestamp: Date.now(),
      results
    });
  }

  /**
   * Generate session report
   */
  generateReport() {
    const snapshot = this.metrics.getSnapshot();
    const sessionMinutes = Math.floor(snapshot.sessionDuration / 60);
    
    return {
      summary: {
        dataSourcesTested: this.dataSourcesTested.size,
        scenariosRun: this.scenariosRun.length,
        totalCalls: snapshot.totalCalls,
        sessionDuration: `${sessionMinutes}m ${snapshot.sessionDuration % 60}s`,
        timestamp: new Date().toISOString()
      },
      performance: {
        cacheHitRate: `${snapshot.hitRate}%`,
        avgLatencyHit: `${snapshot.avgLatencyHit}ms`,
        avgLatencyMiss: `${snapshot.avgLatencyMiss}ms`,
        latencyImprovement: snapshot.avgLatencyMiss > 0 
          ? `${Math.round((1 - snapshot.avgLatencyHit / snapshot.avgLatencyMiss) * 100)}%`
          : 'N/A'
      },
      cost: {
        totalSpent: `$${snapshot.totalCost.toFixed(4)}`,
        totalSaved: `$${snapshot.totalSaved.toFixed(4)}`,
        projectedMonthlyWithout: `$${snapshot.projectedMonthlyCost.without.toFixed(2)}`,
        projectedMonthlyWith: `$${snapshot.projectedMonthlyCost.with.toFixed(2)}`,
        projectedMonthlySavings: `$${snapshot.projectedMonthlyCost.savings.toFixed(2)}`
      },
      details: {
        dataSourcesTested: Array.from(this.dataSourcesTested),
        scenariosRun: this.scenariosRun.map(s => s.id),
        callBreakdown: {
          hits: snapshot.cacheHits,
          misses: snapshot.cacheMisses
        }
      }
    };
  }

  /**
   * Get report as markdown
   */
  getMarkdownReport() {
    const report = this.generateReport();
    
    return `# AgentCache Demo Session Report

## Summary
- **Data Sources Tested**: ${report.summary.dataSourcesTested}
- **Scenarios Run**: ${report.summary.scenariosRun}
- **Total API Calls**: ${report.summary.totalCalls}
- **Session Duration**: ${report.summary.sessionDuration}

## Performance
- **Cache Hit Rate**: ${report.performance.cacheHitRate}
- **Avg Latency (Hit)**: ${report.performance.avgLatencyHit}
- **Avg Latency (Miss)**: ${report.performance.avgLatencyMiss}
- **Latency Improvement**: ${report.performance.latencyImprovement}

## Cost Analysis
- **Total Spent**: ${report.cost.totalSpent}
- **Total Saved**: ${report.cost.totalSaved}
- **Projected Monthly (Without Cache)**: ${report.cost.projectedMonthlyWithout}
- **Projected Monthly (With Cache)**: ${report.cost.projectedMonthlyWith}
- **Projected Monthly Savings**: ${report.cost.projectedMonthlySavings}

---
*Ready to deploy to production? Sign up for free at agentcache.ai*
`;
  }

  /**
   * Get report as HTML
   */
  getHTMLReport() {
    const report = this.generateReport();
    
    return `
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-bold text-white mb-4">📊 Demo Session Summary</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="glass p-4 rounded-lg">
              <div class="text-slate-400 text-sm">Data Sources Tested</div>
              <div class="text-2xl font-bold text-white">${report.summary.dataSourcesTested}</div>
            </div>
            <div class="glass p-4 rounded-lg">
              <div class="text-slate-400 text-sm">Scenarios Run</div>
              <div class="text-2xl font-bold text-white">${report.summary.scenariosRun}</div>
            </div>
            <div class="glass p-4 rounded-lg">
              <div class="text-slate-400 text-sm">Total API Calls</div>
              <div class="text-2xl font-bold text-white">${report.summary.totalCalls}</div>
            </div>
            <div class="glass p-4 rounded-lg">
              <div class="text-slate-400 text-sm">Cache Hit Rate</div>
              <div class="text-2xl font-bold text-emerald-400">${report.performance.cacheHitRate}</div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-xl font-bold text-white mb-4">⚡ Performance</h3>
          <div class="glass p-6 rounded-lg space-y-3">
            <div class="flex justify-between">
              <span class="text-slate-400">Avg Latency (Cache Hit)</span>
              <span class="text-emerald-400 font-semibold">${report.performance.avgLatencyHit}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Avg Latency (Cache Miss)</span>
              <span class="text-amber-400 font-semibold">${report.performance.avgLatencyMiss}</span>
            </div>
            <div class="flex justify-between border-t border-slate-700 pt-3">
              <span class="text-white font-semibold">Latency Improvement</span>
              <span class="text-emerald-400 font-bold text-lg">${report.performance.latencyImprovement}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-xl font-bold text-white mb-4">💰 Cost Savings</h3>
          <div class="glass p-6 rounded-lg space-y-3">
            <div class="flex justify-between">
              <span class="text-slate-400">Total Saved (This Session)</span>
              <span class="text-emerald-400 font-bold">${report.cost.totalSaved}</span>
            </div>
            <div class="flex justify-between border-t border-slate-700 pt-3">
              <span class="text-slate-400">Projected Monthly (Without Cache)</span>
              <span class="text-rose-400">${report.cost.projectedMonthlyWithout}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Projected Monthly (With Cache)</span>
              <span class="text-emerald-400">${report.cost.projectedMonthlyWith}</span>
            </div>
            <div class="flex justify-between border-t border-slate-700 pt-3">
              <span class="text-white font-bold">Monthly Savings</span>
              <span class="text-emerald-400 font-bold text-xl">${report.cost.projectedMonthlySavings}</span>
            </div>
          </div>
        </div>

        <div class="glass p-6 rounded-lg bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border-emerald-500/20">
          <div class="text-center">
            <p class="text-lg text-white font-semibold mb-2">Ready to deploy to production?</p>
            <p class="text-slate-400 text-sm mb-4">Sign up free and save ${report.cost.projectedMonthlySavings}/month</p>
            <a href="/signup.html" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-sky-600 rounded-lg font-semibold text-white hover:from-emerald-500 hover:to-sky-500 transition-all">
              Sign Up Free
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Reset report
   */
  reset() {
    this.dataSourcesTested.clear();
    this.scenariosRun = [];
  }
}

// Export for use in Studio
if (typeof window !== 'undefined') {
  window.LiveMetricsTracker = LiveMetricsTracker;
  window.SessionReport = SessionReport;
}
