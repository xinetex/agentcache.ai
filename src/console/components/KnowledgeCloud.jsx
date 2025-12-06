import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const KnowledgeCloud = ({ nodes }) => {
    const svgRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateSize = () => {
            if (svgRef.current) {
                const rect = svgRef.current.parentElement.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };
        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    useEffect(() => {
        if (!nodes || nodes.length === 0 || !svgRef.current || containerSize.width === 0) return;

        const width = containerSize.width;
        const height = containerSize.height;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // 1. Mock Dimensionality Reduction (3D -> 2D) if no x/y
        // In real app, t-SNE would happen on server. Here we project hash of ID to x/y.
        const data = nodes.map(n => {
            // Deterministic pseudo-random position based on ID if real coords missing
            if (n.x && n.y) return n;

            const hash = n.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return {
                ...n,
                x: (Math.sin(hash) * 0.4 + 0.5) * width,
                y: (Math.cos(hash) * 0.4 + 0.5) * height,
                cluster: hash % 5
            };
        });

        const g = svg.append("g");

        // Zoom Behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Color Scale
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Draw Nodes
        g.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 5)
            .attr("fill", d => color(d.cluster))
            .attr("stroke", "#000")
            .attr("stroke-width", 1)
            .attr("opacity", 0.8)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr("r", 10)
                    .attr("stroke", "#fff");

                // Show Tooltip (could be a div, but simple text for now)
                g.append("text")
                    .attr("id", "tooltip")
                    .attr("x", d.x + 15)
                    .attr("y", d.y)
                    .text(d.name || d.key)
                    .attr("fill", "#fff")
                    .style("font-size", "12px")
                    .style("font-family", "monospace")
                    .style("pointer-events", "none")
                    .style("text-shadow", "0 0 5px #000");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition().duration(200)
                    .attr("r", 5)
                    .attr("stroke", "#000");
                d3.select("#tooltip").remove();
            });

    }, [nodes, containerSize]);

    return (
        <svg ref={svgRef} className="w-full h-full bg-black/40 rounded-lg" />
    );
};

export default KnowledgeCloud;
