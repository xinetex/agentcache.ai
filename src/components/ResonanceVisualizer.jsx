/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * KnowledgeNode: Represents a semantic anchor in the 3D space.
 */
function KnowledgeNode({ position, color, label, size = 0.5 }) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh position={position}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <Text
        position={[position[0], position[1] + size + 0.2, position[2]]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </Float>
  );
}

/**
 * ResonanceLink: An animated line representing a "Knowledge Jump"
 */
function ResonanceLink({ start, end, color }) {
  const ref = useRef();
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.material.dashOffset -= 0.01;
    }
  });

  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  
  return (
    <line ref={ref}>
      <bufferGeometry attach="geometry" setFromPoints={points} />
      <lineDashedMaterial 
        attach="material" 
        color={color} 
        dashSize={0.5} 
        gapSize={0.2} 
        dashOffset={0}
      />
    </line>
  );
}

/**
 * ResonanceVisualizer: The Omnichannel 3D Dashboard.
 */
export default function ResonanceVisualizer({ events = [] }) {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    // Process telemetry events to build the graph
    const newNodes = [];
    const newLinks = [];
    
    // Initial static nodes (Sectors)
    const sectors = ['FINANCE', 'HEALTHCARE', 'LEGAL', 'BIOTECH'];
    sectors.forEach((s, i) => {
      newNodes.push({
        id: s,
        label: s,
        position: [Math.cos(i * 1.5) * 5, 0, Math.sin(i * 1.5) * 5],
        color: s === 'FINANCE' ? '#ffd700' : s === 'HEALTHCARE' ? '#ff6b6b' : s === 'LEGAL' ? '#4dabf7' : '#51cf66'
      });
    });

    // Dynamic Resonance Events
    events.filter(e => e.type === 'RESONANCE').forEach((e, idx) => {
      const targetPos = [Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4];
      newNodes.push({
        id: e.id,
        label: `Resonance Hit: ${e.metadata.score.toFixed(2)}`,
        position: targetPos,
        color: '#ffffff',
        size: 0.2
      });
      
      // Link to the nearest sector node (simulated routing)
      newLinks.push({
        start: [0,0,0], // Center to hit
        end: targetPos,
        color: '#ffffff'
      });
    });

    setNodes(newNodes);
    setLinks(newLinks);
  }, [events]);

  return (
    <div style={{ width: '100%', height: '500px', background: '#0a0a0k', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 10, 20], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={1} />

        {/* Nodes */}
        {nodes.map(node => (
          <KnowledgeNode 
            key={node.id} 
            position={node.position} 
            color={node.color} 
            label={node.label} 
            size={node.size}
          />
        ))}

        {/* Links */}
        {links.map((link, i) => (
          <ResonanceLink key={i} start={link.start} end={link.end} color={link.color} />
        ))}

        {/* Cognitive Core Attractor */}
        <Sphere args={[2, 64, 64]} position={[0, 0, 0]}>
          <MeshDistortMaterial
            color="#ec4899"
            attach="material"
            distort={0.4}
            speed={2}
            roughness={0}
            emissive="#ec4899"
            emissiveIntensity={0.2}
          />
        </Sphere>
        <Text
          position={[0, -2.5, 0]}
          fontSize={0.4}
          color="#ec4899"
          anchorX="center"
          anchorY="middle"
        >
          COGNITIVE CORE
        </Text>

        <OrbitControls enablePan={true} enableZoom={true} makeDefault />
      </Canvas>
    </div>
  );
}
