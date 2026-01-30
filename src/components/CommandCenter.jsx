import React, { useState, useEffect, useRef } from 'react';
import { useSector } from '../context/SectorContext';
import './CommandCenter.css';
import SurgePricingWidget from './SurgePricingWidget';
import ShopperSegmentationWidget from './ShopperSegmentationWidget';

/**
 * Command Center - Futuristic Dashboard
 * Star Trek-inspired control panel with visual controls
 */
export default function CommandCenter({ onOpenWizard, onNewPipeline, onOpenIntelligence, pipelines = [] }) {
  const { sector } = useSector();
  const canvasRef = useRef(null);
  const [stats, setStats] = useState({
    totalPipelines: 0,
    activePipelines: 0,
    monthlySavings: 0,
    cacheHitRate: 87,
    avgLatency: 52,
    requestsPerSec: 1247
  });

  // Advanced particle system animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 80;
    const connectionDistance = 150;

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.3;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      drawConnections();
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

  useEffect(() => {
    // Calculate stats from pipelines
    const active = pipelines.filter(p => p.isActive).length;
    const total = pipelines.length;
    const savings = pipelines.reduce((sum, p) => {
      const match = p.estimatedSavings?.match(/\$?([\d,]+)/);
      return sum + (match ? parseInt(match[1].replace(/,/g, '')) : 0);
    }, 0);

    setStats({
      totalPipelines: total,
      activePipelines: active,
      monthlySavings: savings,
      cacheHitRate: 87 + Math.floor(Math.random() * 8), // Simulate
      avgLatency: 48 + Math.floor(Math.random() * 10), // Simulate
      requestsPerSec: 1200 + Math.floor(Math.random() * 300) // Simulate
    });
  }, [pipelines]);

  return (
    <div className="command-center pro">
      {/* Advanced Canvas Background */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Gradient Overlay */}
      <div className="canvas-overlay" />

      {/* Header Section */}
      <div className="command-header">
        <div className="header-left">
          <h1 className="command-title">
            <span className="title-icon">⚡</span>
            AgentCache Control
          </h1>
          <p className="subtitle">
            {sector ? `${sector.charAt(0).toUpperCase() + sector.slice(1)} sector` : 'Multi-sector'} •
            Intelligent inference orchestration
          </p>
        </div>

        <div className="header-right">
          <div className="system-status">
            <div className="pulse-indicator"></div>
            <span className="status-text">Operational</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label">Hit rate</div>
          <div className="kpi-value">{stats.cacheHitRate}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">P95 latency</div>
          <div className="kpi-value">{stats.avgLatency}ms</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly savings</div>
          <div className="kpi-value">${stats.monthlySavings.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Throughput</div>
          <div className="kpi-value">{stats.requestsPerSec.toLocaleString()} req/s</div>
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="control-grid">

        {/* Quick Launch Panel */}
        <div className="control-panel launch-panel">
          <div className="panel-header">
            <h3>Quick actions</h3>
            <div className="panel-indicator"></div>
          </div>

          <div className="launch-controls">
            <button className="launch-btn primary-launch" onClick={onOpenWizard}>
              <div className="btn-glow"></div>
              <div className="btn-content">
                <span className="btn-icon">🪄</span>
                <span className="btn-label">AI PIPELINE WIZARD</span>
                <span className="btn-sublabel">Generate pipeline in 30 seconds</span>
              </div>
              <div className="btn-pulse"></div>
            </button>

            <button className="launch-btn secondary-launch" onClick={onNewPipeline}>
              <div className="btn-content">
                <span className="btn-icon">⚙️</span>
                <span className="btn-label">CUSTOM BUILDER</span>
                <span className="btn-sublabel">Build from scratch</span>
              </div>
            </button>

            <button className="launch-btn secondary-launch" onClick={onOpenIntelligence} style={{ marginTop: '10px', borderColor: 'cyan', color: 'cyan' }}>
              <div className="btn-content">
                <span className="btn-icon">🧠</span>
                <span className="btn-label">SEMANTIC SHADOW</span>
                <span className="btn-sublabel">Visualize Threat Intelligence</span>
              </div>
            </button>
          </div>
        </div>

        {/* System Metrics */}
        <div className="control-panel metrics-panel">
          <div className="panel-header">
            <h3>Overview</h3>
            <div className="panel-indicator"></div>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">🚀</div>
              <div className="metric-value">{stats.totalPipelines}</div>
              <div className="metric-label">Total Pipelines</div>
              <div className="metric-bar">
                <div className="bar-fill" style={{ width: `${(stats.totalPipelines / 10) * 100}%` }}></div>
              </div>
            </div>

            <div className="metric-card active">
              <div className="metric-icon">✅</div>
              <div className="metric-value">{stats.activePipelines}</div>
              <div className="metric-label">Active</div>
              <div className="metric-bar">
                <div className="bar-fill" style={{ width: `${(stats.activePipelines / stats.totalPipelines) * 100 || 0}%` }}></div>
              </div>
            </div>

            <div className="metric-card savings">
              <div className="metric-icon">💰</div>
              <div className="metric-value">${stats.monthlySavings.toLocaleString()}</div>
              <div className="metric-label">Monthly Savings</div>
              <div className="metric-bar">
                <div className="bar-fill" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Gauges */}
        <div className="control-panel gauges-panel">
          <div className="panel-header">
            <h3>Performance</h3>
            <div className="panel-indicator"></div>
          </div>

          <div className="gauges-grid">
            <div className="gauge">
              <div className="gauge-display">
                <svg viewBox="0 0 200 120" className="gauge-svg">
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="20"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#cacheGradient)"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeDasharray={`${stats.cacheHitRate * 2.51} 251`}
                    className="gauge-arc"
                  />
                  <defs>
                    <linearGradient id="cacheGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <text x="100" y="80" textAnchor="middle" className="gauge-value">{stats.cacheHitRate}%</text>
                </svg>
              </div>
              <div className="gauge-label">Cache Hit Rate</div>
            </div>

            <div className="gauge">
              <div className="gauge-display">
                <svg viewBox="0 0 200 120" className="gauge-svg">
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="20"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#latencyGradient)"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeDasharray={`${(100 - (stats.avgLatency / 100 * 100)) * 2.51} 251`}
                    className="gauge-arc"
                  />
                  <defs>
                    <linearGradient id="latencyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <text x="100" y="80" textAnchor="middle" className="gauge-value">{stats.avgLatency}ms</text>
                </svg>
              </div>
              <div className="gauge-label">Avg Latency (P95)</div>
            </div>
          </div>
        </div>

        {/* Surge Pricing Monitor */}
        <SurgePricingWidget />

        {/* Shopper Segmentation */}
        <ShopperSegmentationWidget />

        {/* Quick Stats */}
        <div className="control-panel quick-stats">
          <div className="panel-header">
            <h3>Operations</h3>
            <div className="panel-indicator pulsing"></div>
          </div>

          <div className="stats-list">
            <div className="stat-item">
              <span className="stat-dot active"></span>
              <span className="stat-text">System Health: </span>
              <span className="stat-badge success">OPTIMAL</span>
            </div>
            <div className="stat-item">
              <span className="stat-dot active"></span>
              <span className="stat-text">Edge Nodes: </span>
              <span className="stat-badge info">20 ONLINE</span>
            </div>
            <div className="stat-item">
              <span className="stat-dot active"></span>
              <span className="stat-text">Requests/sec: </span>
              <span className="stat-badge">1,247</span>
            </div>
            <div className="stat-item">
              <span className="stat-dot active"></span>
              <span className="stat-text">Uptime: </span>
              <span className="stat-badge success">99.97%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Hint */}
      {stats.totalPipelines === 0 && (
        <div className="floating-hint">
          <div className="hint-content">
            <div className="hint-icon">👆</div>
            <div className="hint-text">
              <strong>Get Started</strong>
              <p>Click "AI Pipeline Wizard" to create your first intelligent caching pipeline</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
