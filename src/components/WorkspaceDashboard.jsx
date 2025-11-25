import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSector } from '../context/SectorContext';
import { PipelineStorageService } from '../services/storageService';
import './WorkspaceDashboard.css';

/**
 * Memoized Pipeline Card Component
 * Prevents re-renders when other pipelines change
 */
const PipelineCard = React.memo(({ 
  pipeline, 
  formatDate, 
  onLoad, 
  onToggleStatus, 
  onDuplicate, 
  onDelete 
}) => {
  return (
    <div className="pipeline-card">
      {/* Status Indicator */}
      <div className={`status-indicator ${pipeline.isActive ? 'active' : 'inactive'}`}>
        <div className="status-dot"></div>
        {pipeline.isActive ? 'Active' : 'Inactive'}
      </div>

      {/* Card Content */}
      <div className="card-content" onClick={() => onLoad(pipeline)}>
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
            onToggleStatus(pipeline.name);
          }}
          title={pipeline.isActive ? 'Deactivate' : 'Activate'}
        >
          {pipeline.isActive ? '⏸' : '▶'}
        </button>
        <button
          className="btn-action"
          onClick={(e) => {
            e.stopPropagation();
            onLoad(pipeline);
          }}
          title="Edit"
        >
          ✏️
        </button>
        <button
          className="btn-action"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(pipeline);
          }}
          title="Duplicate"
        >
          📋
        </button>
        <button
          className="btn-action danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pipeline.name);
          }}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

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

  // Load pipelines from storage service
  useEffect(() => {
    loadPipelines();
  }, [sector]);

  const loadPipelines = useCallback(() => {
    try {
      const allPipelines = PipelineStorageService.loadAllPipelines();
      
      // Filter by current sector
      const sectorPipelines = allPipelines
        .filter(p => p.sector === sector)
        .map(p => ({
          ...p,
          isActive: p.isActive !== undefined ? p.isActive : false,
          lastModified: p.updatedAt || p.savedAt || new Date().toISOString()
        }));

      setPipelines(sectorPipelines);
    } catch (error) {
      console.error('Failed to load pipelines:', error);
      alert('Error loading pipelines. Please refresh the page.');
    }
  }, [sector]);

  // Memoize expensive calculation
  const calculateEstimatedSavings = useMemo(() => {
    return (pipeline) => {
      // Simple heuristic based on node count
      const cacheNodes = pipeline.nodes?.filter(n => 
        n.type?.includes('cache') || n.id?.includes('cache')
      ).length || 0;
      return `$${(cacheNodes * 800 + 400).toLocaleString()}/mo`;
    };
  }, []);

  const togglePipelineStatus = useCallback((pipelineName) => {
    try {
      const pipeline = PipelineStorageService.loadPipeline(pipelineName);
      if (!pipeline) {
        alert('Pipeline not found');
        return;
      }
      
      pipeline.isActive = !pipeline.isActive;
      const result = PipelineStorageService.savePipeline(pipeline);
      
      if (!result.success) {
        alert(`Failed to update pipeline: ${result.message}`);
        return;
      }
      
      loadPipelines();
    } catch (error) {
      console.error('Failed to toggle pipeline status:', error);
      alert('Error updating pipeline status');
    }
  }, [sector, loadPipelines]);

  const deletePipeline = useCallback((pipelineName) => {
    if (!confirm(`Delete pipeline "${pipelineName}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const result = PipelineStorageService.deletePipeline(pipelineName);
      
      if (!result.success) {
        alert(`Failed to delete pipeline: ${result.message}`);
        return;
      }
      
      loadPipelines();
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
      alert('Error deleting pipeline');
    }
  }, [loadPipelines]);

  const duplicatePipeline = useCallback((pipeline) => {
    try {
      const copy = {
        ...pipeline,
        name: `${pipeline.name} (Copy)`,
        isActive: false
      };
      
      const result = PipelineStorageService.savePipeline(copy);
      
      if (!result.success) {
        if (result.error === 'quota') {
          alert(`Storage quota exceeded: ${result.message}`);
        } else if (result.error === 'validation') {
          alert(`Validation error: ${result.message}`);
        } else {
          alert(`Failed to duplicate pipeline: ${result.message}`);
        }
        return;
      }
      
      loadPipelines();
    } catch (error) {
      console.error('Failed to duplicate pipeline:', error);
      alert('Error duplicating pipeline');
    }
  }, [loadPipelines]);

  // Memoize filtered and sorted pipelines
  const filteredPipelines = useMemo(() => {
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
        const aVal = parseInt((a.estimatedSavings || '0').replace(/[^0-9]/g, ''));
        const bVal = parseInt((b.estimatedSavings || '0').replace(/[^0-9]/g, ''));
        return bVal - aVal;
      });
    } else {
      // Sort by recent (default)
      filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    }

    return filtered;
  }, [pipelines, filter, sortBy]);

  const formatDate = useCallback((dateStr) => {
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
  }, []);

  // Memoize count calculations
  const activeCount = useMemo(() => 
    pipelines.filter(p => p.isActive).length, 
    [pipelines]
  );
  const inactiveCount = useMemo(() => 
    pipelines.filter(p => !p.isActive).length, 
    [pipelines]
  );

  return (
    <div className="workspace-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1>🗂️ My Workspaces</h1>
          <p className="dashboard-subtitle">
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} in {sector}
            {' • '}
            {activeCount} active
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
              Active ({activeCount})
            </button>
            <button
              className={filter === 'inactive' ? 'active' : ''}
              onClick={() => setFilter('inactive')}
            >
              Inactive ({inactiveCount})
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
            <PipelineCard
              key={pipeline.name}
              pipeline={pipeline}
              formatDate={formatDate}
              onLoad={onLoadPipeline}
              onToggleStatus={togglePipelineStatus}
              onDuplicate={duplicatePipeline}
              onDelete={deletePipeline}
            />
          ))
        )}
      </div>
    </div>
  );
}
