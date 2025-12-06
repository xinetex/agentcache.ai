import React, { useEffect, useState, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Activity, Radio } from 'lucide-react';

const NeuralGalaxy = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [simulationMode, setSimulationMode] = useState(false);
    const fgRef = useRef();
    const rotationRef = useRef(0);

    // Initial Data Fetch
    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const res = await fetch('/api/galaxy');
                const data = await res.json();

                if (data.simulation) {
                    setSimulationMode(true);
                }

                if (data && data.nodes) {
                    setGraphData(data);
                }
            } catch (err) {
                console.error("Failed to fetch galaxy data:", err);
            }
        };

        fetchGraph();
        const interval = setInterval(fetchGraph, 10000); // Poll for updates

        return () => clearInterval(interval);
    }, []);

    // Auto-Rotation Effect
    useEffect(() => {
        const rotate = () => {
            if (fgRef.current) {
                rotationRef.current += 0.003; // Rotation speed
                const angle = rotationRef.current;
                const distance = 800; // Camera distance

                fgRef.current.cameraPosition({
                    x: distance * Math.sin(angle),
                    z: distance * Math.cos(angle)
                });
            }
            requestAnimationFrame(rotate);
        };
        rotate();
    }, []);

    const getNodeColor = (node) => {
        switch (node.group) {
            case 'start': return '#ef4444'; // Red
            case 'core': return '#ffffff'; // White
            case 'sector': return '#f59e0b'; // Amber
            case 'agent': return '#00f3ff'; // Cyan
            case 'knowledge': return '#a855f7'; // Purple
            default: return '#64748b'; // Slate
        }
    };

    return (
        <div className="w-full h-full relative bg-black/50 rounded overflow-hidden cursor-move">
            {/* Overlay UI */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <div className="flex items-center gap-2">
                    <Activity size={20} className="text-[var(--hud-accent)]" />
                    <h2 className="text-lg font-bold text-white tracking-widest">NEURAL LATTICE_</h2>
                </div>
                {simulationMode && (
                    <div className="inline-flex items-center gap-2 bg-[rgba(255,165,0,0.1)] border border-orange-500/50 px-2 py-1 rounded mt-1">
                        <Radio size={12} className="text-orange-500 animate-pulse" />
                        <span className="text-[10px] text-orange-400 font-mono">SIMULATION MODE</span>
                    </div>
                )}
            </div>

            {/* Empty State / Loading */}
            {graphData.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[var(--hud-text-dim)] font-mono animate-pulse">ESTABLISHING UPLINK...</span>
                </div>
            )}

            {/* 3D Graph */}
            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeColor={getNodeColor}
                nodeVal={node => node.val || 5}
                nodeResolution={16} // High detail spheres

                // Links
                linkColor={() => 'rgba(0, 243, 255, 0.15)'}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={() => '#00f3ff'}

                // Environment
                backgroundColor="rgba(0,0,0,0)" // Transparent, let parent BG show through
                showNavInfo={false}
                bloomStrength={1.5}

                // Interaction
                enableNodeDrag={false}
                onNodeClick={node => {
                    const distance = 100;
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

                    fgRef.current.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                        node,
                        3000
                    );
                }}
            />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 pointer-events-none bg-black/60 backdrop-blur p-2 rounded border border-white/10">
                <div className="flex flex-col gap-1 text-[10px] font-mono text-[var(--hud-text-dim)]">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00f3ff] shadow-[0_0_5px_#00f3ff]"></span> AGENT NODE
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#a855f7] shadow-[0_0_5px_#a855f7]"></span> KNOWLEDGE
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_5px_#f59e0b]"></span> SECTOR HUB
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NeuralGalaxy;
