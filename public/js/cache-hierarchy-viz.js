/**
 * Cache Hierarchy Visualizer
 * 
 * Sankey-style flow diagram showing cache tier distribution:
 * Request → L1 Session (40%) → L2 Redis (35%) → L3 Vector (17%) → Miss (8%)
 * 
 * Uses D3.js sankey plugin with real performance data
 */

class CacheHierarchyVisualizer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }
    
    this.config = {
      width: options.width || 800,
      height: options.height || 400,
      nodeWidth: options.nodeWidth || 20,
      nodePadding: options.nodePadding || 40,
      ...options
    };
    
    // Tier data
    this.tierData = {
      L1: { value: 0, latency: 0, color: '#10b981' },
      L2: { value: 0, latency: 0, color: '#0ea5e9' },
      L3: { value: 0, latency: 0, color: '#a855f7' },
      MISS: { value: 0, latency: 0, color: '#ef4444' }
    };
    
    this.totalRequests = 0;
    this.initialized = false;
  }
  
  /**
   * Initialize SVG and Sankey layout
   */
  init() {
    if (this.initialized) return;
    
    const { width, height } = this.config;
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    this.g = this.svg.append('g')
      .attr('transform', 'translate(40, 20)');
    
    // Add title and legend
    this.addLegend();
    
    this.initialized = true;
  }
  
  /**
   * Add legend explaining cache tiers
   */
  addLegend() {
    const legend = this.svg.append('g')
      .attr('class', 'hierarchy-legend')
      .attr('transform', 'translate(40, 10)');
    
    const tiers = [
      { name: 'L1: Session', color: '#10b981', desc: '<50ms' },
      { name: 'L2: Redis', color: '#0ea5e9', desc: '50-200ms' },
      { name: 'L3: Vector', color: '#a855f7', desc: '200-500ms' },
      { name: 'Miss', color: '#ef4444', desc: '>500ms' }
    ];
    
    tiers.forEach((tier, i) => {
      const item = legend.append('g')
        .attr('transform', `translate(${i * 140}, 0)`);
      
      item.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', tier.color)
        .attr('rx', 2);
      
      item.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('class', 'legend-text')
        .style('fill', '#cbd5e1')
        .style('font-size', '11px')
        .text(`${tier.name} ${tier.desc}`);
    });
  }
  
  /**
   * Update tier metrics
   */
  updateTier(tier, latency) {
    if (!this.tierData[tier]) return;
    
    this.tierData[tier].value++;
    
    // Update rolling average latency
    const alpha = 0.1; // EMA smoothing
    this.tierData[tier].latency = this.tierData[tier].latency === 0
      ? latency
      : alpha * latency + (1 - alpha) * this.tierData[tier].latency;
    
    this.totalRequests++;
    
    // Redraw if initialized
    if (this.initialized) {
      this.render();
    }
  }
  
  /**
   * Render Sankey diagram
   */
  render() {
    if (!this.initialized || this.totalRequests === 0) return;
    
    // Clear previous render
    this.g.selectAll('*').remove();
    
    // Calculate percentages
    const l1Pct = (this.tierData.L1.value / this.totalRequests) * 100;
    const l2Pct = (this.tierData.L2.value / this.totalRequests) * 100;
    const l3Pct = (this.tierData.L3.value / this.totalRequests) * 100;
    const missPct = (this.tierData.MISS.value / this.totalRequests) * 100;
    
    // Build flow structure
    const flowData = [
      {
        source: 'Request',
        target: 'L1: Session',
        value: this.tierData.L1.value,
        percent: l1Pct,
        latency: this.tierData.L1.latency,
        color: this.tierData.L1.color
      },
      {
        source: 'Request',
        target: 'L2: Redis',
        value: this.tierData.L2.value,
        percent: l2Pct,
        latency: this.tierData.L2.latency,
        color: this.tierData.L2.color
      },
      {
        source: 'Request',
        target: 'L3: Vector',
        value: this.tierData.L3.value,
        percent: l3Pct,
        latency: this.tierData.L3.latency,
        color: this.tierData.L3.color
      },
      {
        source: 'Request',
        target: 'Miss',
        value: this.tierData.MISS.value,
        percent: missPct,
        latency: this.tierData.MISS.latency,
        color: this.tierData.MISS.color
      }
    ];
    
    // Simple vertical flow visualization (since we don't have d3-sankey plugin)
    this.renderVerticalFlow(flowData);
  }
  
  /**
   * Render vertical flow chart (alternative to Sankey)
   */
  renderVerticalFlow(flowData) {
    const { width, height } = this.config;
    const chartWidth = width - 80;
    const chartHeight = height - 60;
    
    // Source node (Request)
    const sourceY = 40;
    const sourceX = chartWidth / 2;
    
    this.g.append('rect')
      .attr('x', sourceX - 60)
      .attr('y', sourceY - 20)
      .attr('width', 120)
      .attr('height', 40)
      .attr('fill', '#1e293b')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 2)
      .attr('rx', 4);
    
    this.g.append('text')
      .attr('x', sourceX)
      .attr('y', sourceY + 5)
      .attr('text-anchor', 'middle')
      .attr('class', 'node-label')
      .style('fill', '#f1f5f9')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Incoming Requests');
    
    // Target nodes (L1, L2, L3, Miss)
    const targetY = chartHeight - 60;
    const nodeWidth = 100;
    const spacing = (chartWidth - (nodeWidth * 4)) / 5;
    
    flowData.forEach((flow, i) => {
      const x = spacing + (i * (nodeWidth + spacing));
      
      // Draw flow path
      this.drawFlowPath(sourceX, sourceY + 20, x + nodeWidth / 2, targetY, flow);
      
      // Draw target node
      this.g.append('rect')
        .attr('x', x)
        .attr('y', targetY)
        .attr('width', nodeWidth)
        .attr('height', 80)
        .attr('fill', flow.color)
        .attr('fill-opacity', 0.2)
        .attr('stroke', flow.color)
        .attr('stroke-width', 2)
        .attr('rx', 4);
      
      // Node label
      this.g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', targetY + 20)
        .attr('text-anchor', 'middle')
        .attr('class', 'node-label')
        .style('fill', '#f1f5f9')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(flow.target);
      
      // Percentage
      this.g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', targetY + 38)
        .attr('text-anchor', 'middle')
        .style('fill', flow.color)
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text(`${flow.percent.toFixed(1)}%`);
      
      // Latency
      this.g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', targetY + 54)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .style('font-size', '10px')
        .text(`${Math.round(flow.latency)}ms avg`);
      
      // Count
      this.g.append('text')
        .attr('x', x + nodeWidth / 2)
        .attr('y', targetY + 68)
        .attr('text-anchor', 'middle')
        .style('fill', '#64748b')
        .style('font-size', '9px')
        .text(`${flow.value.toLocaleString()} calls`);
    });
  }
  
  /**
   * Draw flow path (curved line with gradient)
   */
  drawFlowPath(x1, y1, x2, y2, flow) {
    // Create gradient for flow
    const gradientId = `gradient-${flow.target.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const gradient = this.svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2);
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#64748b')
      .attr('stop-opacity', 0.6);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', flow.color)
      .attr('stop-opacity', 0.8);
    
    // Calculate path width based on percentage
    const maxWidth = 40;
    const minWidth = 2;
    const pathWidth = Math.max(minWidth, Math.min(maxWidth, (flow.percent / 100) * maxWidth));
    
    // Draw curved path
    const midY = (y1 + y2) / 2;
    const path = `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`;
    
    this.g.append('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', `url(#${gradientId})`)
      .attr('stroke-width', pathWidth)
      .attr('opacity', 0.7)
      .style('stroke-linecap', 'round');
    
    // Add animated flow particles for visual effect
    if (flow.value > 0) {
      this.animateFlowParticle(path, flow.color);
    }
  }
  
  /**
   * Animate flow particle along path
   */
  animateFlowParticle(pathD, color) {
    const particle = this.g.append('circle')
      .attr('r', 3)
      .attr('fill', color)
      .attr('opacity', 0);
    
    // Get path element for animation
    const pathEl = this.g.append('path')
      .attr('d', pathD)
      .attr('fill', 'none')
      .attr('stroke', 'none');
    
    const pathNode = pathEl.node();
    const pathLength = pathNode.getTotalLength();
    
    // Animate particle along path
    const animate = () => {
      particle
        .attr('opacity', 0)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attrTween('transform', () => {
          return (t) => {
            const point = pathNode.getPointAtLength(t * pathLength);
            return `translate(${point.x}, ${point.y})`;
          };
        })
        .attr('opacity', t => t < 0.1 || t > 0.9 ? 0 : 0.8)
        .on('end', () => {
          // Repeat animation
          setTimeout(animate, Math.random() * 2000 + 1000);
        });
    };
    
    // Start animation
    setTimeout(animate, Math.random() * 1000);
    
    // Clean up path element
    pathEl.remove();
  }
  
  /**
   * Get hierarchy metrics summary
   */
  getMetrics() {
    if (this.totalRequests === 0) {
      return {
        total: 0,
        l1: { count: 0, percent: 0, latency: 0 },
        l2: { count: 0, percent: 0, latency: 0 },
        l3: { count: 0, percent: 0, latency: 0 },
        miss: { count: 0, percent: 0, latency: 0 },
        hitRate: 0
      };
    }
    
    const hits = this.tierData.L1.value + this.tierData.L2.value + this.tierData.L3.value;
    
    return {
      total: this.totalRequests,
      l1: {
        count: this.tierData.L1.value,
        percent: (this.tierData.L1.value / this.totalRequests) * 100,
        latency: Math.round(this.tierData.L1.latency)
      },
      l2: {
        count: this.tierData.L2.value,
        percent: (this.tierData.L2.value / this.totalRequests) * 100,
        latency: Math.round(this.tierData.L2.latency)
      },
      l3: {
        count: this.tierData.L3.value,
        percent: (this.tierData.L3.value / this.totalRequests) * 100,
        latency: Math.round(this.tierData.L3.latency)
      },
      miss: {
        count: this.tierData.MISS.value,
        percent: (this.tierData.MISS.value / this.totalRequests) * 100,
        latency: Math.round(this.tierData.MISS.latency)
      },
      hitRate: (hits / this.totalRequests) * 100
    };
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    Object.keys(this.tierData).forEach(tier => {
      this.tierData[tier].value = 0;
      this.tierData[tier].latency = 0;
    });
    this.totalRequests = 0;
    
    if (this.initialized) {
      this.render();
    }
  }
}
