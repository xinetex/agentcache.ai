/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import React, { useState } from 'react';

/**
 * HypothesisExplorer: A drill-down UI for the "Cognitive Court".
 */
export default function HypothesisExplorer({ events = [] }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const conflictEvents = events.filter(e => e.type === 'CONFLICT');

  return (
    <div style={{ padding: '20px', background: '#0a0a0a', color: 'white', borderRadius: '12px', border: '1px solid #333' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#ec4899', display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px' }}>⚖️</span> Cognitive Hypothesis Explorer
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Event List */}
        <div style={{ borderRight: '1px solid #222', paddingRight: '20px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '12px' }}>Recent Verdicts</h3>
          {conflictEvents.length === 0 && <p style={{ color: '#555', fontStyle: 'italic' }}>No cognitive conflicts detected yet...</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {conflictEvents.map(e => (
              <li 
                key={e.id}
                onClick={() => setSelectedEvent(e)}
                style={{ 
                  padding: '10px', 
                  marginBottom: '8px', 
                  background: selectedEvent?.id === e.id ? '#1a1a1a' : '#0f0f0f',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: selectedEvent?.id === e.id ? '1px solid #ec4899' : '1px solid #222',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{e.description}</div>
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
                  Margin: {e.metadata.margin.toFixed(4)} | Escalated: {e.metadata.escalated ? 'Yes' : 'No'}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Details Panel */}
        <div>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '12px' }}>Resolution Provenance</h3>
          {selectedEvent ? (
            <div style={{ padding: '15px', background: '#0f0f0f', borderRadius: '8px', border: '1px solid #ec4899' }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>WINNER</div>
                <div style={{ color: '#51cf66', fontWeight: 'bold', wordBreak: 'break-all' }}>{selectedEvent.metadata.winnerId}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>Utility Score: {selectedEvent.metadata.utility.toFixed(4)}</div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>PRESERVED HYPOTHESES</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedEvent.metadata.loserCount} Candidates</div>
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px' }}>
                  These alternative beliefs were not discarded; they remain in the holographic substrate for future verification.
                </p>
              </div>

              <div style={{ paddingTop: '10px', borderTop: '1px solid #222' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>DECISION MARGIN</div>
                <div style={{ 
                  height: '8px', 
                  background: '#222', 
                  borderRadius: '4px', 
                  marginTop: '10px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, selectedEvent.metadata.margin * 100)}%`, 
                    background: selectedEvent.metadata.margin < 0.1 ? '#fa5252' : '#51cf66'
                  }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px', textAlign: 'right' }}>
                   Confidence Delta: {(selectedEvent.metadata.margin * 100).toFixed(1)}%
                </div>
              </div>
              
              {selectedEvent.metadata.escalated && (
                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(236, 72, 153, 0.1)', border: '1px dashed #ec4899', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#ec4899', fontWeight: 'bold' }}>⚖️ MOONSHOT ESCALATION</div>
                  <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                    This conflict was resolved by the Level 2 Cognitive Judge (Moonshot) due to high stakes or narrow utility margin.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#444', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
              Select a verdict to explore the cognitive providence...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
