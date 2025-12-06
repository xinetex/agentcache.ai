import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const AgentChord = ({ matrix, agents }) => {
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
        if (!matrix || !svgRef.current || containerSize.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = containerSize.width;
        const height = containerSize.height;
        const outerRadius = Math.min(width, height) * 0.5 - 60;
        const innerRadius = outerRadius - 20;

        const chord = d3.chord()
            .padAngle(0.05)
            .sortSubgroups(d3.descending);

        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const ribbon = d3.ribbon()
            .radius(innerRadius);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        const chords = chord(matrix);

        // Draw Arcs (Agents)
        const group = g.append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");

        group.append("path")
            .style("fill", d => color(d.index))
            .style("stroke", d => d3.rgb(color(d.index)).darker())
            .attr("d", arc)
            .on("mouseover", function (event, d) {
                // Highlight connected ribbons
                ribbons.filter(r => r.source.index !== d.index && r.target.index !== d.index)
                    .transition().duration(200)
                    .style("opacity", 0.1);
            })
            .on("mouseout", function () {
                ribbons.transition().duration(200).style("opacity", 0.7);
            });

        // Labels
        group.append("text")
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", d => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${outerRadius + 10})
                ${d.angle > Math.PI ? "rotate(180)" : ""}
            `)
            .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
            .text(d => agents[d.index]?.name || `Agent ${d.index}`)
            .style("fill", "#fff")
            .style("font-size", "10px")
            .style("font-family", "monospace");

        // Draw Ribbons (Connections)
        const ribbons = g.append("g")
            .attr("fill-opacity", 0.7)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("d", ribbon)
            .style("fill", d => color(d.target.index))
            .style("stroke", d => d3.rgb(color(d.target.index)).darker());

    }, [matrix, agents, containerSize]);

    return (
        <svg ref={svgRef} className="w-full h-full" />
    );
};

export default AgentChord;
