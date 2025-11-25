import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import Sidebar from './components/Sidebar';
import WizardModal from './components/WizardModal';
import SectorModal from './components/SectorModal';
import MetricsPanel from './components/MetricsPanel';
import WorkspaceGallery from './components/WorkspaceGallery';
import WorkspaceDashboard from './components/WorkspaceDashboard';
import { useSector } from './context/SectorContext';
import { nodeTypes } from './nodes';
import { initDemoMode } from './config/demoData';
import './App.css';

function App() {
  const { sector, config, selectSector, showSectorModal, setShowSectorModal } = useSector();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder'
  const [wizardOpen, setWizardOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [pipelineName, setPipelineName] = useState('Untitled Pipeline');

  console.log('App render:', { sector, config, showSectorModal });

  // Initialize demo mode if URL contains ?demo=true
  useEffect(() => {
    initDemoMode();
  }, []);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle wizard-generated pipeline
  const handleWizardComplete = useCallback((pipeline) => {
    // Pipeline comes from /api/pipeline/generate
    // Contains: nodes[], edges[], name, metrics, etc.
    
    const generatedNodes = pipeline.nodes.map((node, idx) => ({
      id: `${node.type}-${idx}`,
      type: node.type,
      position: { x: 100 + idx * 250, y: 200 },
      data: {
        label: node.type.replace('_', ' ').toUpperCase(),
        config: node.config,
        metrics: {
          hitRate: 0,
          latency: 0,
          savings: 0
        }
      },
    }));

    // Auto-generate edges (sequential flow)
    const generatedEdges = [];
    for (let i = 0; i < generatedNodes.length - 1; i++) {
      generatedEdges.push({
        id: `e${i}`,
        source: generatedNodes[i].id,
        target: generatedNodes[i + 1].id,
        animated: true,
        style: { stroke: '#10b981' },
      });
    }

    setNodes(generatedNodes);
    setEdges(generatedEdges);
    setPipelineName(pipeline.name || 'Generated Pipeline');
    setWizardOpen(false);
  }, [setNodes, setEdges]);

  // Handle loading preset from gallery
  const handleLoadPreset = useCallback((preset) => {
    setNodes(preset.nodes);
    setEdges(preset.edges);
    setPipelineName(preset.name);
    setGalleryOpen(false);
    setView('builder'); // Switch to builder view
  }, [setNodes, setEdges]);

  // Handle loading pipeline from dashboard
  const handleLoadPipelineFromDashboard = useCallback((pipeline) => {
    setNodes(pipeline.nodes);
    setEdges(pipeline.edges);
    setPipelineName(pipeline.name);
    setView('builder');
  }, [setNodes, setEdges]);

  // Handle creating new pipeline
  const handleNewPipeline = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setPipelineName('Untitled Pipeline');
    setView('builder');
  }, [setNodes, setEdges]);

  // Save pipeline to localStorage (later: API)
  const handleSavePipeline = useCallback(() => {
    const pipeline = {
      name: pipelineName,
      sector,
      nodes,
      edges,
      savedAt: new Date().toISOString()
    };
    
    // Get existing saved pipelines
    const saved = JSON.parse(localStorage.getItem('savedPipelines') || '[]');
    
    // Check if pipeline with this name exists
    const existingIdx = saved.findIndex(p => p.name === pipelineName && p.sector === sector);
    
    if (existingIdx >= 0) {
      saved[existingIdx] = pipeline;
      alert(`Pipeline "${pipelineName}" updated!`);
    } else {
      saved.push(pipeline);
      alert(`Pipeline "${pipelineName}" saved!`);
    }
    
    localStorage.setItem('savedPipelines', JSON.stringify(saved));
  }, [pipelineName, sector, nodes, edges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: type.replace('_', ' ').toUpperCase(),
          config: {},
          metrics: {
            hitRate: 0,
            latency: 0,
            savings: 0
          }
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  // Show sector modal if needed
  if (showSectorModal) {
    return (
      <div className="app">
        <SectorModal
          onComplete={selectSector}
          onSkip={selectSector}
        />
      </div>
    );
  }

  // Don't render main UI until sector is selected
  if (!sector || !config) {
    return <div style={{ padding: '20px', color: 'white' }}>Loading sector config...</div>;
  }

  // Show dashboard view
  if (view === 'dashboard') {
    return (
      <div className="app">
        <WorkspaceDashboard
          onLoadPipeline={handleLoadPipelineFromDashboard}
          onNewPipeline={handleNewPipeline}
        />
      </div>
    );
  }

  // Show builder view
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <button 
            className="btn btn-icon" 
            onClick={() => setView('dashboard')}
            title="Back to Dashboard"
          >
            ← 🗂️
          </button>
          <div>
            <h1>AgentCache Studio</h1>
            <span className="subtitle">Visual Pipeline Builder • {sector.charAt(0).toUpperCase() + sector.slice(1)}</span>
          </div>
        </div>
        <div className="header-center">
          <input 
            type="text" 
            className="pipeline-name-input"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            placeholder="Pipeline name..."
          />
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={() => setGalleryOpen(true)}>
            📁 Load Preset
          </button>
          <button className="btn btn-secondary" onClick={() => setWizardOpen(true)}>
            🪄 AI Wizard
          </button>
          <button className="btn btn-success" onClick={handleSavePipeline}>
            💾 Save
          </button>
          <button className="btn btn-primary">
            🚀 Deploy
          </button>
        </div>
      </header>

      <div className="main-content">
        <Sidebar sector={sector} config={config} />
        
        <div className="canvas-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'input':
                    return '#3b82f6';
                  case 'cache_l1':
                  case 'cache_l2':
                  case 'cache_l3':
                    return '#10b981';
                  case 'openai':
                  case 'anthropic':
                  case 'gemini':
                    return '#8b5cf6';
                  default:
                    return '#6366f1';
                }
              }}
              style={{
                background: '#1e293b',
              }}
            />
            <Background color="#334155" gap={16} />
          </ReactFlow>
        </div>

        <MetricsPanel selectedNode={selectedNode} />
      </div>

      {wizardOpen && (
        <WizardModal
          sector={sector}
          config={config}
          onClose={() => setWizardOpen(false)}
          onComplete={handleWizardComplete}
        />
      )}

      {galleryOpen && (
        <WorkspaceGallery
          onLoadPreset={handleLoadPreset}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
