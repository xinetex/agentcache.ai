import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Folder, Zap } from 'lucide-react';

// D3-inspired Sparkline Component
function Sparkline({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1); // prevent division by zero
  const width = 160;
  const height = 24;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - (d / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ marginTop: '8px', overflow: 'visible' }}>
      <polyline 
        points={points} 
        fill="none" 
        stroke="var(--accent-amber)" 
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// D3-inspired Donut Chart Component
function DonutChart({ composition }) {
  if (!composition || composition.length === 0) {
    return <Folder size={24} color="var(--text-muted)" />;
  }

  const total = composition.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <Folder size={24} color="var(--text-muted)" />;

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  // Simple color palette for different file types
  const colors = {
    '.pdf': '#3b82f6', // blue
    '.jpg': '#f59e0b', // amber
    '.png': '#f59e0b',
    '.csv': '#10b981', // green
    'unknown': '#6b7280' // gray
  };

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
      {composition.map((item, index) => {
        const strokeDasharray = `${(item.count / total) * circumference} ${circumference}`;
        const strokeDashoffset = -currentOffset;
        currentOffset += (item.count / total) * circumference;
        const color = colors[item.type] || colors['unknown'];

        return (
          <circle
            key={index}
            cx="12"
            cy="12"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export default function FolderNode({ data, selected }) {
  const isIntelligent = data.hasAction;
  const telemetry = data.telemetry || { composition: [], activity: [] };

  return (
    <div className={`glass-panel ${selected ? 'node-selected' : ''}`} style={{ 
      padding: '16px', 
      minWidth: '200px',
      border: selected ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      boxShadow: selected ? 'var(--shadow-glow)' : 'none'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--text-muted)' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Dynamic Icon / Donut Chart */}
        {isIntelligent ? (
          <Zap size={24} color="var(--accent-amber)" />
        ) : (
          <DonutChart composition={telemetry.composition} />
        )}
        
        <div>
          <div style={{ fontWeight: 500, fontSize: '14px' }}>{data.label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {isIntelligent ? 'Smart Node' : 'Standard Folder'}
          </div>
        </div>
      </div>
      
      {data.actionName && (
        <div style={{ 
          marginTop: '12px', 
          padding: '6px 8px', 
          background: 'var(--bg-base)', 
          borderRadius: '4px',
          fontSize: '11px',
          color: 'var(--accent-amber)' 
        }}>
          Action: {data.actionName}
        </div>
      )}

      {/* Sparkline Activity Chart */}
      {telemetry.activity && telemetry.activity.length > 0 && (
        <Sparkline data={telemetry.activity} />
      )}

      {/* Dynamic Source Handles */}
      {data.workflowSchema?.type === 'branch' ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: '30%', background: '#4ade80', width: '10px', height: '10px' }} />
          <div style={{ position: 'absolute', right: '-25px', top: '23%', fontSize: '10px', color: '#4ade80' }}>True</div>
          
          <Handle type="source" position={Position.Right} id="false" style={{ top: '70%', background: '#f87171', width: '10px', height: '10px' }} />
          <div style={{ position: 'absolute', right: '-28px', top: '63%', fontSize: '10px', color: '#f87171' }}>False</div>
        </>
      ) : (
        <Handle type="source" position={Position.Right} style={{ background: 'var(--text-muted)' }} />
      )}
    </div>
  );
}
