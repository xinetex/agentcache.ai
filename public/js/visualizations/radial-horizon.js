/**
 * Radial Horizon Chart with Sankey Ribbons
 * 
 * Innovation: Combines radial time-series with flow diagram
 * - Outer ring: 60-second circular timeline with latency bands
 * - Inner ribbons: Sankey flows showing L1→L2→L3 distribution
 * - Time advances clockwise (12 o'clock = now)
 * - Real-time cache performance in a stunning circular layout
 */

class RadialHorizonChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }
    
    this.config = {
      width: options.width || 560,
      height: options.height || 560,
      innerRadius: options.innerRadius || 60,
      outerRadius: options.outerRadius || 240,
      ribbonRadius: options.ribbonRadius || 50,
      timeWindow: options.timeWindow || 60, // seconds
      ...options
    };
    
    // Data stores
    this.timeSeriesData = []; // { timestamp, latency, tier, hitRate }
    this.tierDistribution = {
      L1: 0,
      L2: 0,
      L3: 0,
      MISS: 0
    };
    
    // Color scales
    this.tierColors = {
      L1: '#10b981',
      L2: '#0ea5e9',
      L3: '#a855f7',
      MISS: '#ef4444'
    };
    
    // Latency bands for horizon chart
    this.latencyBands = [
      { max: 50, color: '#10b981', label: '<50ms' },
      { max: 200, color: '#0ea5e9', label: '50-200ms' },
      { max: 500, color: '#a855f7', label: '200-500ms' },
      { max: Infinity, color: '#ef4444', label: '>500ms' }
    ];
    
    this.initialized = false;
    this.animationFrame = null;
  }
  
  /**
   * Initialize SVG and scales
   */
  init() {
    if (this.initialized) return;
    
    const { width, height } = this.config;
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);
    
    // Create main group centered
    this.g = this.svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    // Create layers
    this.ribbonLayer = this.g.append('g').attr('class', 'ribbon-layer');
    this.horizonLayer = this.g.append('g').attr('class', 'horizon-layer');
    this.timeLayer = this.g.append('g').attr('class', 'time-layer');
    
    // Add center circle
    this.g.append('circle')
      .attr('r', this.config.innerRadius)
      .attr('fill', '#0f172a')
      .attr('stroke', '#334155')
      .attr('stroke-width', 2);
    
    // Add center label
    this.centerLabel = this.g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('class', 'center-label')
      .style('fill', '#f1f5f9')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text('CACHE');
    
    // Create scales
    this.angleScale = d3.scaleLinear()
      .domain([0, this.config.timeWindow])
      .range([0, 2 * Math.PI]);
    
    this.radiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([this.config.innerRadius + 20, this.config.outerRadius]);
    
    // Add legend
    this.addLegend();
    
    // Add time markers (12, 3, 6, 9 o'clock)
    this.addTimeMarkers();
    
    this.initialized = true;
  }
  
  /**
   * Add time markers around the circle
   */
  addTimeMarkers() {
    const markers = [
      { angle: 0, label: 'Now' },
      { angle: Math.PI / 2, label: '15s' },
      { angle: Math.PI, label: '30s' },
      { angle: 3 * Math.PI / 2, label: '45s' }
    ];
    
    markers.forEach(marker => {
      const x = (this.config.outerRadius + 20) * Math.sin(marker.angle);
      const y = -(this.config.outerRadius + 20) * Math.cos(marker.angle);
      
      this.timeLayer.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('fill', '#64748b')
        .style('font-size', '10px')
        .style('font-weight', '500')
        .text(marker.label);
    });
  }
  
  /**
   * Add legend for latency bands
   */
  addLegend() {
    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(10, 10)`);
    
    this.latencyBands.forEach((band, i) => {
      const item = legend.append('g')
        .attr('transform', `translate(0, ${i * 18})`);
      
      item.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', band.color)
        .attr('rx', 2);
      
      item.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .style('fill', '#cbd5e1')
        .style('font-size', '10px')
        .text(band.label);
    });
  }
  
  /**
   * Record new data point
   */
  recordDataPoint(data) {
    const now = Date.now();
    
    // Add to time series
    this.timeSeriesData.push({
      timestamp: now,
      latency: data.latency,
      tier: data.tier || this.determineTier(data),
      hitRate: data.hit ? 1 : 0
    });
    
    // Update tier distribution
    const tier = data.tier || this.determineTier(data);
    this.tierDistribution[tier]++;
    
    // Trim old data (keep last 60 seconds)
    const cutoff = now - (this.config.timeWindow * 1000);
    this.timeSeriesData = this.timeSeriesData.filter(d => d.timestamp >= cutoff);
    
    // Render if initialized
    if (this.initialized) {
      this.render();
    }
  }
  
  /**
   * Determine cache tier from latency
   */
  determineTier(data) {
    if (!data.hit) return 'MISS';
    if (data.latency < 50) return 'L1';
    if (data.latency < 200) return 'L2';
    if (data.latency < 500) return 'L3';
    return 'MISS';
  }
  
  /**
   * Render the complete visualization
   */
  render() {
    this.renderHorizonBands();
    this.renderSankeyRibbons();
    this.updateCenterStats();
  }
  
  /**
   * Render horizon chart bands (outer ring)
   */
  renderHorizonBands() {
    if (this.timeSeriesData.length < 2) return;
    
    const now = Date.now();
    
    // Group data by latency band
    const bandData = this.latencyBands.map(band => {
      return this.timeSeriesData.map(d => {
        const age = (now - d.timestamp) / 1000; // seconds ago
        const angle = this.angleScale(age) - Math.PI / 2; // Rotate to start at top
        
        // Check if point falls in this band
        let value = 0;
        if (band.max === Infinity) {
          value = d.latency >= this.latencyBands[this.latencyBands.length - 2].max ? 1 : 0;
        } else {
          const prevMax = this.latencyBands[Math.max(0, this.latencyBands.indexOf(band) - 1)]?.max || 0;
          value = d.latency >= prevMax && d.latency < band.max ? 1 : 0;
        }
        
        return {
          angle: angle,
          value: value,
          latency: d.latency
        };
      }).filter(d => d.value > 0);
    });
    
    // Render each band as arc segments
    bandData.forEach((points, bandIndex) => {
      const band = this.latencyBands[bandIndex];
      const innerR = this.config.innerRadius + 20 + (bandIndex * 30);
      const outerR = innerR + 28;
      
      // Clear previous band
      this.horizonLayer.selectAll(`.band-${bandIndex}`).remove();
      
      if (points.length === 0) return;
      
      // Create arc generator
      const arc = d3.arc()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(d => d.angle - 0.05)
        .endAngle(d => d.angle + 0.05);
      
      // Draw arcs
      this.horizonLayer.selectAll(`.arc-${bandIndex}`)
        .data(points)
        .join('path')
        .attr('class', `band-${bandIndex}`)
        .attr('d', arc)
        .attr('fill', band.color)
        .attr('opacity', 0.7);
    });
  }
  
  /**
   * Render Sankey flow ribbons (inner area)
   */
  renderSankeyRibbons() {
    const total = Object.values(this.tierDistribution).reduce((sum, val) => sum + val, 0);
    if (total === 0) return;
    
    // Calculate percentages
    const percentages = {};
    let startAngle = -Math.PI / 2;
    
    Object.keys(this.tierDistribution).forEach(tier => {
      const percentage = this.tierDistribution[tier] / total;
      const angleSpan = percentage * 2 * Math.PI;
      
      percentages[tier] = {
        startAngle: startAngle,
        endAngle: startAngle + angleSpan,
        percentage: percentage,
        count: this.tierDistribution[tier]
      };
      
      startAngle += angleSpan;
    });
    
    // Clear previous ribbons
    this.ribbonLayer.selectAll('*').remove();
    
    // Draw ribbons
    Object.entries(percentages).forEach(([tier, data]) => {
      if (data.count === 0) return;
      
      const arc = d3.arc()
        .innerRadius(this.config.ribbonRadius)
        .outerRadius(this.config.innerRadius - 5)
        .startAngle(data.startAngle)
        .endAngle(data.endAngle);
      
      this.ribbonLayer.append('path')
        .attr('d', arc)
        .attr('fill', this.tierColors[tier])
        .attr('opacity', 0.6)
        .attr('stroke', this.tierColors[tier])
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', (event) => {
          d3.select(event.target).attr('opacity', 0.9);
          this.showTooltip(event, tier, data);
        })
        .on('mouseout', (event) => {
          d3.select(event.target).attr('opacity', 0.6);
          this.hideTooltip();
        });
      
      // Add label if segment is large enough
      if (data.percentage > 0.05) {
        const midAngle = (data.startAngle + data.endAngle) / 2;
        const labelRadius = (this.config.ribbonRadius + this.config.innerRadius) / 2;
        const x = labelRadius * Math.sin(midAngle);
        const y = -labelRadius * Math.cos(midAngle);
        
        this.ribbonLayer.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('fill', '#f1f5f9')
          .style('font-size', '9px')
          .style('font-weight', '600')
          .style('pointer-events', 'none')
          .text(`${tier} ${(data.percentage * 100).toFixed(0)}%`);
      }
    });
  }
  
  /**
   * Update center statistics
   */
  updateCenterStats() {
    const total = Object.values(this.tierDistribution).reduce((sum, val) => sum + val, 0);
    if (total === 0) {
      this.centerLabel.text('NO DATA');
      return;
    }
    
    const hits = this.tierDistribution.L1 + this.tierDistribution.L2 + this.tierDistribution.L3;
    const hitRate = (hits / total) * 100;
    
    this.centerLabel.text(`${hitRate.toFixed(1)}%`);
  }
  
  /**
   * Show tooltip
   */
  showTooltip(event, tier, data) {
    // TODO: Implement tooltip
    console.log(`${tier}: ${data.count} calls (${(data.percentage * 100).toFixed(1)}%)`);
  }
  
  /**
   * Hide tooltip
   */
  hideTooltip() {
    // TODO: Implement tooltip hiding
  }
  
  /**
   * Reset visualization
   */
  reset() {
    this.timeSeriesData = [];
    this.tierDistribution = { L1: 0, L2: 0, L3: 0, MISS: 0 };
    if (this.initialized) {
      this.render();
    }
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    const total = Object.values(this.tierDistribution).reduce((sum, val) => sum + val, 0);
    return {
      total: total,
      distribution: { ...this.tierDistribution },
      dataPoints: this.timeSeriesData.length
    };
  }
}
