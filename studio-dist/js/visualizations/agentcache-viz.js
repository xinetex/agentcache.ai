/**
 * AgentCache Visualization Library
 * 
 * Shared D3.js + Anime.js components for sector dashboards
 * Features: Network graphs, Sankey diagrams, Heatmaps, Animated metrics
 */

const AgentCacheViz = (function() {
  'use strict';

  // ============================================================================
  // Anime.js Animations
  // ============================================================================

  /**
   * Animate metric count-up
   * @param {string} elementId - DOM element ID
   * @param {number} targetValue - Final value
   * @param {number} duration - Animation duration in ms
   * @param {string} suffix - Optional suffix (%, $, ms, etc.)
   */
  function animateCountUp(elementId, targetValue, duration = 2000, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const obj = { value: 0 };
    anime({
      targets: obj,
      value: targetValue,
      duration: duration,
      easing: 'easeOutExpo',
      round: targetValue < 10 ? 10 : 1,
      update: function() {
        element.textContent = obj.value.toLocaleString() + suffix;
      }
    });
  }

  /**
   * Animate metric card entrance
   * @param {string} selector - CSS selector for cards
   */
  function animateCardsEntrance(selector = '.metric-card') {
    anime({
      targets: selector,
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(100),
      duration: 800,
      easing: 'easeOutCubic'
    });
  }

  /**
   * Pulse animation for alerts
   * @param {string} elementId - DOM element ID
   */
  function pulseAlert(elementId) {
    anime({
      targets: `#${elementId}`,
      scale: [1, 1.05, 1],
      duration: 1000,
      loop: true,
      easing: 'easeInOutQuad'
    });
  }

  /**
   * Status transition animation
   * @param {string} elementId - DOM element ID
   * @param {string} fromColor - Starting color
   * @param {string} toColor - Ending color
   */
  function animateStatusChange(elementId, fromColor, toColor) {
    const element = document.getElementById(elementId);
    if (!element) return;

    anime({
      targets: element,
      backgroundColor: [fromColor, toColor],
      duration: 500,
      easing: 'easeInOutQuad'
    });
  }

  // ============================================================================
  // D3.js Network Graph
  // ============================================================================

  /**
   * Create force-directed network graph
   * @param {string} containerId - Container DOM element ID
   * @param {Array} nodes - Array of {id, label, group, value}
   * @param {Array} links - Array of {source, target, value}
   * @param {Object} options - Configuration options
   */
  function createNetworkGraph(containerId, nodes, links, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = options.width || container.clientWidth;
    const height = options.height || 500;

    // Clear existing
    d3.select(`#${containerId}`).html('');

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');

    // Color scale by group
    const color = d3.scaleOrdinal()
      .domain([0, 1, 2, 3, 4])
      .range(['#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ef4444']);

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Links
    const link = svg.append('g')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value || 1) * 2);

    // Nodes
    const node = svg.append('g')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 2)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => Math.sqrt(d.value || 10) * 3)
      .attr('fill', d => color(d.group))
      .call(drag(simulation));

    // Labels
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.label)
      .attr('font-size', 11)
      .attr('fill', '#e2e8f0')
      .attr('text-anchor', 'middle')
      .attr('dy', 4);

    // Tooltips
    node.append('title')
      .text(d => `${d.label}\nValue: ${d.value || 0}`);

    // Update positions
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag behavior
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    // Animate entrance
    node.attr('r', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .attr('r', d => Math.sqrt(d.value || 10) * 3);
  }

  // ============================================================================
  // D3.js Sankey Diagram
  // ============================================================================

  /**
   * Create Sankey flow diagram
   * @param {string} containerId - Container DOM element ID
   * @param {Object} data - {nodes: [], links: []}
   * @param {Object} options - Configuration options
   */
  function createSankeyDiagram(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = options.width || container.clientWidth;
    const height = options.height || 500;

    d3.select(`#${containerId}`).html('');

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const sankey = d3.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 6]]);

    const {nodes, links} = sankey({
      nodes: data.nodes.map(d => Object.assign({}, d)),
      links: data.links.map(d => Object.assign({}, d))
    });

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Links
    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.5)
      .selectAll('g')
      .data(links)
      .join('g')
      .append('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', d => color(d.source.name))
      .attr('stroke-width', d => Math.max(1, d.width))
      .append('title')
      .text(d => `${d.source.name} → ${d.target.name}\n${d.value.toLocaleString()}`);

    // Nodes
    svg.append('g')
      .selectAll('rect')
      .data(nodes)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => d.y1 - d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('fill', d => color(d.name))
      .attr('stroke', '#1e293b')
      .append('title')
      .text(d => `${d.name}\n${d.value.toLocaleString()}`);

    // Labels
    svg.append('g')
      .style('font', '11px sans-serif')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .attr('fill', '#e2e8f0')
      .text(d => d.name);
  }

  // ============================================================================
  // D3.js Heatmap
  // ============================================================================

  /**
   * Create heatmap visualization
   * @param {string} containerId - Container DOM element ID
   * @param {Array} data - Array of {x, y, value}
   * @param {Object} options - Configuration options
   */
  function createHeatmap(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = options.width || container.clientWidth;
    const height = options.height || 400;
    const margin = {top: 30, right: 30, bottom: 60, left: 60};

    d3.select(`#${containerId}`).html('');

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Extract unique x and y values
    const xValues = [...new Set(data.map(d => d.x))];
    const yValues = [...new Set(data.map(d => d.y))];

    // Scales
    const x = d3.scaleBand()
      .domain(xValues)
      .range([margin.left, width - margin.right])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(yValues)
      .range([margin.top, height - margin.bottom])
      .padding(0.05);

    const colorScale = d3.scaleSequential()
      .interpolator(d3.interpolateViridis)
      .domain([0, d3.max(data, d => d.value)]);

    // Cells
    svg.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.x))
      .attr('y', d => y(d.y))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1)
      .append('title')
      .text(d => `${d.x}, ${d.y}: ${d.value}`);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('fill', '#94a3b8');

    // Animate entrance
    svg.selectAll('rect')
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 10)
      .attr('opacity', 1);
  }

  // ============================================================================
  // Time-Series Line Chart
  // ============================================================================

  /**
   * Create animated time-series line chart
   * @param {string} containerId - Container DOM element ID
   * @param {Array} data - Array of {time, value, series?}
   * @param {Object} options - Configuration options
   */
  function createTimeSeriesChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = options.width || container.clientWidth;
    const height = options.height || 300;
    const margin = {top: 20, right: 30, bottom: 30, left: 50};

    d3.select(`#${containerId}`).html('');

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.time))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Line generator
    const line = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    // Draw line
    const path = svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#0ea5e9')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Animate line drawing
    const totalLength = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .attr('color', '#64748b');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .attr('color', '#64748b');
  }

  // ============================================================================
  // Radial Progress (Gauge)
  // ============================================================================

  /**
   * Create radial progress gauge
   * @param {string} containerId - Container DOM element ID
   * @param {number} value - Progress value (0-100)
   * @param {Object} options - Configuration options
   */
  function createRadialGauge(containerId, value, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const size = options.size || 150;
    const thickness = options.thickness || 15;
    const color = options.color || '#0ea5e9';

    d3.select(`#${containerId}`).html('');

    const svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', size)
      .attr('height', size);

    const radius = (size / 2) - thickness;
    const arc = d3.arc()
      .innerRadius(radius)
      .outerRadius(radius + thickness)
      .startAngle(0);

    // Background arc
    svg.append('path')
      .datum({endAngle: 2 * Math.PI})
      .attr('d', arc)
      .attr('fill', '#334155')
      .attr('transform', `translate(${size/2},${size/2})`);

    // Progress arc
    const foreground = svg.append('path')
      .datum({endAngle: 0})
      .attr('d', arc)
      .attr('fill', color)
      .attr('transform', `translate(${size/2},${size/2})`);

    // Animate progress
    foreground.transition()
      .duration(1500)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(d.endAngle, (value / 100) * 2 * Math.PI);
        return function(t) {
          d.endAngle = interpolate(t);
          return arc(d);
        };
      });

    // Center text
    svg.append('text')
      .attr('x', size / 2)
      .attr('y', size / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', '#e2e8f0')
      .text('0%')
      .transition()
      .duration(1500)
      .tween('text', function() {
        const i = d3.interpolateNumber(0, value);
        return function(t) {
          this.textContent = Math.round(i(t)) + '%';
        };
      });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // Animations
    animateCountUp,
    animateCardsEntrance,
    pulseAlert,
    animateStatusChange,
    
    // D3 Visualizations
    createNetworkGraph,
    createSankeyDiagram,
    createHeatmap,
    createTimeSeriesChart,
    createRadialGauge
  };
})();

// Make available globally
window.AgentCacheViz = AgentCacheViz;
