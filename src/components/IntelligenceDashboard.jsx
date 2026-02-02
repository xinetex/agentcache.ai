
import React, { useState, useEffect } from 'react';
import ShadowGraph from './ShadowGraph';
import './WorkspaceDashboard.css'; // Reuse existing styles for consistency
import { DiscoveryFeed } from './DiscoveryFeed';

const IntelligenceDashboard = ({ onBack }) => {
    const [data, setData] = useState({ nodes: [], links: [] });
    const [selectedNode, setSelectedNode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ingestInput, setIngestInput] = useState('');

    useEffect(() => {
        fetchGraph();
    }, []);

    const fetchGraph = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/intelligence/graph');
            const json = await res.json();
            // Add randomness for demo if no links exist
            // In production, links would come from shared attributes
            setData(json);
        } catch (err) {
            console.error("Failed to fetch graph:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleIngest = async () => {
        if (!ingestInput) return;
        try {
            await fetch('/api/intelligence/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banner: ingestInput })
            });
            setIngestInput('');
            fetchGraph(); // Refresh
            alert('Banner ingested! Analysis might take a few seconds.');
        } catch (err) {
            alert('Ingest failed');
        }
    };

    return (
        <div className="intelligence-dashboard" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>

            {/* HUD Header */}
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, display: 'flex', gap: '10px' }}>
                <button onClick={onBack} className="btn-icon" style={{ background: 'rgba(0,0,0,0.7)', color: 'cyan', border: '1px solid cyan' }}>
                    ⬅ Back
                </button>
                <h1 style={{ margin: 0, color: 'cyan', textShadow: '0 0 10px cyan' }}>SEMANTIC SHADOW</h1>
            </div>

            {/* Ingest Control */}
            <input
                type="text"
                placeholder="Paste Raw Banner..."
                value={ingestInput}
                onChange={e => setIngestInput(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #444', color: 'white', padding: '5px' }}
            />
            <button onClick={handleIngest} style={{ background: 'cyan', color: 'black', fontWeight: 'bold' }}>INGEST</button>
            <button
                onClick={() => window.location.hash = 'exchange'}
                style={{ background: 'transparent', border: '1px solid cyan', color: 'cyan', fontWeight: 'bold', marginLeft: '20px' }}
            >
                MARKETPLACE
            </button>
            {/* Main Graph */}
            <div style={{ width: '100%', height: '100%' }}>
                {!loading && <ShadowGraph nodes={data.nodes} links={data.links} onNodeClick={setSelectedNode} />}
                {loading && <div style={{ color: 'white', position: 'absolute', top: '50%', left: '50%' }}>Loading Neural Uplink...</div>}
            </div>

            {/* Detail Panel */}
            {
                selectedNode && (
                    <div style={{
                        position: 'absolute',
                        top: 80,
                        right: 20,
                        width: '300px',
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid cyan',
                        padding: '20px',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '8px'
                    }}>
                        <h2 style={{ color: selectedNode.color, margin: '0 0 10px 0' }}>{selectedNode.group}</h2>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>Hash: {selectedNode.id.slice(0, 12)}...</div>
                        <div style={{ margin: '10px 0', borderTop: '1px solid #333' }}></div>

                        <div style={{ marginBottom: '10px' }}>
                            <strong>Risk Score:</strong> <span style={{ color: selectedNode.color, fontWeight: 'bold' }}>{selectedNode.val - 1}/10</span>
                        </div>

                        <p style={{ fontSize: '14px', lineHeight: '1.4' }}>
                            {selectedNode.desc || "Analysis pending..."}
                        </p>

                        <button onClick={() => setSelectedNode(null)} style={{ marginTop: '10px', width: '100%', background: '#333', border: 'none', color: 'white', padding: '5px' }}>Close</button>
                    </div>
                )
            }

        </div >
    );
};

export default IntelligenceDashboard;
