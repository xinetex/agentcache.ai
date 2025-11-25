import { Handle, Position } from 'reactflow';
import './BaseNode.css';

function BaseNode({ data, icon, color, children, handles }) {
  const { label, metrics = {} } = data;
  const { hitRate = 0, latency = 0, savings = 0 } = metrics;

  return (
    <div className="base-node" style={{ borderColor: color }}>
      {handles?.input !== false && (
        <Handle
          type="target"
          position={Position.Left}
          className="node-handle"
          style={{ background: color }}
        />
      )}
      
      <div className="node-header" style={{ background: color }}>
        <span className="node-icon">{icon}</span>
        <span className="node-label">{label}</span>
      </div>
      
      {metrics && Object.keys(metrics).length > 0 && (
        <div className="node-metrics">
          {hitRate > 0 && (
            <div className="metric">
              <span className="metric-label">Hit Rate</span>
              <span className="metric-value">{Math.round(hitRate * 100)}%</span>
            </div>
          )}
          {latency > 0 && (
            <div className="metric">
              <span className="metric-label">Latency</span>
              <span className="metric-value">{latency}ms</span>
            </div>
          )}
          {savings > 0 && (
            <div className="metric">
              <span className="metric-label">Savings</span>
              <span className="metric-value">${savings}</span>
            </div>
          )}
        </div>
      )}
      
      {children}
      
      {handles?.output !== false && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="node-handle"
            style={{ background: color, top: '50%' }}
          />
          {handles?.miss && (
            <Handle
              type="source"
              position={Position.Right}
              id="miss"
              className="node-handle"
              style={{ background: '#f59e0b', top: '75%' }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default BaseNode;
