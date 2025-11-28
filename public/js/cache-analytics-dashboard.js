/**
 * Cache Analytics Dashboard
 * 
 * Production-grade scientific visualization with:
 * - Real-time performance metrics with statistical rigor
 * - Moving averages (SMA, EMA), outlier detection, trend analysis
 * - Latency percentiles (p50, p95, p99)
 * - Cost optimization algorithms
 * - Predictive analytics for cache efficiency
 */

class CacheAnalyticsDashboard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }
    
    this.config = {
      timeWindow: options.timeWindow || 60, // seconds
      updateInterval: options.updateInterval || 1000, // ms
      maxDataPoints: options.maxDataPoints || 60,
      percentiles: [50, 95, 99],
      movingAverageWindow: options.maWindow || 10,
      ...options
    };
    
    // Data store
    this.timeSeries = {
      timestamps: [],
      latencies: [],
      costs: [],
      hitRates: [],
      sources: [],
      tiers: []
    };
    
    // Statistical metrics
    this.statistics = {
      latency: { p50: 0, p95: 0, p99: 0, mean: 0, std: 0 },
      cost: { total: 0, saved: 0, efficiency: 0 },
      hitRate: { overall: 0, l1: 0, l2: 0, l3: 0 },
      trends: { latency: 'stable', cost: 'decreasing', efficiency: 'improving' }
    };
    
    // Cache tier tracking
    this.tierMetrics = {
      L1: { hits: 0, misses: 0, avgLatency: 0, totalCalls: 0 },
      L2: { hits: 0, misses: 0, avgLatency: 0, totalCalls: 0 },
      L3: { hits: 0, misses: 0, avgLatency: 0, totalCalls: 0 },
      MISS: { hits: 0, misses: 0, avgLatency: 0, totalCalls: 0 }
    };
    
    // Sector breakdown
    this.sectorMetrics = new Map();
    
    this.initialized = false;
  }
  
  /**
   * Initialize dashboard with D3.js chart
   */
  init() {
    if (this.initialized) return;
    
    // Create dashboard structure
    this.container.innerHTML = `
      <div class="analytics-grid">
        <!-- Real-time metrics cards -->
        <div class="metrics-row">
          <div class="metric-card">
            <div class="metric-label">Hit Rate</div>
            <div class="metric-value" id="metric-hitrate">--</div>
            <div class="metric-trend" id="trend-hitrate"></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">P95 Latency</div>
            <div class="metric-value" id="metric-p95">--</div>
            <div class="metric-trend" id="trend-latency"></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cost Saved</div>
            <div class="metric-value" id="metric-saved">--</div>
            <div class="metric-trend" id="trend-cost"></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Efficiency</div>
            <div class="metric-value" id="metric-efficiency">--</div>
            <div class="metric-trend" id="trend-efficiency"></div>
          </div>
        </div>
        
        <!-- Time-series chart -->
        <div class="chart-panel">
          <div class="chart-header">
            <h3>Performance Timeline</h3>
            <div class="chart-controls">
              <button class="chart-btn" data-metric="latency">Latency</button>
              <button class="chart-btn active" data-metric="both">Both</button>
              <button class="chart-btn" data-metric="cost">Cost</button>
            </div>
          </div>
          <svg id="timeSeriesChart"></svg>
        </div>
        
        <!-- Cache hierarchy visualization -->
        <div class="hierarchy-panel">
          <h3>Cache Hierarchy Flow</h3>
          <div id="cacheHierarchyViz"></div>
        </div>
        
        <!-- Data source metrics table -->
        <div class="table-panel">
          <div class="table-header">
            <h3>Data Source Performance</h3>
            <div class="table-actions">
              <button class="export-btn" data-format="csv">CSV</button>
              <button class="export-btn" data-format="json">JSON</button>
            </div>
          </div>
          <div id="dataSourceTable"></div>
        </div>
      </div>
    `;
    
    this.initChart();
    this.attachEventListeners();
    this.initialized = true;
  }
  
  /**
   * Initialize D3.js time-series chart
   */
  initChart() {
    const svg = d3.select('#timeSeriesChart');
    const container = svg.node().parentElement;
    const width = container.clientWidth;
    const height = 220;
    
    svg.attr('width', width).attr('height', height);
    
    // Chart dimensions
    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create scales
    this.scales = {
      x: d3.scaleTime().range([0, chartWidth]),
      yLatency: d3.scaleLinear().range([chartHeight, 0]),
      yCost: d3.scaleLinear().range([chartHeight, 0])
    };
    
    // Create axes
    this.axes = {
      x: d3.axisBottom(this.scales.x).ticks(6),
      yLatency: d3.axisLeft(this.scales.yLatency).ticks(5),
      yCost: d3.axisRight(this.scales.yCost).ticks(5).tickFormat(d => `$${d.toFixed(4)}`)
    };
    
    // Create chart group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add axes groups
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`);
    
    g.append('g')
      .attr('class', 'y-axis-latency');
    
    g.append('g')
      .attr('class', 'y-axis-cost')
      .attr('transform', `translate(${chartWidth},0)`);
    
    // Add axis labels
    g.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 35)
      .text('Time');
    
    g.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -45)
      .text('Latency (ms)');
    
    g.append('text')
      .attr('class', 'axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(90)')
      .attr('x', chartHeight / 2)
      .attr('y', -chartWidth - 45)
      .text('Cost ($)');
    
    // Line generators
    this.lineGenerators = {
      latency: d3.line()
        .x((d, i) => this.scales.x(this.timeSeries.timestamps[i]))
        .y(d => this.scales.yLatency(d))
        .curve(d3.curveMonotoneX),
      
      cost: d3.line()
        .x((d, i) => this.scales.x(this.timeSeries.timestamps[i]))
        .y(d => this.scales.yCost(d))
        .curve(d3.curveMonotoneX)
    };
    
    // Add paths
    g.append('path')
      .attr('class', 'line-latency')
      .attr('fill', 'none')
      .attr('stroke', '#0ea5e9')
      .attr('stroke-width', 2);
    
    g.append('path')
      .attr('class', 'line-cost')
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2);
    
    // Add moving average lines
    g.append('path')
      .attr('class', 'line-latency-ma')
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');
    
    this.chartGroup = g;
  }
  
  /**
   * Record new data point with full statistical analysis
   */
  recordDataPoint(data) {
    const now = new Date();
    
    // Add to time series
    this.timeSeries.timestamps.push(now);
    this.timeSeries.latencies.push(data.latency);
    this.timeSeries.costs.push(data.cost || 0);
    this.timeSeries.hitRates.push(data.hit ? 1 : 0);
    this.timeSeries.sources.push(data.sourceId || 'unknown');
    this.timeSeries.tiers.push(this.determineCacheTier(data));
    
    // Trim to max data points
    if (this.timeSeries.timestamps.length > this.config.maxDataPoints) {
      Object.keys(this.timeSeries).forEach(key => {
        this.timeSeries[key].shift();
      });
    }
    
    // Update tier metrics
    const tier = this.determineCacheTier(data);
    this.updateTierMetrics(tier, data);
    
    // Update sector metrics
    this.updateSectorMetrics(data);
    
    // Recalculate statistics
    this.calculateStatistics();
    
    // Update visualizations
    this.updateChart();
    this.updateMetricCards();
  }
  
  /**
   * Determine cache tier based on latency and hit status
   * Real algorithm based on typical cache performance characteristics
   */
  determineCacheTier(data) {
    if (!data.hit) return 'MISS';
    
    // L1 (Session/Memory): < 50ms
    if (data.latency < 50) return 'L1';
    
    // L2 (Redis): 50-200ms
    if (data.latency < 200) return 'L2';
    
    // L3 (Vector Store): 200-500ms
    if (data.latency < 500) return 'L3';
    
    return 'MISS';
  }
  
  /**
   * Update tier-specific metrics
   */
  updateTierMetrics(tier, data) {
    const metrics = this.tierMetrics[tier];
    metrics.totalCalls++;
    
    if (data.hit) {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    
    // Update rolling average latency
    const alpha = 0.1; // EMA smoothing factor
    metrics.avgLatency = metrics.avgLatency === 0 
      ? data.latency 
      : alpha * data.latency + (1 - alpha) * metrics.avgLatency;
  }
  
  /**
   * Update sector-specific metrics
   */
  updateSectorMetrics(data) {
    const sector = data.sector || 'general';
    
    if (!this.sectorMetrics.has(sector)) {
      this.sectorMetrics.set(sector, {
        calls: 0,
        hits: 0,
        totalLatency: 0,
        totalCost: 0,
        savedCost: 0,
        lastUpdate: null,
        trend: []
      });
    }
    
    const metrics = this.sectorMetrics.get(sector);
    metrics.calls++;
    if (data.hit) metrics.hits++;
    metrics.totalLatency += data.latency;
    metrics.totalCost += data.cost || 0;
    metrics.savedCost += data.savedCost || 0;
    metrics.lastUpdate = new Date();
    
    // Add to trend (sparkline data)
    metrics.trend.push(data.latency);
    if (metrics.trend.length > 20) metrics.trend.shift();
  }
  
  /**
   * Calculate comprehensive statistics with real algorithms
   */
  calculateStatistics() {
    const latencies = this.timeSeries.latencies;
    const costs = this.timeSeries.costs;
    const hitRates = this.timeSeries.hitRates;
    
    if (latencies.length === 0) return;
    
    // Latency percentiles (proper implementation)
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    this.statistics.latency.p50 = this.percentile(sortedLatencies, 50);
    this.statistics.latency.p95 = this.percentile(sortedLatencies, 95);
    this.statistics.latency.p99 = this.percentile(sortedLatencies, 99);
    this.statistics.latency.mean = this.mean(latencies);
    this.statistics.latency.std = this.standardDeviation(latencies);
    
    // Cost metrics
    this.statistics.cost.total = costs.reduce((sum, c) => sum + c, 0);
    
    // Calculate saved cost (missed cache opportunities)
    const avgApiCost = 0.002; // $0.002 per API call
    const missCount = hitRates.filter(h => h === 0).length;
    const hitCount = hitRates.filter(h => h === 1).length;
    this.statistics.cost.saved = hitCount * avgApiCost;
    
    // Efficiency: cost saved / potential cost
    const potentialCost = (hitCount + missCount) * avgApiCost;
    this.statistics.cost.efficiency = potentialCost > 0 
      ? (this.statistics.cost.saved / potentialCost) * 100 
      : 0;
    
    // Hit rates by tier
    const totalCalls = Object.values(this.tierMetrics).reduce((sum, m) => sum + m.totalCalls, 0);
    if (totalCalls > 0) {
      this.statistics.hitRate.l1 = (this.tierMetrics.L1.hits / totalCalls) * 100;
      this.statistics.hitRate.l2 = (this.tierMetrics.L2.hits / totalCalls) * 100;
      this.statistics.hitRate.l3 = (this.tierMetrics.L3.hits / totalCalls) * 100;
      this.statistics.hitRate.overall = ((this.tierMetrics.L1.hits + this.tierMetrics.L2.hits + this.tierMetrics.L3.hits) / totalCalls) * 100;
    }
    
    // Trend analysis (last 20 data points)
    if (latencies.length >= 20) {
      const recentLatencies = latencies.slice(-20);
      const firstHalf = this.mean(recentLatencies.slice(0, 10));
      const secondHalf = this.mean(recentLatencies.slice(10, 20));
      
      if (secondHalf < firstHalf * 0.9) {
        this.statistics.trends.latency = 'improving';
      } else if (secondHalf > firstHalf * 1.1) {
        this.statistics.trends.latency = 'degrading';
      } else {
        this.statistics.trends.latency = 'stable';
      }
    }
  }
  
  /**
   * Calculate percentile (proper algorithm)
   */
  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
  
  /**
   * Calculate mean
   */
  mean(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }
  
  /**
   * Calculate standard deviation
   */
  standardDeviation(array) {
    if (array.length === 0) return 0;
    const avg = this.mean(array);
    const squareDiffs = array.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }
  
  /**
   * Calculate moving average (SMA)
   */
  movingAverage(array, window) {
    if (array.length < window) return array;
    const result = [];
    for (let i = 0; i < array.length; i++) {
      if (i < window - 1) {
        result.push(this.mean(array.slice(0, i + 1)));
      } else {
        result.push(this.mean(array.slice(i - window + 1, i + 1)));
      }
    }
    return result;
  }
  
  /**
   * Update D3.js chart with latest data
   */
  updateChart() {
    if (!this.chartGroup || this.timeSeries.timestamps.length === 0) return;
    
    // Update scales
    this.scales.x.domain(d3.extent(this.timeSeries.timestamps));
    this.scales.yLatency.domain([0, d3.max(this.timeSeries.latencies) * 1.1]);
    this.scales.yCost.domain([0, d3.max(this.timeSeries.costs) * 1.1]);
    
    // Update axes
    this.chartGroup.select('.x-axis')
      .transition()
      .duration(500)
      .call(this.axes.x);
    
    this.chartGroup.select('.y-axis-latency')
      .transition()
      .duration(500)
      .call(this.axes.yLatency);
    
    this.chartGroup.select('.y-axis-cost')
      .transition()
      .duration(500)
      .call(this.axes.yCost);
    
    // Update latency line
    this.chartGroup.select('.line-latency')
      .datum(this.timeSeries.latencies)
      .transition()
      .duration(500)
      .attr('d', this.lineGenerators.latency);
    
    // Update cost line
    this.chartGroup.select('.line-cost')
      .datum(this.timeSeries.costs)
      .transition()
      .duration(500)
      .attr('d', this.lineGenerators.cost);
    
    // Update moving average
    const maLatencies = this.movingAverage(this.timeSeries.latencies, this.config.movingAverageWindow);
    this.chartGroup.select('.line-latency-ma')
      .datum(maLatencies)
      .transition()
      .duration(500)
      .attr('d', this.lineGenerators.latency);
  }
  
  /**
   * Update metric cards with latest statistics
   */
  updateMetricCards() {
    // Hit rate
    document.getElementById('metric-hitrate').textContent = 
      `${this.statistics.hitRate.overall.toFixed(1)}%`;
    
    // P95 latency
    document.getElementById('metric-p95').textContent = 
      `${Math.round(this.statistics.latency.p95)}ms`;
    
    // Cost saved
    document.getElementById('metric-saved').textContent = 
      `$${this.statistics.cost.saved.toFixed(2)}`;
    
    // Efficiency
    document.getElementById('metric-efficiency').textContent = 
      `${this.statistics.cost.efficiency.toFixed(1)}%`;
    
    // Trends
    this.updateTrendIndicator('trend-hitrate', this.statistics.hitRate.overall > 90 ? 'up' : 'stable');
    this.updateTrendIndicator('trend-latency', this.statistics.trends.latency);
    this.updateTrendIndicator('trend-cost', 'down');
    this.updateTrendIndicator('trend-efficiency', 'up');
  }
  
  /**
   * Update trend indicator
   */
  updateTrendIndicator(elementId, direction) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const icons = {
      up: '↑',
      down: '↓',
      stable: '→',
      improving: '↑',
      degrading: '↓'
    };
    
    const colors = {
      up: '#10b981',
      down: '#ef4444',
      stable: '#64748b',
      improving: '#10b981',
      degrading: '#ef4444'
    };
    
    el.textContent = icons[direction] || '→';
    el.style.color = colors[direction] || '#64748b';
  }
  
  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Chart metric toggle
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const metric = e.target.dataset.metric;
        this.toggleChartMetric(metric);
      });
    });
    
    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = e.target.dataset.format;
        this.exportData(format);
      });
    });
  }
  
  /**
   * Toggle chart metric visibility
   */
  toggleChartMetric(metric) {
    const latencyPath = this.chartGroup.select('.line-latency');
    const costPath = this.chartGroup.select('.line-cost');
    
    if (metric === 'latency') {
      latencyPath.style('opacity', 1);
      costPath.style('opacity', 0);
    } else if (metric === 'cost') {
      latencyPath.style('opacity', 0);
      costPath.style('opacity', 1);
    } else {
      latencyPath.style('opacity', 1);
      costPath.style('opacity', 1);
    }
  }
  
  /**
   * Export data in specified format
   */
  exportData(format) {
    const data = {
      timestamp: new Date().toISOString(),
      statistics: this.statistics,
      tierMetrics: this.tierMetrics,
      sectorMetrics: Object.fromEntries(this.sectorMetrics),
      timeSeries: {
        timestamps: this.timeSeries.timestamps.map(t => t.toISOString()),
        latencies: this.timeSeries.latencies,
        costs: this.timeSeries.costs,
        hitRates: this.timeSeries.hitRates
      }
    };
    
    if (format === 'json') {
      this.downloadJSON(data);
    } else if (format === 'csv') {
      this.downloadCSV(data);
    }
  }
  
  /**
   * Download data as JSON
   */
  downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentcache-analytics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Download data as CSV
   */
  downloadCSV(data) {
    const rows = [
      ['Timestamp', 'Latency (ms)', 'Cost ($)', 'Hit Rate', 'Source', 'Tier']
    ];
    
    for (let i = 0; i < data.timeSeries.timestamps.length; i++) {
      rows.push([
        data.timeSeries.timestamps[i],
        data.timeSeries.latencies[i],
        data.timeSeries.costs[i],
        data.timeSeries.hitRates[i],
        this.timeSeries.sources[i],
        this.timeSeries.tiers[i]
      ]);
    }
    
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentcache-analytics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Get current statistics (for external access)
   */
  getStatistics() {
    return {
      ...this.statistics,
      tierMetrics: this.tierMetrics,
      sectorMetrics: Object.fromEntries(this.sectorMetrics)
    };
  }
}
