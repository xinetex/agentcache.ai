
import React, { useCallback, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';

const ShadowGraph = ({ nodes, links, onNodeClick }) => {
    const fgRef = useRef();

    const handleNodeClick = useCallback(node => {
        // Aim at node from outside it
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        fgRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
        );

        if (onNodeClick) onNodeClick(node);
    }, [fgRef, onNodeClick]);

    return (
        <ForceGraph3D
            ref={fgRef}
            graphData={{ nodes, links }}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            nodeResolution={16}
            enableNodeDrag={false}
            onNodeClick={handleNodeClick}
            backgroundColor="#000011"
            linkOpacity={0.2}
            linkWidth={1}
            nodeThreeObjectExtend={true}
            nodeThreeObject={node => {
                // Show text label only on hover or high importance?
                // For now, let's keep it clean, maybe just a SpriteText for high risk?
                if (node.val > 5) {
                    const sprite = new SpriteText(node.group);
                    sprite.color = node.color;
                    sprite.textHeight = 4;
                    return sprite;
                }
                return null;
            }}
        />
    );
};

export default ShadowGraph;
