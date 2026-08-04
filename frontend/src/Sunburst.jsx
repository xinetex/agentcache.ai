import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function Sunburst({ data, width = 600, height = 600, onSelectNode }) {
  const svgRef = useRef(null);
  const [selectedLeaf, setSelectedLeaf] = React.useState(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children?.length + 1 || 1));
    const radius = width / 6;

    // Create the hierarchy and partition
    const hierarchy = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);

    const root = d3.partition()
      .size([2 * Math.PI, hierarchy.height + 1])
      (hierarchy);

    root.each(d => d.current = d);

    // Create the arc generator
    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [-width / 2, -height / 2, width, width])
      .style('font', '10px sans-serif');

    // Create a group for the paths
    const g = svg.append('g');

    const path = g.append('g')
      .selectAll('path')
      .data(root.descendants().slice(1)) // Skip root for the outer rings
      .join('path')
      .attr('fill', d => {
        while (d.depth > 1) d = d.parent;
        return color(d.data.name);
      })
      .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
      .attr('d', d => arc(d.current))
      .style('cursor', 'pointer')
      .on('click', clicked);

    path.append('title')
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join('/')}\n${d.value}`);

    const label = g.append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(root.descendants().slice(1))
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill-opacity', d => +labelVisible(d.current))
      .attr('transform', d => labelTransform(d.current))
      .text(d => d.data.name)
      .attr('fill', 'var(--text-primary)') // Use our theme variable
      .style('font-size', '12px');

    const parent = g.append('circle')
      .datum(root)
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('click', clicked);

    // Center text (root label)
    const centerTextGroup = g.append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none');

    const rootName = centerTextGroup.append('text')
      .attr('dy', '-0.5em')
      .attr('fill', 'var(--text-primary)')
      .style('font-size', '16px')
      .style('font-weight', '500')
      .text(root.data.name);

    const rootValue = centerTextGroup.append('text')
      .attr('dy', '1em')
      .attr('fill', 'var(--text-muted)')
      .style('font-size', '12px')
      .text(root.value ? `${root.value} items` : '');

    function clicked(event, p) {
      // If it's a leaf node, trigger the tooltip
      if (!p.children) {
        setSelectedLeaf({ data: p.data, x: event.clientX, y: event.clientY });
        if (onSelectNode) onSelectNode(p.data);
        return;
      }

      // Close tooltip if zooming
      setSelectedLeaf(null);

      // Zoom transition
      parent.datum(p.parent || root);
      
      // Update center text to the new root
      rootName.text(p.data.name);
      rootValue.text(p.value ? `${p.value} items` : '');

      root.each(d => d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth)
      });

      const t = g.transition().duration(750);

      path.transition(t)
        .tween('data', d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
        .filter(function(d) {
          return +this.getAttribute('fill-opacity') || arcVisible(d.target);
        })
        .attr('fill-opacity', d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr('pointer-events', d => arcVisible(d.target) ? 'auto' : 'none')
        .attrTween('d', d => () => arc(d.current));

      label.transition(t)
        .filter(function(d) {
          return +this.getAttribute('fill-opacity') || labelVisible(d.target);
        })
        .attr('fill-opacity', d => +labelVisible(d.target))
        .attrTween('transform', d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
  }, [data, width, height, onSelectNode]);

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <svg ref={svgRef} width={width} height={height}></svg>
      
      {selectedLeaf && (
        <div style={{
          position: 'fixed',
          left: selectedLeaf.x,
          top: selectedLeaf.y,
          transform: 'translate(-50%, -100%)',
          marginTop: '-10px',
          zIndex: 2000,
          background: 'var(--bg-surface)',
          border: '1px solid var(--accent-amber)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '160px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
            {selectedLeaf.data.name}
          </div>
          <button className="btn-outline" style={{ fontSize: '11px', padding: '4px 8px' }}>Run Extract Data</button>
          <button className="btn-outline" style={{ fontSize: '11px', padding: '4px 8px' }}>Batch Rename</button>
          <button className="btn-outline" style={{ fontSize: '11px', padding: '4px 8px', color: '#ff5555', borderColor: 'rgba(255,85,85,0.3)', marginTop: '4px' }} onClick={() => setSelectedLeaf(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
