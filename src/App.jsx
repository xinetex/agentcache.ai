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
import { useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import { nodeTypes } from './nodes';
import { initDemoMode } from './config/demoData';
import { PipelineStorageService, StorageService } from './services/storageService';
import TrafficEdge from './components/TrafficEdge';
import NeuralGalaxy from './components/NeuralGalaxy';
import { useTrafficSimulation } from './hooks/useTrafficSimulation';
import './App.css';
import TraceViewer from './components/TraceViewer';
import TraceViewer from './components/TraceViewer';
import StreamInterface from './integral/StreamInterface';
import IntelligenceDashboard from './components/IntelligenceDashboard';

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
  const { user, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false); // Track if a save was attempted

  // Trace Viewer State
  const [traceId, setTraceId] = useState(null);

  // Check URL for trace ID on mount and manual routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('trace');
    if (tid) setTraceId(tid);

    // Simple manual routing for /stream
    if (window.location.pathname === '/stream') {
      setView('stream');
    }
  }, []);

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
  const handleSavePipeline = useCallback(async () => {
    // Basic validation
    if (!pipelineName || pipelineName.trim() === '') {
      alert('Please enter a pipeline name');
      return;
    }

    if (nodes.length === 0) {
      alert('Pipeline must have at least one node');
      return;
    }

    // AUTH GATE: Require login to save
    if (!isAuthenticated()) {
      setPendingSave(true);
      setShowAuthModal(true);
      return;
    }

    const pipeline = {
      name: pipelineName.trim(),
      sector,
      nodes,
      edges
    };

    try {
      // TODO: This should eventually be an API call to save to cloud
      // For now we still save locally, but we know the user is authenticated.
      // In the next step (storageService) we will add cloud syncing.
      const token = localStorage.getItem('auth_token'); // Or get from useAuth
      const result = await PipelineStorageService.savePipeline(pipeline, token);

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
        ? `Pipeline "${pipelineName}" saved to your account!`
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
  }, [pipelineName, sector, nodes, edges, isAuthenticated]);

  // Handle successful auth (login/register)
  const handleAuthSuccess = useCallback(async (user) => {
    setShowAuthModal(false);

    // Sync local pipelines to cloud
    const token = localStorage.getItem('auth_token');
    await PipelineStorageService.syncToCloud(token);

    // If we were trying to save, retry the save
    if (pendingSave) {
      setPendingSave(false);
      // We can't call handleSavePipeline here directly because of closure staleness if we used strict deps,
      // but since we are re-rendering, we can rely on the user clicking save again OR 
      // ideally we auto-trigger it. 
      // For safety/UX, let's just notify them they can now save.
      // Or better, we can manually trigger the save logic here if we have the latest state.

      // Let's defer strict cloud saving to the proper service later.
      // For now, just let the user know they are logged in.

      // Re-trigger save logic immediately? 
      // We need to pass the current state.

      // Simple approach: Just alert
      alert(`Welcome, ${user.email}! You can now save your pipeline.`);
    }
  }, [pendingSave]);

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
          onOpenIntelligence={() => setView('intelligence')}
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

  // Show Stream Interface
  if (view === 'stream') {
    return (
      <div className="app">
        <StreamInterface />

        {/* Helper to get back to dashboard for demo purposes */}
        <button
          onClick={() => { window.location.pathname = '/'; }}
          style={{ position: 'absolute', top: '20px', left: '20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Exit Stream
        </button>
      </div>
    );
  }

  // Show Intelligence Dashboard
  if (view === 'intelligence') {
    return (
      <div className="app">
        <IntelligenceDashboard onBack={() => setView('dashboard')} />
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

      {showAuthModal && (
        <AuthModal
          onClose={() => {
            setShowAuthModal(false);
            setPendingSave(false);
          }}
          onSuccess={handleAuthSuccess}
          message={pendingSave ? "Sign in to save your pipeline" : null}
        />
      )}

      {galleryOpen && (
        <WorkspaceGallery
          onLoadPreset={handleLoadPreset}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* Global Trace Viewer Overlay */}
      {traceId && (
        <TraceViewer
          traceId={traceId}
          onClose={() => {
            setTraceId(null);
            // Optional: clear URL param
            window.history.pushState({}, '', window.location.pathname);
          }}
        />
      )}
    </div>
  );
}

export default App;
