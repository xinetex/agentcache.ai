import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import FolderNode from './FolderNode';
import { Plus } from 'lucide-react';

const nodeTypes = {
  folder: FolderNode,
};

const initialEdges = [];

import Sunburst from './Sunburst';

function FloatingSunburst({ selectedNode, nodeContents }) {
  const { flowToScreenPosition } = useReactFlow();
  if (!selectedNode || !nodeContents) return null;

  // Calculate screen position based on canvas zoom/pan
  const pos = flowToScreenPosition({ x: selectedNode.position.x, y: selectedNode.position.y });

  return (
    <div style={{
      position: 'absolute',
      left: pos.x,
      top: pos.y,
      transform: 'translate(-50%, -50%)', // Center directly over the node
      zIndex: 1000,
      pointerEvents: 'auto',
      animation: 'fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div className="glass-panel" style={{ borderRadius: '50%', padding: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <Sunburst data={nodeContents} width={350} height={350} />
      </div>
    </div>
  );
}

function FlowCanvas({ onNodeSelect, selectedNode, nodeContents, initialApiNodes, currentParentId, onNavigateDown, onRefresh }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getIntersectingNodes } = useReactFlow();
  
  // Transform API nodes to React Flow nodes when loaded
  useEffect(() => {
    if (initialApiNodes) {
      const rfNodes = initialApiNodes.map(n => ({
        id: String(n.id),
        type: 'folder',
        position: { x: Number(n.pos_x) || Math.random() * 300, y: Number(n.pos_y) || Math.random() * 300 },
        data: { 
          label: n.name, 
          hasAction: n.node_type === 'template_action', 
          actionName: n.properties?.installedTemplate,
          workflowSchema: n.properties?.workflowSchema,
          telemetry: { composition: [], activity: [] }
        }
      }));
      setNodes(rfNodes);
      setEdges([]); // We need to fetch edges per-subgraph, but for MVP we clear them when diving.
    }
  }, [initialApiNodes, setNodes, setEdges]);

  // Telemetry Polling Loop
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const fetchTelemetry = async () => {
      const token = localStorage.getItem('agentcache_token');
      if (!token) return;
      try {
        const nodeIds = nodes.map(n => n.id);
        const res = await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ nodeIds })
        });
        if (res.ok) {
          const { telemetry } = await res.json();
          if (telemetry) {
            setNodes((nds) => nds.map(n => {
              if (telemetry[n.id]) {
                return { ...n, data: { ...n.data, telemetry: telemetry[n.id] } };
              }
              return n;
            }));
          }
        }
      } catch (e) {
        console.error("Telemetry poll failed", e);
      }
    };

    fetchTelemetry(); // Initial fetch
    const intervalId = setInterval(fetchTelemetry, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [nodes.length, setNodes]); // re-run if node count changes
  
  const onConnect = useCallback(
    async (params) => {
      const newEdge = { ...params, animated: true, style: { stroke: 'var(--accent-amber)' } };
      setEdges((eds) => addEdge(newEdge, eds));
      
      const token = localStorage.getItem('agentcache_token');
      try {
        await fetch('/api/workflows?action=connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            workflowId: 'dummy-wf-id-for-now',
            sourceNodeId: params.source,
            targetNodeId: params.target
          })
        });
      } catch (e) {
        console.error("Connection failed", e);
      }
    },
    [setEdges]
  );

  const onAddNode = async () => {
    const token = localStorage.getItem('agentcache_token');
    try {
      const res = await fetch('/api/nodes?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: 'New Folder', nodeType: 'directory', parentId: currentParentId })
      });
      const data = await res.json();
      
      if (data.node) {
        const newNode = {
          id: String(data.node.id),
          type: 'folder',
          position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
          data: { label: data.node.name, hasAction: false },
        };
        setNodes((nds) => nds.concat(newNode));
      }
    } catch (e) {
      console.error("Failed to create node", e);
    }
  };

  const onSelectionChange = useCallback(({ nodes }) => {
    if (nodes.length > 0) {
      onNodeSelect(nodes[0]);
    } else {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (onNavigateDown) {
      onNavigateDown(node.id, node.data.label);
    }
  }, [onNavigateDown]);

  const timeoutRef = useRef(null);
  const onNodeDragStop = useCallback(async (event, node) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Check for intersections to handle nesting
    const intersections = getIntersectingNodes(node);
    if (intersections.length > 0) {
      const targetParent = intersections[0];
      const token = localStorage.getItem('agentcache_token');
      try {
        await fetch('/api/nodes?action=update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            nodeId: node.id,
            parentId: targetParent.id
          })
        });
        if (onRefresh) onRefresh();
        return; // Early return, we've moved the node into the parent
      } catch (e) {
        console.error("Failed to nest node", e);
      }
    }

    // Otherwise, just save position
    timeoutRef.current = setTimeout(async () => {
      const token = localStorage.getItem('agentcache_token');
      try {
        await fetch('/api/workflows?action=positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            positions: [{ nodeId: node.id, x: node.position.x, y: node.position.y }]
          })
        });
      } catch (e) {
        console.error("Failed to save pos", e);
      }
    }, 1000);
  }, [getIntersectingNodes, onRefresh]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        colorMode="dark"
      >
        <Background gap={24} size={2} color="var(--border-color)" />
        <Controls />
        <MiniMap 
          nodeColor={(n) => {
            return n.data.hasAction ? '#d4a574' : '#333333';
          }}
          maskColor="rgba(15, 15, 15, 0.7)"
        />
        <Panel position="top-right">
          <button className="btn-primary" onClick={onAddNode} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Folder Node
          </button>
        </Panel>
      </ReactFlow>

      {/* Floating Radial Sunburst Layer */}
      <FloatingSunburst selectedNode={selectedNode} nodeContents={nodeContents} />
    </div>
  );
}

export default function Canvas(props) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}

