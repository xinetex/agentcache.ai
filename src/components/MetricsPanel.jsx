import './MetricsPanel.css';

function MetricsPanel({ selectedNode }) {
  if (!selectedNode) {
    return (
      <aside className="metrics-panel">
        <div className="metrics-empty">
          <p>Click a node to view details</p>
        </div>
      </aside>
    );
  }

  const { data } = selectedNode;
  const { label, config = {}, metrics = {} } = data;

  return (
    <aside className="metrics-panel">
      <div className="panel-header">
        <h3>Node Details</h3>
      </div>

      <div className="panel-section">
        <h4>Info</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Type</span>
            <span className="info-value">{selectedNode.type}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Label</span>
            <span className="info-value">{label}</span>
          </div>
        </div>
      </div>

      {Object.keys(config).length > 0 && (
        <div className="panel-section">
          <h4>Configuration</h4>
          <div className="config-list">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="config-item">
                <span className="config-key">{key}</span>
                <span className="config-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(metrics).length > 0 && (
        <div className="panel-section">
          <h4>Live Metrics</h4>
          <div className="metrics-grid">
            {metrics.hitRate > 0 && (
              <div className="metric-card">
                <span className="metric-label">Hit Rate</span>
                <span className="metric-value">{Math.round(metrics.hitRate * 100)}%</span>
              </div>
            )}
            {metrics.latency > 0 && (
              <div className="metric-card">
                <span className="metric-label">Latency</span>
                <span className="metric-value">{metrics.latency}ms</span>
              </div>
            )}
            {metrics.savings > 0 && (
              <div className="metric-card">
                <span className="metric-label">Savings</span>
                <span className="metric-value">${metrics.savings}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

export default MetricsPanel;
