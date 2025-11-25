import React, { useState } from 'react';
import { useSector } from '../context/SectorContext';
import { getPresetsBySector, getRecommendedPresets } from '../config/presets';
import './WorkspaceGallery.css';

/**
 * Workspace Gallery - Like Databricks Solution Accelerators
 * Shows sector-specific preset pipelines with metrics and quick deploy
 */
export default function WorkspaceGallery({ onLoadPreset, onClose }) {
  const { sector } = useSector();
  const [filter, setFilter] = useState('all'); // 'all' | 'recommended'
  
  const allPresets = getPresetsBySector(sector);
  const displayedPresets = filter === 'recommended' 
    ? getRecommendedPresets(sector)
    : allPresets;

  const handleLoadPreset = (preset) => {
    // Convert preset nodes/edges to React Flow format
    const flowNodes = preset.nodes.map((node, idx) => ({
      id: `${node.type}-${idx}`,
      type: node.type,
      position: node.position,
      data: {
        label: node.type.replace(/_/g, ' ').toUpperCase(),
        config: node.config || {},
        metrics: preset.metrics
      }
    }));

    const flowEdges = preset.edges.map((edge, idx) => ({
      id: `edge-${idx}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: true
    }));

    onLoadPreset({
      name: preset.name,
      nodes: flowNodes,
      edges: flowEdges,
      metadata: {
        id: preset.id,
        description: preset.description,
        tier: preset.tier,
        estimatedSavings: preset.estimatedSavings,
        tags: preset.tags,
        useCase: preset.useCase,
        compliance: preset.compliance
      }
    });
  };

  return (
    <div className="workspace-gallery-overlay">
      <div className="workspace-gallery">
        {/* Header */}
        <div className="gallery-header">
          <div className="gallery-title-section">
            <h2>🎯 Pipeline Presets</h2>
            <p className="gallery-subtitle">
              Production-ready pipelines for {sector}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Filter Bar */}
        <div className="gallery-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Templates ({allPresets.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'recommended' ? 'active' : ''}`}
            onClick={() => setFilter('recommended')}
          >
            ⭐ Recommended
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="gallery-grid">
          {displayedPresets.map((preset) => (
            <div key={preset.id} className="preset-card">
              {preset.recommended && (
                <div className="recommended-badge">⭐ Recommended</div>
              )}
              
              <div className="preset-header">
                <span className="preset-icon">{preset.icon}</span>
                <div className="preset-title-section">
                  <h3>{preset.name}</h3>
                  <span className={`tier-badge tier-${preset.tier}`}>
                    {preset.tier}
                  </span>
                </div>
              </div>

              <p className="preset-description">{preset.description}</p>

              {/* Metrics Row */}
              <div className="preset-metrics">
                <div className="metric">
                  <span className="metric-label">Hit Rate</span>
                  <span className="metric-value">
                    {(preset.metrics.hitRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Latency</span>
                  <span className="metric-value">
                    {preset.metrics.latency}ms
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Est. Savings</span>
                  <span className="metric-value savings">
                    {preset.estimatedSavings}
                  </span>
                </div>
              </div>

              {/* Use Case */}
              <div className="preset-use-case">
                <strong>Use Case:</strong> {preset.useCase}
              </div>

              {/* Compliance Badges */}
              {preset.compliance && preset.compliance.length > 0 && (
                <div className="compliance-badges">
                  {preset.compliance.map((comp) => (
                    <span key={comp} className="compliance-badge">
                      {comp}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              <div className="preset-tags">
                {preset.tags.map((tag) => (
                  <span key={tag} className="tag">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <button
                className="load-preset-btn"
                onClick={() => handleLoadPreset(preset)}
              >
                Deploy Pipeline →
              </button>
            </div>
          ))}
        </div>

        {displayedPresets.length === 0 && (
          <div className="no-presets">
            <p>No presets available for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
