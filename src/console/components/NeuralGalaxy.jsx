import React, { useEffect, useState, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Activity } from 'lucide-react';

const NeuralGalaxy = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const fgRef = useRef();

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const res = await fetch('/api/galaxy');
                const data = await res.json();
                if (data && data.nodes) {
                    setGraphData(data);
                }
            } catch (err) {
                console.error("Failed to fetch galaxy data:", err);
            }
        };

        fetchGraph();
        const interval = setInterval(fetchGraph, 10000); // Refresh every 10s

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-full relative bg-black rounded overflow-hidden">
            {graphData.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="text-[var(--hud-accent)] animate-pulse flex flex-col items-center">
                        <Activity size={32} className="mb-2" />
                        <span className="font-mono text-xs">INITIALIZING NEURAL LINK...</span>
                    </div>
                </div>
            )}

            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeColor={node => node.group === 'agent' ? '#00f3ff' : '#bd00ff'}
                nodeVal={node => node.val}
                linkColor={() => 'rgba(255,255,255,0.2)'}
                backgroundColor="#000000"
                showNavInfo={false}
                enableNodeDrag={false}
                onNodeClick={node => {
                    // Aim at node on click
                    const distance = 40;
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

                    fgRef.current.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                        node, // lookAt ({ x, y, z })
                        3000  // ms transition duration
                    );
                }}
            />

            <div className="absolute bottom-4 left-4 pointer-events-none">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--hud-text-dim)]">
                    <span className="w-2 h-2 rounded-full bg-[#00f3ff]"></span> AGENT
                    <span className="w-2 h-2 rounded-full bg-[#bd00ff] ml-2"></span> KNOWLEDGE
                </div>
            </div>
        </div>
    );
};

export default NeuralGalaxy;
