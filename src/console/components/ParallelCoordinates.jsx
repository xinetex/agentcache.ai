import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const ParallelCoordinates = ({ data, dimensions, colorBy = 'fitness' }) => {
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
        if (!data || data.length === 0 || !svgRef.current || containerSize.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 30, right: 10, bottom: 10, left: 10 };
        const width = containerSize.width - margin.left - margin.right;
        const height = containerSize.height - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Extract Dimensions if not provided
        const dims = dimensions || Object.keys(data[0]).filter(d => typeof data[0][d] === 'number' && d !== 'id');

        // Build Y Scales (one for each dimension)
        const y = {};
        dims.forEach(d => {
            y[d] = d3.scaleLinear()
                .domain(d3.extent(data, p => p[d]))
                .range([height, 0]);
        });

        // Build X Scale
        const x = d3.scalePoint()
            .range([0, width])
            .padding(1)
            .domain(dims);

        // Path function
        const line = d => d3.line()(dims.map(p => [x(p), y[p](d[p])]));

        // Color Scale
        const color = d3.scaleSequential(d3.interpolateCyan) // Cyberpunk Theme
            .domain(d3.extent(data, d => d[colorBy]));

        // Draw Lines
        g.selectAll("myPath")
            .data(data)
            .enter().append("path")
            .attr("d", line)
            .style("fill", "none")
            .style("stroke", d => color(d[colorBy]))
            .style("opacity", 0.6)
            .style("stroke-width", 1.5)
            .on("mouseover", function (event, d) {
                d3.select(this).style("stroke-width", 4).style("opacity", 1);
            })
            .on("mouseout", function (event, d) {
                d3.select(this).style("stroke-width", 1.5).style("opacity", 0.6);
            });

        // Draw Axes
        g.selectAll("myAxis")
            .data(dims).enter()
            .append("g")
            .attr("transform", d => `translate(${x(d)})`)
            .each(function (d) { d3.select(this).call(d3.axisLeft(y[d])); })
            .attr("color", "#64748b") // Slate axis color
            .style("font-family", "monospace")
            .append("text")
            .style("text-anchor", "middle")
            .attr("y", -9)
            .text(d => d.toUpperCase())
            .style("fill", "#00f3ff") // Cyan Label
            .style("font-weight", "bold");

    }, [data, dimensions, containerSize]);

    return (
        <svg ref={svgRef} className="w-full h-full" />
    );
};

export default ParallelCoordinates;
