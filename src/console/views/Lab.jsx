import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const STATES = ['START', 'L1_CHECK', 'L2_CHECK', 'L3_SEARCH', 'COGNITIVE', 'LLM_CALL', 'END'];

export default function Lab() {
    const [genomes, setGenomes] = useState([]);
    const [selectedGenome, setSelectedGenome] = useState(null);
    const svgRef = useRef(null);

    // Fetch Genomes
    useEffect(() => {
        const fetchGenomes = async () => {
            try {
                const res = await fetch('/api/lab/genomes?limit=20');
                const data = await res.json();
                if (data.genomes && data.genomes.length > 0) {
                    setGenomes(data.genomes);
                    setSelectedGenome(data.genomes[0]); // Select best by default
                }
            } catch (err) {
                console.error("Failed to fetch genomes:", err);
            }
        };
        fetchGenomes();
    }, []);

    // Render D3 Graph
    useEffect(() => {
        if (!selectedGenome || !svgRef.current) return;

        // Clear previous graph
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

        // Prepare Data
        const nodes = STATES.map(id => ({ id }));
        const links = [];

        Object.entries(selectedGenome.transitions).forEach(([source, targets]) => {
            Object.entries(targets).forEach(([target, prob]) => {
                if (prob > 0.05) { // Filter low probability noise
                    links.push({ source, target, value: prob });
                }
            });
        });

        // Simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(50));

        // Draw Elements
        const link = svg.append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#0ea5e9") // Cyan-500
            .attr("stroke-opacity", d => d.value) // Opacity based on probability
            .attr("stroke-width", d => d.value * 5);

        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Node Circles
        node.append("circle")
            .attr("r", 20)
            .attr("fill", "#0f172a") // Slate-900
            .attr("stroke", "#0ea5e9")
            .attr("stroke-width", 2);

        // Node Labels
        node.append("text")
            .text(d => d.id)
            .attr("x", 25)
            .attr("y", 5)
            .attr("fill", "#94a3b8") // Slate-400
            .attr("font-size", "12px")
            .attr("font-family", "monospace");

        // Simulation Tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Drag Functions
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

    }, [selectedGenome]);

    return (
        <div className="flex h-full bg-slate-950 text-slate-100 font-sans">

            {/* Sidebar: Genome List */}
            <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-cyan-500">🧬</span> Evolutionary Lab
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Observing Generation {genomes.length > 0 ? genomes[0].generation : 0}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {genomes.map(genome => (
                        <div
                            key={genome.id}
                            onClick={() => setSelectedGenome(genome)}
                            className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedGenome?.id === genome.id
                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                                }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-mono text-slate-400">Gen {genome.generation}</span>
                                <span className="text-xs font-bold text-emerald-400">Fit: {Math.round(genome.fitness || 0)}</span>
                            </div>
                            <div className="text-xs text-slate-500 truncate font-mono">{genome.id.split('-').pop()}</div>

                            {/* Mini Phenotype Preview */}
                            <div className="mt-2 flex gap-1 overflow-hidden opacity-50">
                                {genome.phenotype?.slice(0, 5).map((step, i) => (
                                    <div key={i} className="w-1 h-3 rounded-full bg-slate-600" title={step}></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main: Visualization */}
            <div className="flex-1 relative overflow-hidden">

                {/* Header Overlay */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Genome Visualization</h1>
                    <p className="text-slate-400 text-sm">Markov Chain Probability Matrix</p>
                </div>

                {/* D3 Container */}
                <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>

                {/* Legend/Info */}
                <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-700 p-4 rounded-lg max-w-xs text-xs text-slate-400">
                    <h3 className="text-white font-bold mb-2">Structure Analysis</h3>
                    <p className="mb-2">
                        Thicker lines indicate higher transition probability.
                        This genome favors <span className="text-cyan-400">L1 &rarr; L3</span> transitions,
                        optimizing for semantic recall over raw LLM calls.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <span>High Probability</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500/20"></div>
                        <span>Low Probability</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
