
import React, { useState, useEffect, useRef } from 'react';
import { useSector } from '../context/SectorContext';
import { useAgentSystem } from '../hooks/useAgentSystem';
import './CommandCenter.css';

/**
 * Command Center - Agent Economy Control
 * Visualizes the Hive Mind.
 */
export default function CommandCenter({ onOpenWizard, onNewPipeline, onOpenIntelligence, pipelines = [] }) {
  const { sector } = useSector();
  const { agents, decisions, refresh } = useAgentSystem();

  const canvasRef = useRef(null);

  // Calculate System Stats from Real Data
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalAgents = agents.length;
  const recentDecisions = decisions.slice(0, 50);

  // Background Animation (Preserved)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Simple Starfield for performance
    const stars = Array(150).fill().map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      speed: Math.random() * 0.5
    }));

    function animate() {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.2)'; // Trails
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#38bdf8';
      stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="command-center pro">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="canvas-overlay" />

      {/* Header */}
      <div className="command-header">
        <div className="header-left">
          <h1 className="command-title">
            <span className="title-icon">⚡</span>
            Agent Command
          </h1>
          <p className="subtitle">
            Swarm Control • {activeAgents} Active Units • {recentDecisions.length} Decisions/hr
          </p>
        </div>
        <div className="header-right">
          <div className="system-status">
            <div className={`pulse-indicator ${totalAgents > 0 ? 'active' : ''}`}></div>
            <span className="status-text">{totalAgents > 0 ? 'ONLINE' : 'INITIALIZING'}</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={refresh}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label">Active Agents</div>
          <div className="kpi-value">{activeAgents} <span className="text-sm text-gray-400">/ {totalAgents}</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Decisions Logged</div>
          <div className="kpi-value">{decisions.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Treasury</div>
          <div className="kpi-value">$2,450.00</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">System Load</div>
          <div className="kpi-value">12%</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="control-grid">

        {/* Agent Roster */}
        <div className="control-panel agent-roster" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <h3>Active Personnel</h3>
            <div className="panel-indicator"></div>
          </div>
          <div className="agent-grid">
            {agents.length === 0 ? (
              <div className="empty-state">No Agents Deployed. Launch the Flywheel.</div>
            ) : (
              agents.map(agent => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-avatar">{agent.role === 'optimizer' ? '⚡️' : agent.role === 'researcher' ? '🧠' : '🤖'}</div>
                  <div className="agent-info">
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-role">{agent.role.toUpperCase()}</div>
                  </div>
                  <div className={`agent-status status-${agent.status}`}>{agent.status}</div>
                </div>
              ))
            )}

            {/* Hire Button */}
            <div className="agent-card new-agent" onClick={() => alert("Redirecting to Agent Marketplace...")}>
              <div className="agent-avatar">+</div>
              <div className="agent-info">
                <div className="agent-name">Hire Agent</div>
                <div className="agent-role">$25/mo</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="control-panel live-feed" style={{ gridColumn: 'span 1', maxHeight: '500px', overflowY: 'auto' }}>
          <div className="panel-header">
            <h3>Neural Feed</h3>
            <div className="panel-indicator pulsing"></div>
          </div>
          <div className="feed-list">
            {decisions.length === 0 ? (
              <div className="feed-item text-gray-500">Waiting for intelligence...</div>
            ) : (
              decisions.slice(0, 10).map((d, i) => (
                <div key={i} className="feed-item">
                  <span className="feed-time">{new Date(d.timestamp).toLocaleTimeString()}</span>
                  <span className="feed-action">{d.action}</span>
                  <div className="feed-reason">{d.reasoning?.substring(0, 80)}...</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
