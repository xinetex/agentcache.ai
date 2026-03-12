/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float, Text, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * DriftPoint - Represents a single drift event in 3D space
 */
function DriftPoint({ event, index, total, isSelected, onSelect }) {
  const mesh = useRef();
  
  // Project high-dim vector to 3D (Simple projection for visualization)
  const pos = useMemo(() => {
    if (!event.storedVector || event.storedVector.length < 3) {
      // Fallback: Random spiral if vector data is missing
      const phi = Math.acos(-1 + (2 * index) / total);
      const theta = Math.sqrt(total * Math.PI) * phi;
      return [
        Math.cos(theta) * Math.sin(phi) * 5,
        Math.sin(theta) * Math.sin(phi) * 5,
        Math.cos(phi) * 5
      ];
    }
    // Simple projection: sum sections or take first 3
    return [
      event.storedVector[0] * 10,
      event.storedVector[1] * 10,
      event.storedVector[2] * 10
    ];
  }, [event, index, total]);

  const color = useMemo(() => {
    if (event.status === 'dead') return '#ef4444'; // Red
    if (event.status === 'decaying') return '#f59e0b'; // Amber
    return '#06b6d4'; // Cyan
  }, [event.status]);

  useFrame((state) => {
    if (mesh.current) {
      const time = state.clock.getElapsedTime();
      mesh.current.position.y = pos[1] + Math.sin(time + index) * 0.1;
      mesh.current.scale.setScalar((isSelected ? 1.5 : 1) + Math.sin(time * 2 + index) * 0.2);
    }
  });

  return (
    <group position={pos}>
      <mesh 
        ref={mesh} 
        onClick={(e) => {
          e.stopPropagation();
          onSelect(event);
        }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={2} 
        />
      </mesh>
      
      {/* Label for high drift */}
      {event.drift > 0.15 && (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <Text
            position={[0, 0.3, 0]}
            fontSize={0.15}
            color={color}
            font="https://fonts.gstatic.com/s/outfit/v11/Q8bc8vV6nx0z72u1D6pY.woff"
          >
            DRIFT: {(event.drift * 100).toFixed(1)}%
          </Text>
        </Float>
      )}

      {/* Vector Delta (Connection to Fresh Position) */}
      {event.freshVector && (
        <line>
          <bufferGeometry>
            <float32BufferAttribute 
              attach="attributes-position" 
              count={2} 
              array={new Float32Array([
                0, 0, 0,
                (event.freshVector[0] - event.storedVector[0]) * 10,
                (event.freshVector[1] - event.storedVector[1]) * 10,
                (event.freshVector[2] - event.storedVector[2]) * 10
              ])} 
              itemSize={3} 
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.4} />
        </line>
      )}
    </group>
  );
}

/**
 * TopographyGrid - The base manifold
 */
function TopographyGrid() {
  const mesh = useRef();
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    mesh.current.rotation.z = time * 0.05;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[20, 20, 50, 50]} />
      <meshStandardMaterial 
        wireframe 
        color="#1e293b" 
        transparent 
        opacity={0.1} 
      />
    </mesh>
  );
}

/**
 * DriftTopography Main Component
 */
export default function DriftTopography({ active = true }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [healing, setHealing] = useState(false);
  const maxEvents = 100;

  useEffect(() => {
    if (!active) return;

    setStatus('connecting');
    const source = new EventSource('/api/cognitive/stream');

    source.onopen = () => {
      setStatus('live');
      console.log('[DriftTopography] Stream connected');
    };

    source.addEventListener('drift_detected', (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => [...prev.slice(-(maxEvents - 1)), data]);
      } catch (err) {
        console.error('[DriftTopography] Parse error', err);
      }
    });

    source.onerror = (err) => {
      console.error('[DriftTopography] Stream error', err);
      setStatus('reconnecting');
    };

    return () => source.close();
  }, [active]);

  const handleHeal = async (strategy) => {
    if (!selectedEvent || healing) return;
    setHealing(true);
    try {
      const res = await fetch('/api/cognitive/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEvent.id, strategy })
      });
      const result = await res.json();
      console.log('[DriftTopography] Heal result:', result);
      if (result.success) {
        // Optimistically update status
        setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, status: 'healthy', drift: 0 } : e));
        setSelectedEvent(null);
      }
    } catch (err) {
      console.error('[DriftTopography] Heal failed', err);
    } finally {
      setHealing(false);
    }
  };

  return (
    <div className="drift-topography-container" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 0 }}>
      {/* HUD Info Overlay */}
      <div style={{ position: 'absolute', top: 80, left: 20, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: '10px', color: '#06b6d4', fontMono: 'true', marginBottom: '4px' }}>
          CHRONO-DRIFT TOPOGRAPHY LENS
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', borderLeft: '2px solid #06b6d4', padding: '10px', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{events.length}</div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Latent Samples</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.6)', borderLeft: '2px solid #ef4444', padding: '10px', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
              {events.filter(e => e.status !== 'healthy').length}
            </div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Rot Detected</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.6)', borderLeft: `2px solid ${status === 'live' ? '#0f0' : '#f00'}`, padding: '10px', backdropFilter: 'blur(5px)' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{status.toUpperCase()}</div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Stream Uplink</div>
          </div>
        </div>
      </div>

      {/* Selected Event Detail / Heal Controller */}
      {selectedEvent && (
        <div style={{ 
          position: 'absolute', 
          bottom: 40, 
          right: 40, 
          zIndex: 20, 
          width: '300px',
          background: 'rgba(10, 15, 25, 0.9)', 
          border: '1px solid #1e293b',
          borderTop: '4px solid #f59e0b',
          padding: '20px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: 'white'
        }}>
          <div style={{ fontSize: '9px', color: '#666', marginBottom: '8px', letterSpacing: '1px' }}>LATENT ANOMALY DETECTED</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>Memory Node: {selectedEvent.id.slice(0, 8)}...</div>
          <div style={{ fontSize: '12px', color: selectedEvent.status === 'dead' ? '#ef4444' : '#f59e0b', marginBottom: '15px' }}>
            STATUS: {selectedEvent.status.toUpperCase()} ({(selectedEvent.drift * 100).toFixed(1)}% Drift)
          </div>
          
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '15px', lineHeight: '1.4', background: 'rgba(0,0,0,0.3)', padding: '8px' }}>
            <i>"The manifold is warping in this region. This node threatens reasoning integrity."</i>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button 
              onClick={() => handleHeal('drop')}
              disabled={healing}
              style={{
                background: 'transparent',
                border: '1px solid #06b6d4',
                color: '#06b6d4',
                padding: '8px',
                fontSize: '10px',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              Re-Embed (Drop)
            </button>
            <button 
              onClick={() => handleHeal('reprompt')}
              disabled={healing}
              style={{
                background: 'transparent',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                padding: '8px',
                fontSize: '10px',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              Antibody Pulse
            </button>
          </div>
          <button 
            onClick={() => setSelectedEvent(null)}
            style={{ width: '100%', marginTop: '10px', background: 'transparent', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer' }}
          >
            CANCEL FOCUS
          </button>
        </div>
      )}

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 5, 12]} fov={35} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <group>
          <TopographyGrid />
          
          {events.map((event, idx) => (
            <DriftPoint 
              key={event.timestamp || idx} 
              event={event} 
              index={idx} 
              total={events.length} 
              isSelected={selectedEvent?.id === event.id}
              onSelect={setSelectedEvent}
            />
          ))}

          {/* Connect trajectory */}
          {events.length > 1 && (
            <line>
              <bufferGeometry>
                <float32BufferAttribute 
                  attach="attributes-position" 
                  count={events.length} 
                  array={new Float32Array(events.flatMap((e, i) => {
                    if (!e.storedVector) return [i * 0.1, 0, 0];
                    return [e.storedVector[0] * 10, e.storedVector[1] * 10, e.storedVector[2] * 10];
                  }))} 
                  itemSize={3} 
                />
              </bufferGeometry>
              <lineBasicMaterial color="#06b6d4" transparent opacity={0.2} />
            </line>
          )}
        </group>

        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={5} 
          maxDistance={30} 
          autoRotate={events.length === 0}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
