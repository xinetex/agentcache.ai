import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

/**
 * SwarmView: Ultra-high performance rendering for 2000+ agents.
 * Uses Three.js InstancedMesh to keep draw calls at 1.
 */
const SwarmView = ({ agents, intentTarget }) => {
    const meshRef = useRef();
    const intentMeshRef = useRef();
    const count = agents.length;

    // Create a base geometry for agents (small pyramids or dots)
    const geometry = useMemo(() => new THREE.ConeGeometry(1, 4, 4), []);
    const material = useMemo(() => new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x003333 }), []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!meshRef.current) return;

        agents.forEach((agent, i) => {
            // Map 1000x1000 space to Three.js world space
            // Assuming the dashboard provides coordinates in 0-1000 range
            const x = (agent.posX - 500) / 5;
            const y = (agent.posY - 500) / 5;
            const z = 0; // 2D swarm for now

            dummy.position.set(x, y, z);
            
            // Orient towards velocity
            const angle = Math.atan2(agent.velY, agent.velX);
            dummy.rotation.z = angle - Math.PI / 2;
            
            // Scale based on intent
            const s = (agent.intentScore || 0.5) * 2;
            dummy.scale.set(s, s, s);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
            
            // Color based on sectorId or intent
            const color = new THREE.Color().setHSL((agent.sectorId % 10) / 10, 0.8, 0.5);
            meshRef.current.setColorAt(i, color);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [agents, dummy]);

    return (
        <group>
            <instancedMesh ref={meshRef} args={[geometry, material, count]}>
                <coneGeometry args={[0.5, 2, 4]} />
                <meshPhongMaterial color="cyan" />
            </instancedMesh>
            
            {/* Intent Target Visualization */}
            {intentTarget && (
                <mesh position={[(intentTarget.x - 500) / 5, (intentTarget.y - 500) / 5, 5]}>
                    <sphereGeometry args={[2, 16, 16]} />
                    <meshBasicMaterial color="#ff00ff" wireframe />
                </mesh>
            )}
        </group>
    );
};

const ShadowGraph = ({ nodes, links, onNodeClick, mode = 'graph', agents = [], intentTarget = null }) => {
    const fgRef = useRef();

    const handleNodeClick = useCallback(node => {
        if (mode !== 'graph') return;
        
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        fgRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            3000
        );

        if (onNodeClick) onNodeClick(node);
    }, [fgRef, onNodeClick, mode]);

    if (mode === 'swarm') {
        return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <ForceGraph3D
                    ref={fgRef}
                    graphData={{ nodes: [], links: [] }}
                    backgroundColor="#000011"
                    showNavInfo={false}
                    nodeThreeObject={() => new THREE.Object3D()} // Hide nodes
                    linkThreeObject={() => new THREE.Object3D()} // Hide links
                    extraRenderers={[]}
                >
                    {/* Inject InstancedMesh into the Scene */}
                    <SwarmView agents={agents} intentTarget={intentTarget} />
                </ForceGraph3D>
            </div>
        );
    }

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
