import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
    Controls,
    Background,
    applyEdgeChanges,
    applyNodeChanges,
    addEdge,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, Plus, Wand2, X } from 'lucide-react';
import CyberCard from '../components/CyberCard';

// Custom Node Components
const CyberNode = ({ data, type }) => {
    const colors = {
        source: 'var(--hud-accent)',
        cache: 'var(--hud-success)',
        llm: 'var(--hud-accent-secondary)',
        sector: '#f59e0b'
    };
    const color = colors[data.type] || 'var(--hud-text)';

    return (
        <div className="px-4 py-2 rounded bg-black border border-[var(--hud-border)] shadow-[0_0_15px_rgba(0,0,0,0.5)] min-w-[150px]">
            <Handle type="target" position={Position.Top} className="!bg-[var(--hud-text-dim)]" />
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-xs font-bold uppercase tracking-wider text-white">{data.label}</span>
            </div>
            <div className="text-[10px] font-mono text-[var(--hud-text-dim)]">{data.details}</div>
            <Handle type="source" position={Position.Bottom} className="!bg-[var(--hud-text-dim)]" />
        </div>
    );
};

const nodeTypes = {
    cyber: CyberNode
};

export default function PipelineStudio() {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [showWizard, setShowWizard] = useState(true);
    const [wizardStep, setWizardStep] = useState(1);
    const [config, setConfig] = useState({ useCase: '', performance: 'balanced' });

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect = useCallback(
        (connection) => setEdges((eds) => addEdge(connection, eds)),
        [],
    );

    // Wizard Logic
    const generatePipeline = () => {
        // Mock generation based on config
        const newNodes = [
            { id: '1', type: 'cyber', position: { x: 250, y: 0 }, data: { label: 'HTTP API', type: 'source', details: 'Ingress' } },
            { id: '2', type: 'cyber', position: { x: 250, y: 100 }, data: { label: 'L1 Cache', type: 'cache', details: 'Redis (In-Memory)' } },
            { id: '3', type: 'cyber', position: { x: 250, y: 200 }, data: { label: 'Semantic Router', type: 'sector', details: 'Healthcare Model' } },
            { id: '4', type: 'cyber', position: { x: 250, y: 300 }, data: { label: 'GPT-4o', type: 'llm', details: 'Fallback' } },
        ];

        const newEdges = [
            { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'var(--hud-accent)' } },
            { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: 'var(--hud-accent)' } },
            { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: 'var(--hud-accent)' } },
        ];

        setNodes(newNodes);
        setEdges(newEdges);
        setShowWizard(false);
    };

    // Save Logic
    const handleSave = async () => {
        try {
            const token = localStorage.getItem('agentcache_token');
            if (!token) {
                alert('Authentication required. Please log in.');
                return;
            }

            // Minimal payload from current state
            const payload = {
                name: `Pipeline ${new Date().toLocaleTimeString()}`,
                sector: config.useCase || 'custom',
                nodes: nodes,
                connections: edges,
                description: `Generated via Wizard (${config.performance})`,
                complexity: { tier: 'moderate', score: nodes.length * 10 },
                monthlyCost: 0,
                features: ['cache', 'llm']
            };

            const res = await fetch('/api/pipelines/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                alert(`Pipeline Saved! ID: ${data.pipeline.id}`);
            } else {
                throw new Error(data.error || 'Unknown error');
            }

        } catch (e) {
            console.error('Save failed', e);
            alert(`Failed to save: ${e.message}`);
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-6 relative">

            {/* Left Sidebar: Palette */}
            <div className="w-64 flex flex-col gap-4">
                <CyberCard title="Node Palette" icon={Plus} className="flex-1">
                    <div className="space-y-2">
                        {['Source', 'Cache', 'LLM', 'Sector'].map(type => (
                            <div
                                key={type}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.setData('application/reactflow', type);
                                    event.dataTransfer.effectAllowed = 'move';
                                }}
                                className="p-3 rounded bg-[rgba(255,255,255,0.05)] border border-transparent hover:border-[var(--hud-accent)] cursor-grab active:cursor-grabbing transition-colors"
                            >
                                <span className="text-sm font-bold text-white">{type} Node</span>
                            </div>
                        ))}
                    </div>
                </CyberCard>
            </div>

            {/* Main Canvas */}
            <div className="flex-1 rounded-lg border border-[var(--hud-border)] bg-black/50 overflow-hidden relative"
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    const type = event.dataTransfer.getData('application/reactflow');
                    if (!type) return;

                    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
                    // Simple projection (can be improved with useReactFlow.project)
                    const position = {
                        x: event.clientX - reactFlowBounds.left - 75, // center horizontally roughly
                        y: event.clientY - reactFlowBounds.top - 20
                    };

                    const newNode = {
                        id: `${type}-${Date.now()}`,
                        type: 'cyber',
                        position,
                        data: { label: `${type} Node`, type: type.toLowerCase(), details: 'New Node' },
                    };

                    setNodes((nds) => nds.concat(newNode));
                }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                >
                    <Background color="#333" gap={20} />
                    <Controls className="!bg-black !border-[var(--hud-border)] !fill-white" />
                </ReactFlow>

                {/* Toolbar */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => setShowWizard(true)} className="btn-cyber px-4 py-2 flex items-center gap-2 text-xs">
                        <Wand2 size={14} /> Wizard
                    </button>
                    <button onClick={handleSave} className="btn-cyber px-4 py-2 flex items-center gap-2 text-xs">
                        <Save size={14} /> Save
                    </button>
                    <button className="btn-cyber btn-cyber-primary px-4 py-2 flex items-center gap-2 text-xs">
                        <Play size={14} /> Deploy
                    </button>
                </div>
            </div>

            {/* Wizard Modal */}
            {showWizard && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <CyberCard className="w-[600px] max-h-[80vh] overflow-y-auto relative">
                        <button onClick={() => setShowWizard(false)} className="absolute top-4 right-4 text-[var(--hud-text-dim)] hover:text-white">
                            <X size={20} />
                        </button>

                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-[var(--hud-accent)] tracking-widest mb-1">PIPELINE WIZARD</h2>
                            <p className="text-xs font-mono text-[var(--hud-text-dim)]">CONFIGURE ORCHESTRATION PARAMETERS</p>
                        </div>

                        {wizardStep === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white">SELECT USE CASE</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'clinical', label: 'Clinical Decision', icon: '🏥' },
                                        { id: 'trading', label: 'Trading Assistant', icon: '📈' },
                                        { id: 'legal', label: 'Contract Review', icon: '⚖️' },
                                        { id: 'custom', label: 'Custom', icon: '⚡' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setConfig({ ...config, useCase: opt.id }); setWizardStep(2); }}
                                            className="p-4 rounded border border-[var(--hud-border)] hover:border-[var(--hud-accent)] hover:bg-[var(--hud-accent)]/10 text-left transition-all"
                                        >
                                            <div className="text-2xl mb-2">{opt.icon}</div>
                                            <div className="font-bold text-sm text-white">{opt.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {wizardStep === 2 && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-white">OPTIMIZATION TARGET</h3>
                                <div className="space-y-3">
                                    {[
                                        { id: 'fast', label: 'Low Latency', desc: 'Minimize response time' },
                                        { id: 'balanced', label: 'Balanced', desc: 'Good speed + cost savings' },
                                        { id: 'cost', label: 'Cost Optimized', desc: 'Maximum savings' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setConfig({ ...config, performance: opt.id })}
                                            className={`w-full p-4 rounded border text-left transition-all ${config.performance === opt.id
                                                ? 'border-[var(--hud-accent)] bg-[var(--hud-accent)]/10'
                                                : 'border-[var(--hud-border)] hover:bg-[rgba(255,255,255,0.05)]'}`}
                                        >
                                            <div className="font-bold text-sm text-white">{opt.label}</div>
                                            <div className="text-xs text-[var(--hud-text-dim)]">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between pt-4 border-t border-[var(--hud-border)]">
                                    <button onClick={() => setWizardStep(1)} className="text-xs text-[var(--hud-text-dim)] hover:text-white">BACK</button>
                                    <button onClick={generatePipeline} className="btn-cyber btn-cyber-primary px-6 py-2 text-sm font-bold">GENERATE</button>
                                </div>
                            </div>
                        )}
                    </CyberCard>
                </div>
            )}
        </div>
    );
}
