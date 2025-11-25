import React, { useState, useEffect } from 'react';
import { useSector } from '../context/SectorContext';
import './WorkspaceDashboard.css';

/**
 * Workspace Dashboard - Manage all saved pipelines
 * Like Databricks workspace view with grid of notebooks/pipelines
 */
export default function WorkspaceDashboard({ onLoadPipeline, onNewPipeline }) {
  const { sector } = useSector();
  const [pipelines, setPipelines] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name' | 'savings'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Load pipelines from localStorage
  useEffect(() => {
    loadPipelines();
  }, [sector]);

  const loadPipelines = () => {
    const saved = JSON.parse(localStorage.getItem('savedPipelines') || '[]');
    
    // Filter by current sector
    const sectorPipelines = saved
      .filter(p => p.sector === sector)
      .map(p => ({
        ...p,
        isActive: p.isActive !== undefined ? p.isActive : false,
        estimatedSavings: p.estimatedSavings || calculateEstimatedSavings(p),
        lastModified: p.savedAt || p.lastModified || new Date().toISOString()
      }));

    setPipelines(sectorPipelines);
  };

  const calculateEstimatedSavings = (pipeline) => {
    // Simple heuristic based on node count
    const cacheNodes = pipeline.nodes.filter(n => 
      n.type?.includes('cache') || n.id?.includes('cache')
    ).length;
    return `$${(cacheNodes * 800 + 400).toLocaleString()}/mo`;
  };

  const togglePipelineStatus = (pipelineName) => {
    const saved = JSON.parse(localStorage.getItem('savedPipelines') || '[]');
    const updated = saved.map(p => {
      if (p.name === pipelineName && p.sector === sector) {
        return { ...p, isActive: !p.isActive };
      }
      return p;
    });
    localStorage.setItem('savedPipelines', JSON.stringify(updated));
    loadPipelines();
  };

  const deletePipeline = (pipelineName) => {
    if (!confirm(`Delete pipeline "${pipelineName}"? This cannot be undone.`)) {
      return;
    }
    const saved = JSON.parse(localStorage.getItem('savedPipelines') || '[]');
    const updated = saved.filter(p => !(p.name === pipelineName && p.sector === sector));
    localStorage.setItem('savedPipelines', JSON.stringify(updated));
    loadPipelines();
  };

  const duplicatePipeline = (pipeline) => {
    const saved = JSON.parse(localStorage.getItem('savedPipelines') || '[]');
    const copy = {
      ...pipeline,
      name: `${pipeline.name} (Copy)`,
      savedAt: new Date().toISOString(),
      isActive: false
    };
    saved.push(copy);
    localStorage.setItem('savedPipelines', JSON.stringify(saved));
    loadPipelines();
  };

  // Filter and sort pipelines
  const getFilteredPipelines = () => {
    let filtered = [...pipelines];

    // Apply filter
    if (filter === 'active') {
      filtered = filtered.filter(p => p.isActive);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(p => !p.isActive);
    }

    // Apply sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'savings') {
      filtered.sort((a, b) => {
        const aVal = parseInt(a.estimatedSavings.replace(/[^0-9]/g, ''));
        const bVal = parseInt(b.estimatedSavings.replace(/[^0-9]/g, ''));
        return bVal - aVal;
      });
    } else {
      // Sort by recent (default)
      filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    }

    return filtered;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredPipelines = getFilteredPipelines();

  return (
    <div className="workspace-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1>🗂️ My Workspaces</h1>
          <p className="dashboard-subtitle">
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} in {sector}
            {' • '}
            {pipelines.filter(p => p.isActive).length} active
          </p>
        </div>
        <button className="btn-new-pipeline" onClick={onNewPipeline}>
          ➕ New Pipeline
        </button>
      </div>

      {/* Controls Bar */}
      <div className="dashboard-controls">
        {/* Filter */}
        <div className="control-group">
          <label>Filter:</label>
          <div className="button-group">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All ({pipelines.length})
            </button>
            <button
              className={filter === 'active' ? 'active' : ''}
              onClick={() => setFilter('active')}
            >
              Active ({pipelines.filter(p => p.isActive).length})
            </button>
            <button
              className={filter === 'inactive' ? 'active' : ''}
              onClick={() => setFilter('inactive')}
            >
              Inactive ({pipelines.filter(p => !p.isActive).length})
            </button>
          </div>
        </div>

        {/* Sort */}
        <div className="control-group">
          <label>Sort by:</label>
          <div className="button-group">
            <button
              className={sortBy === 'recent' ? 'active' : ''}
              onClick={() => setSortBy('recent')}
            >
              📅 Recent
            </button>
            <button
              className={sortBy === 'name' ? 'active' : ''}
              onClick={() => setSortBy('name')}
            >
              🔤 Name
            </button>
            <button
              className={sortBy === 'savings' ? 'active' : ''}
              onClick={() => setSortBy('savings')}
            >
              💰 Savings
            </button>
          </div>
        </div>

        {/* View Mode */}
        <div className="control-group">
          <label>View:</label>
          <div className="button-group">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              ⊞ Grid
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              ☰ List
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Grid/List */}
      <div className={`pipeline-container ${viewMode}`}>
        {filteredPipelines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No pipelines found</h3>
            <p>
              {filter !== 'all'
                ? `No ${filter} pipelines. Try changing the filter.`
                : 'Get started by creating a new pipeline or loading a preset.'}
            </p>
            <button className="btn-primary" onClick={onNewPipeline}>
              ➕ Create Your First Pipeline
            </button>
          </div>
        ) : (
          filteredPipelines.map((pipeline) => (
            <div key={pipeline.name} className="pipeline-card">
              {/* Status Indicator */}
              <div className={`status-indicator ${pipeline.isActive ? 'active' : 'inactive'}`}>
                <div className="status-dot"></div>
                {pipeline.isActive ? 'Active' : 'Inactive'}
              </div>

              {/* Card Content */}
              <div className="card-content" onClick={() => onLoadPipeline(pipeline)}>
                <h3 className="pipeline-name">{pipeline.name}</h3>

                {/* Stats */}
                <div className="pipeline-stats">
                  <div className="stat">
                    <span className="stat-label">Nodes</span>
                    <span className="stat-value">{pipeline.nodes?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Est. Savings</span>
                    <span className="stat-value savings">{pipeline.estimatedSavings}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Modified</span>
                    <span className="stat-value">{formatDate(pipeline.lastModified)}</span>
                  </div>
                </div>

                {/* Preview Thumbnails (simplified) */}
                <div className="node-preview">
                  {pipeline.nodes?.slice(0, 5).map((node, idx) => (
                    <div key={idx} className={`node-thumb ${node.type || 'default'}`}>
                      {node.type?.replace(/_/g, ' ').substring(0, 3).toUpperCase()}
                    </div>
                  ))}
                  {pipeline.nodes?.length > 5 && (
                    <div className="node-thumb more">
                      +{pipeline.nodes.length - 5}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="card-actions">
                <button
                  className={`btn-toggle ${pipeline.isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePipelineStatus(pipeline.name);
                  }}
                  title={pipeline.isActive ? 'Deactivate' : 'Activate'}
                >
                  {pipeline.isActive ? '⏸' : '▶'}
                </button>
                <button
                  className="btn-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadPipeline(pipeline);
                  }}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="btn-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicatePipeline(pipeline);
                  }}
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  className="btn-action danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePipeline(pipeline.name);
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
