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
import WizardModal from './components/WizardModalNew';
import SectorModal from './components/SectorModal';
import MetricsPanel from './components/MetricsPanel';
import WorkspaceGallery from './components/WorkspaceGallery';
import CommandCenter from './components/CommandCenter';
import { useSector } from './context/SectorContext';
import { nodeTypes } from './nodes';
import { initDemoMode } from './config/demoData';
import { PipelineStorageService, StorageService } from './services/storageService';
import TrafficEdge from './components/TrafficEdge';
import NeuralGalaxy from './components/NeuralGalaxy';
import { useTrafficSimulation } from './hooks/useTrafficSimulation';
import './App.css';

const edgeTypes = {
  traffic: TrafficEdge,
};

function App() {
  const { sector, config, selectSector, showSectorModal, setShowSectorModal } = useSector();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder' | 'galaxy'
  const [wizardOpen, setWizardOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const [pipelineName, setPipelineName] = useState('Untitled Pipeline');

  // Traffic Simulation
  const trafficState = useTrafficSimulation(nodes, edges);

  // Update edges with traffic data
  useEffect(() => {
    setEdges(eds => eds.map(edge => ({
      ...edge,
      type: 'traffic', // Force traffic edge type
      data: {
        ...edge.data,
        packets: trafficState[edge.id] || []
      }
    })));
  }, [trafficState, setEdges]);

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

  // Save pipeline with validation and error handling
  const handleSavePipeline = useCallback(() => {
    // Basic validation
    if (!pipelineName || pipelineName.trim() === '') {
      alert('Please enter a pipeline name');
      return;
    }

    if (nodes.length === 0) {
      alert('Pipeline must have at least one node');
      return;
    }

    const pipeline = {
      name: pipelineName.trim(),
      sector,
      nodes,
      edges
    };

    try {
      const result = PipelineStorageService.savePipeline(pipeline);

      if (!result.success) {
        // Handle different error types
        if (result.error === 'quota') {
          alert(`Storage quota exceeded: ${result.message}\n\nConsider deleting old pipelines or upgrading your plan.`);
        } else if (result.error === 'validation') {
          alert(`Validation error: ${result.message}\n\nField: ${result.field || 'unknown'}`);
        } else {
          alert(`Failed to save pipeline: ${result.message}`);
        }
        return;
      }

      // Check storage stats after save
      const stats = StorageService.getStorageStats();
      const percentUsed = stats.percentUsed.toFixed(1);

      const message = result.isNew
        ? `Pipeline "${pipelineName}" saved!`
        : `Pipeline "${pipelineName}" updated!`;

      // Warn if storage is getting full
      if (stats.percentUsed > 80) {
        alert(`${message}\n\n⚠️ Storage warning: ${percentUsed}% used. Consider deleting old pipelines.`);
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Failed to save pipeline:', error);
      alert(`Error saving pipeline: ${error.message}`);
    }
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
    // Get saved pipelines for metrics
    const savedPipelines = PipelineStorageService.loadAllPipelines();

    return (
      <div className="app">
        <CommandCenter
          onOpenWizard={() => setWizardOpen(true)}
          onNewPipeline={handleNewPipeline}
          pipelines={savedPipelines}
        />

        {wizardOpen && (
          <WizardModal
            sector={sector}
            config={config}
            onClose={() => setWizardOpen(false)}
            onComplete={(pipeline) => {
              handleWizardComplete(pipeline);
              setView('builder'); // Switch to builder after wizard
            }}
          />
        )}
      </div>
    );
  }

  // Show Neural Galaxy view
  if (view === 'galaxy') {
    return (
      <div className="app">
        <header className="header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'transparent', border: 'none' }}>
          <div className="header-left">
            <button
              className="btn btn-icon"
              onClick={() => setView('dashboard')}
              title="Back to Dashboard"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
            >
              ← 🗂️
            </button>
            <div>
              <h1 style={{ textShadow: '0 0 10px rgba(0,243,255,0.5)' }}>Neural Galaxy</h1>
            </div>
          </div>
          <div className="header-right">
            <button className="btn btn-secondary" onClick={() => setView('builder')} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
              Switch to Builder
            </button>
          </div>
        </header>
        <NeuralGalaxy />
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
          <button className="btn btn-secondary" onClick={() => setView('galaxy')}>
            🌌 Galaxy View
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
            edgeTypes={edgeTypes}
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
