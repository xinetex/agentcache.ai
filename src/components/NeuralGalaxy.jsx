import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { DatasetService } from '../services/datasetService';

// "Hero" points - the actual interactive data
function GalaxyPoints({ data, onHover }) {
  const points = useRef();

  const positions = useMemo(() => {
    if (!data || data.length === 0) return { pos: new Float32Array(0), col: new Float32Array(0) };

    const pos = new Float32Array(data.length * 3);
    const col = new Float32Array(data.length * 3);

    const colors = {
      coding: '#00f3ff',
      creative: '#7000ff',
      analysis: '#00ff9d',
      chat: '#ff0055'
    };

    data.forEach((item, i) => {
      const [x, y, z] = item.embedding || [0, 0, 0];
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const c = new THREE.Color(colors[item.category] || '#ffffff');
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });

    return { pos, col };
  }, [data]);

  useFrame(() => {
    if (points.current) {
      points.current.rotation.y += 0.002; // Faster rotation for heroes
    }
  });

  return (
    <points
      ref={points}
      onPointerOver={(e) => {
        e.stopPropagation();
        const index = e.index;
        if (index !== undefined && data[index]) {
          onHover(data[index]);
        }
      }}
      onPointerOut={() => onHover(null)}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.pos.length / 3}
          array={positions.pos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={positions.col.length / 3}
          array={positions.col}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8} // Larger for interactive points
        vertexColors
        transparent
        opacity={1.0}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Background "Dust" - simulates massive dataset
function BackgroundParticles({ count = 5000 }) {
  const points = useRef();

  const particles = useMemo(() => {
    const temp = [];
    const clusters = [
      { color: '#00f3ff', x: 12, y: 4, z: 2 },    // Coding
      { color: '#7000ff', x: -12, y: -4, z: 6 },  // Creative
      { color: '#00ff9d', x: 4, y: -12, z: -6 },  // Analysis
      { color: '#ff0055', x: -6, y: 12, z: 1 },   // Chat
    ];

    for (let i = 0; i < count; i++) {
      const cluster = clusters[Math.floor(Math.random() * clusters.length)];
      // Gaussian-like distribution
      const spread = 6;
      const x = cluster.x + (Math.random() - 0.5) * spread * 2;
      const y = cluster.y + (Math.random() - 0.5) * spread * 2;
      const z = cluster.z + (Math.random() - 0.5) * spread * 2;

      temp.push({ x, y, z, color: cluster.color });
    }
    return temp;
  }, [count]);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    particles.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;

      const c = new THREE.Color(p.color);
      // Dimmer colors for background
      col[i * 3] = c.r * 0.4;
      col[i * 3 + 1] = c.g * 0.4;
      col[i * 3 + 2] = c.b * 0.4;
    });

    return { pos, col };
  }, [particles, count]);

  useFrame(() => {
    if (points.current) {
      points.current.rotation.y += 0.0005; // Slow background rotation
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.pos.length / 3}
          array={positions.pos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={positions.col.length / 3}
          array={positions.col}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2} // Small dust
        vertexColors
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function ClusterLabels() {
  const clusters = [
    { position: [12, 4, 2], label: 'Coding', color: '#00f3ff' },
    { position: [-12, -4, 6], label: 'Creative', color: '#7000ff' },
    { position: [4, -12, -6], label: 'Analysis', color: '#00ff9d' },
    { position: [-6, 12, 1], label: 'Chat', color: '#ff0055' },
  ];

  return (
    <group>
      {clusters.map((c, i) => (
        <Text
          key={i}
          position={c.position}
          fontSize={1.2}
          color={c.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {c.label}
        </Text>
      ))}
    </group>
  );
}

export default function NeuralGalaxy() {
  const [data, setData] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    DatasetService.loadDataset().then(setData);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#030508' }}>
      <Canvas camera={{ position: [0, 0, 35], fov: 60 }}>
        <color attach="background" args={['#030508']} />
        <fog attach="fog" args={['#030508', 20, 80]} />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        {/* Dense background field */}
        <BackgroundParticles count={8000} />

        {/* Interactive Data Points */}
        {data.length > 0 && (
          <GalaxyPoints data={data} onHover={setHoveredItem} />
        )}

        <ClusterLabels />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* Overlay UI */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: 'rgba(0, 243, 255, 0.8)',
        fontFamily: 'Rajdhani, sans-serif',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>Semantic Space</h3>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
          {data.length} Active Nodes • 8,000+ Historical Vectors
        </p>
      </div>

      {/* Tooltip */}
      {hoveredItem && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(6, 11, 20, 0.9)',
          border: `1px solid ${hoveredItem.category === 'coding' ? '#00f3ff' : '#ffffff'}`,
          padding: '15px',
          borderRadius: '8px',
          maxWidth: '300px',
          color: '#fff',
          fontFamily: 'Rajdhani, sans-serif',
          zIndex: 20,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#888', marginBottom: '5px' }}>
            {hoveredItem.category} • {hoveredItem.tokens} tokens
          </div>
          <div style={{ fontSize: '1rem' }}>
            "{hoveredItem.text}"
          </div>
        </div>
      )}
    </div>
  );
}
