import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Stars } from '@react-three/drei';

function SecureNode({ position, color }) {
    const mesh = useRef();
    useFrame((state) => {
        mesh.current.rotation.x = state.clock.getElapsedTime() * 0.5;
        mesh.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    });

    return (
        <mesh position={position} ref={mesh}>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
            <pointLight distance={5} intensity={2} color={color} />
        </mesh>
    );
}

function DataStream({ start, end }) {
    // Simplified beam effect - in a real app this would be a shader or moving particles
    // For now, just a line connecting nodes
    return (
        <line>
            <bufferGeometry>
                <float32BufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#0ea5e9" transparent opacity={0.3} linewidth={1} />
        </line>
    )
}

function Shield() {
    const mesh = useRef();
    useFrame((state) => {
        mesh.current.rotation.z = state.clock.getElapsedTime() * 0.1;
    });

    return (
        <Sphere args={[2.8, 64, 64]} ref={mesh}>
            <MeshDistortMaterial
                color="#3b82f6"
                attach="material"
                distort={0.3}
                speed={2}
                roughness={0}
                transparent
                opacity={0.1}
                wireframe
            />
        </Sphere>
    );
}

function Core() {
    return (
        <Sphere args={[1.5, 64, 64]}>
            <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
        </Sphere>
    )
}

export default function Sentinel3D() {
    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
            <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />

                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <group rotation={[0, 0, Math.PI / 4]}>
                    <Core />
                    <Shield />

                    {/* Secure Nodes (US-EAST, US-WEST, etc) */}
                    <SecureNode position={[2, 0, 0]} color="#0ea5e9" />
                    <SecureNode position={[-2, 0, 0]} color="#0ea5e9" />
                    <SecureNode position={[0, 2, 0]} color="#6366f1" />
                    <SecureNode position={[0, -2, 0]} color="#10b981" />
                    <SecureNode position={[0, 0, 2]} color="#f59e0b" />

                    {/* Connections */}
                    {/* Note: In standard Three.js lines need specific handling, simplified here for React Three Fiber */}
                </group>

                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
            </Canvas>
        </div>
    );
}
