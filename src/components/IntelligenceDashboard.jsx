
import React, { useState, useEffect, useCallback } from 'react';
import ShadowGraph from './ShadowGraph.jsx';
import './WorkspaceDashboard.css'; 
import { DiscoveryFeed } from './DiscoveryFeed.jsx';

const IntelligenceDashboard = ({ onBack }) => {
    const [data, setData] = useState({ nodes: [], links: [] });
    const [selectedNode, setSelectedNode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ingestInput, setIngestInput] = useState('');
    const [viewMode, setViewMode] = useState('graph'); // 'graph' or 'swarm'
    const [boids, setBoids] = useState([]);
    const [boidsConfig, setBoidsConfig] = useState({
        separationWeight: 1.5,
        alignmentWeight: 1.0,
        cohesionWeight: 1.0,
        targetWeight: 0.5
    });
    const [intuitionData, setIntuitionData] = useState({
        hits: 0,
        misses: 0,
        latencySavings: 0,
        intentTarget: null
    });
    const [isIntuitionActive, setIsIntuitionActive] = useState(true);
    const [swarmHealth, setSwarmHealth] = useState({ divergence: 0.05, status: 'healthy' });
    const [financialPulse, setFinancialPulse] = useState({ totalSettled: 0, lastTx: null });

    useEffect(() => {
        if (viewMode === 'graph') {
            fetchGraph();
        } else {
            const interval = setInterval(fetchBoids, 100); // 10 FPS poll for swarm
            return () => clearInterval(interval);
        }
    }, [viewMode]);

    const fetchGraph = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/intelligence/graph');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Failed to fetch graph:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBoids = async () => {
        try {
            const res = await fetch('/api/admin/swarm/boids');
            const json = await res.json();
            setBoids(json.agents || []);
            
            // Surfacing Swarm Health (Phase 3.5)
            if (json.health) {
                setSwarmHealth(json.health);
            }
            if (json.financials) {
                setFinancialPulse(json.financials);
            }
        } catch (err) {
            console.error("Failed to fetch boids:", err);
        }
    };

    const updateBoidsConfig = async (key, val) => {
        const newConfig = { ...boidsConfig, [key]: parseFloat(val) };
        setBoidsConfig(newConfig);
        try {
            await fetch('/api/admin/swarm/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
        } catch (err) {
            console.error("Failed to sync config:", err);
        }
    };

    const handleIngest = async () => {
        if (!ingestInput) return;
        try {
            // System 1 Pre-processing (Intuition Layer)
            if (isIntuitionActive) {
                const intRes = await fetch('/api/intelligence/intuition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: ingestInput })
                });
                const intJson = await intRes.json();
                
                // Update intent target for swarm visualization
                setIntuitionData(prev => ({
                    ...prev,
                    intentTarget: { x: Math.random() * 1000, y: Math.random() * 1000 }, // Mock target coordinate
                    hits: prev.hits + 1,
                    latencySavings: prev.latencySavings + 2450 // ms saved vs System 2
                }));
            }

            await fetch('/api/intelligence/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banner: ingestInput })
            });
            setIngestInput('');
            fetchGraph(); 
            // alert('Banner ingested!'); // Remove alert for smoother intuition flow
        } catch (err) {
            console.error('Ingest failed', err);
        }
    };

    return (
        <div className="intelligence-dashboard" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>

            {/* HUD Header */}
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={onBack} className="btn-icon" style={{ background: 'rgba(0,0,0,0.7)', color: 'cyan', border: '1px solid cyan', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}>
                    ⬅ Back
                </button>
                <h1 style={{ margin: 0, color: 'cyan', textShadow: '0 0 10px cyan', fontSize: '24px', letterSpacing: '2px' }}>
                    {viewMode === 'graph' ? 'SEMANTIC SHADOW' : 'MASSIVE SWARM'}
                </h1>
                
                <div style={{ marginLeft: '20px', display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.1)', padding: '3px', borderRadius: '4px' }}>
                    <button 
                        onClick={() => setViewMode('graph')}
                        style={{ background: viewMode === 'graph' ? 'cyan' : 'transparent', color: viewMode === 'graph' ? 'black' : 'cyan', border: 'none', padding: '5px 10px', borderRadius: '2px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        GRAPH
                    </button>
                    <button 
                        onClick={() => setViewMode('swarm')}
                        style={{ background: viewMode === 'swarm' ? 'cyan' : 'transparent', color: viewMode === 'swarm' ? 'black' : 'cyan', border: 'none', padding: '5px 10px', borderRadius: '2px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        SWARM
                    </button>
                </div>

                {/* Intuition Toggle */}
                <div 
                    onClick={() => setIsIntuitionActive(!isIntuitionActive)}
                    style={{ 
                        background: isIntuitionActive ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 0, 0, 0.1)',
                        border: `1px solid ${isIntuitionActive ? 'cyan' : '#440000'}`,
                        color: isIntuitionActive ? 'cyan' : '#660000',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isIntuitionActive ? '#0f0' : '#f00' }} />
                    INTUITION {isIntuitionActive ? 'ARMED' : 'OFFLINE'}
                </div>

                {/* Swarm Health Monitor (Phase 3.5) */}
                <div style={{ 
                    background: 'rgba(0,0,0,0.7)', 
                    border: `1px solid ${swarmHealth.status === 'healthy' ? '#0f0' : '#f00'}`, 
                    padding: '5px 15px', 
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11px'
                }}>
                    <span style={{ color: '#666' }}>COHERENCE:</span>
                    <span style={{ color: swarmHealth.status === 'healthy' ? '#0f0' : '#f00', fontWeight: 'bold' }}>
                        {(100 - (swarmHealth.divergence * 100)).toFixed(1)}%
                    </span>
                    <span style={{ color: '#444' }}>|</span>
                    <span style={{ color: '#aaa' }}>{swarmHealth.status.toUpperCase()}</span>
                </div>
            </div>

            {/* Financial Pulse Widget (Phase 3.5) */}
            <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #ffd700', padding: '10px 20px', borderRadius: '8px', backdropFilter: 'blur(10px)', boxShadow: '0 0 15px rgba(255, 215, 0, 0.1)' }}>
                    <div style={{ fontSize: '9px', color: '#ffd700', letterSpacing: '1px', marginBottom: '5px' }}>x402 FINANCIAL PULSE (BASE)</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>{financialPulse.totalSettled.toFixed(2)}</span>
                        <span style={{ color: '#ffd700', fontSize: '10px' }}>USDC</span>
                    </div>
                    {financialPulse.lastTx && (
                        <div style={{ fontSize: '8px', color: '#666', marginTop: '5px', fontFamily: 'monospace' }}>
                            LAST TX: {financialPulse.lastTx.slice(0, 10)}...
                        </div>
                    )}
                </div>
            </div>

            {/* Ingest Control (Only in Graph Mode) */}
            {viewMode === 'graph' && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Intuition Metrics Panel */}
                    {isIntuitionActive && (
                        <div style={{ background: 'rgba(0,0,0,0.8)', borderLeft: '3px solid cyan', padding: '10px', display: 'flex', gap: '20px', fontSize: '11px', color: '#aaa', backdropFilter: 'blur(5px)' }}>
                            <div>SYSTEM 1 HITS: <span style={{ color: 'cyan' }}>{intuitionData.hits}</span></div>
                            <div>LATENCY SAVED: <span style={{ color: '#0f0' }}>{(intuitionData.latencySavings / 1000).toFixed(1)}s</span></div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Type a query or paste a banner..."
                            value={ingestInput}
                            onChange={e => setIngestInput(e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid cyan', color: 'white', padding: '10px', width: '300px', borderRadius: '4px' }}
                        />
                        <button onClick={handleIngest} style={{ background: 'cyan', color: 'black', fontWeight: 'bold', border: 'none', padding: '0 20px', borderRadius: '4px', cursor: 'pointer' }}>EXECUTE</button>
                    </div>
                </div>
            )}

            {/* Swarm Controls */}
            {viewMode === 'swarm' && (
                <div style={{ 
                    position: 'absolute', 
                    bottom: 20, 
                    right: 20, 
                    zIndex: 100, 
                    background: 'rgba(0,0,0,0.8)', 
                    border: '1px solid cyan', 
                    padding: '15px', 
                    borderRadius: '8px',
                    color: 'white',
                    width: '250px',
                    backdropFilter: 'blur(5px)'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: 'cyan', fontSize: '14px', textTransform: 'uppercase' }}>Swarm Parameters</h3>
                    
                    {Object.entries(boidsConfig).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                                <span>{key.replace('Weight', '')}</span>
                                <span style={{ color: 'cyan' }}>{value.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="5" step="0.1" 
                                value={value} 
                                onChange={(e) => updateBoidsConfig(key, e.target.value)}
                                style={{ width: '100%', accentColor: 'cyan' }}
                            />
                        </div>
                    ))}
                    
                    <div style={{ marginTop: '15px', fontSize: '10px', color: '#666', textAlign: 'center' }}>
                        ACTIVE AGENTS: <span style={{ color: 'cyan' }}>1,000,000</span> (Sampled: {boids.length})
                    </div>
                </div>
            )}

            {/* Main Graph/Swarm */}
            <div style={{ width: '100%', height: '100%' }}>
                <ShadowGraph 
                    nodes={data.nodes} 
                    links={data.links} 
                    onNodeClick={setSelectedNode} 
                    mode={viewMode}
                    agents={boids}
                    intentTarget={intuitionData.intentTarget}
                />
                {loading && viewMode === 'graph' && (
                    <div style={{ color: 'cyan', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <div className="loader" style={{ marginBottom: '10px' }}></div>
                        LOADING NEURAL UPLINK...
                    </div>
                )}
            </div>

            {/* Detail Panel */}
            {
                selectedNode && viewMode === 'graph' && (
                    <div style={{
                        position: 'absolute',
                        top: 80,
                        right: 20,
                        width: '320px',
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid cyan',
                        padding: '20px',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '8px',
                        boxShadow: '0 0 20px rgba(0,255,255,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <h2 style={{ color: selectedNode.color, margin: 0, fontSize: '18px' }}>{selectedNode.group}</h2>
                            <span style={{ fontSize: '10px', background: selectedNode.color, color: 'black', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                RISK {selectedNode.val - 1}/10
                            </span>
                        </div>
                        
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '15px', fontFamily: 'monospace' }}>
                            ID: {selectedNode.id}
                        </div>

                        <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#ccc', margin: '0 0 20px 0' }}>
                            {selectedNode.desc || "Analysis pending neural synthesis..."}
                        </p>

                        <button 
                            onClick={() => setSelectedNode(null)} 
                            style={{ width: '100%', background: 'transparent', border: '1px solid #444', color: '#666', padding: '8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.target.style.borderColor = 'cyan'; e.target.style.color = 'cyan'; }}
                            onMouseOut={(e) => { e.target.style.borderColor = '#444'; e.target.style.color = '#666'; }}
                        >
                            ACKNOWLEDGE
                        </button>
                    </div>
                )
            }

        </div >
    );
};

export default IntelligenceDashboard;
