/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import ResonanceVisualizer from './ResonanceVisualizer.jsx';
import HypothesisExplorer from './HypothesisExplorer.jsx';

/**
 * AgentDashboard: The final V3 Command Center.
 * 
 * Integrates 3D spatial visualization with cognitive drill-downs
 * and real-time governance monitoring.
 */
export default function AgentDashboard() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    resonanceHits: 0,
    conflictsResolved: 0,
    policiesEnforced: 0,
    activeAgents: 42 // Simulated
  });

  // Simulate Telemetry Stream for the UI Demo
  useEffect(() => {
    const timer = setInterval(() => {
      const types = ['RESONANCE', 'CONFLICT', 'POLICY'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      const newEvent = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        timestamp: Date.now(),
        description: `${type} event detected at ${new Date().toLocaleTimeString()}`,
        metadata: type === 'RESONANCE' ? { score: 0.85 + Math.random() * 0.1, circleId: 'global-1' } :
                  type === 'CONFLICT' ? { winnerId: 'mem_winner_' + Math.floor(Math.random() * 100), utility: 0.92, margin: 0.05 + Math.random() * 0.2, loserCount: 2, escalated: Math.random() > 0.7 } :
                  { policyId: 'ontological-purity', reason: 'Schema mismatch', score: 0, sector: 'FINANCE' }
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 50));
      setStats(prev => ({
        ...prev,
        resonanceHits: prev.resonanceHits + (type === 'RESONANCE' ? 1 : 0),
        conflictsResolved: prev.conflictsResolved + (type === 'CONFLICT' ? 1 : 0),
        policiesEnforced: prev.policiesEnforced + (type === 'POLICY' ? 1 : 0)
      }));
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '20px 40px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AGENTCACHE COMMAND CENTER <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: '400' }}>v3.0 (PHASE 12)</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Resonance Hits</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#51cf66' }}>{stats.resonanceHits}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Governance Blocks</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fa5252' }}>{stats.policiesEnforced}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Cognitive Verdicts</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ec4899' }}>{stats.conflictsResolved}</div>
          </div>
        </div>
      </header>

      <main style={{ padding: '40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          {/* Main Visualization Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
             <section style={{ border: '1px solid #222', borderRadius: '12px', padding: '20px', background: '#0a0a0a' }}>
               <h2 style={{ fontSize: '1rem', color: '#888', marginBottom: '20px', textTransform: 'uppercase' }}>Semantic Resonance Visualizer (3D)</h2>
               <ResonanceVisualizer events={events} />
             </section>
             
             <HypothesisExplorer events={events} />
          </div>

          {/* Activity Log Col */}
          <aside style={{ borderLeft: '1px solid #222', paddingLeft: '30px' }}>
             <h2 style={{ fontSize: '1rem', color: '#888', marginBottom: '20px', textTransform: 'uppercase' }}>Real-Time Telemetry</h2>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '800px', overflowY: 'auto' }}>
               {events.map((e, i) => (
                 <div key={e.id} style={{ 
                   padding: '12px', 
                   background: '#111', 
                   borderRadius: '6px', 
                   borderLeft: `4px solid ${e.type === 'POLICY' ? '#fa5252' : e.type === 'CONFLICT' ? '#ec4899' : '#51cf66'}`,
                   opacity: Math.max(0.3, 1 - i * 0.05)
                 }}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{e.type}</div>
                   <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>{e.description}</div>
                   <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '6px' }}>{new Date(e.timestamp).toLocaleTimeString()}</div>
                 </div>
               ))}
             </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
