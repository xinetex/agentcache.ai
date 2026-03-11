
import React from 'react';

const SavingsDashboard = ({ stats, health }) => {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            color: 'white',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
            maxWidth: '400px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, letterSpacing: '1px', color: '#888', textTransform: 'uppercase' }}>
                    Swarm Economic Pulse
                </h3>
                <div style={{ 
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '10px', 
                    fontWeight: 800,
                    background: health.status === 'healthy' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                    color: health.status === 'healthy' ? '#0f0' : '#f00',
                    border: `1px solid ${health.status === 'healthy' ? '#0f03' : '#f003'}`
                }}>
                    {health.status.toUpperCase()}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>EST. SAVINGS (USD)</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>
                        ${stats.totalSavingsUsd?.toFixed(2) || '0.00'}
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>COHERENCE INDEX</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#0ff' }}>
                        {((1 - (health.divergenceScore || 0)) * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ color: '#888' }}>Reasoning Hits (L2)</span>
                    <span style={{ color: '#fff' }}>{stats.hits || 0}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${Math.min((stats.hits / 1000) * 100, 100)}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #0ff, #00f)',
                        boxShadow: '0 0 10px #0ff'
                    }}></div>
                </div>
            </div>

            {health.intuitionDrift && (
                <div style={{ 
                    background: 'rgba(255, 100, 0, 0.1)', 
                    border: '1px solid rgba(255, 100, 0, 0.3)', 
                    padding: '8px 12px', 
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#ff6400',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>⚠️</span>
                </div>
            )}

            <div style={{ 
                marginTop: '12px',
                paddingTop: '16px', 
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: (maintenance?.activeAgents || 0) > 0 ? '#0f0' : '#444',
                        boxShadow: (maintenance?.activeAgents || 0) > 0 ? '0 0 8px #0f0' : 'none',
                        animation: (maintenance?.activeAgents || 0) > 0 ? 'pulse 2s infinite' : 'none'
                    }} />
                    <span style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>
                        {maintenance?.activeAgents || 0} ACTIVE MAINTENANCE AGENTS
                    </span>
                </div>
                <div style={{ fontSize: '11px', color: '#0f0', fontWeight: 700 }}>
                    {maintenance?.heals || 0} HEALS
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
};

export default SavingsDashboard;
