import React, { useState, useEffect } from 'react';
import { Database, Activity, Search, Server, ArrowRight, Layers } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import DataGrid from '../components/DataGrid';
import KnowledgeCloud from '../components/KnowledgeCloud';
import StatDial from '../components/StatDial';

export default function DataExplorer() {
    const [activeTab, setActiveTab] = useState('activity'); // 'activity', 'inspector', 'embeddings'
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [embeddingInput, setEmbeddingInput] = useState('');
    const [embeddingResult, setEmbeddingResult] = useState(null);

    // Fetch Cache Nodes
    useEffect(() => {
        if (activeTab === 'inspector') {
            fetchNodes();
        }
    }, [activeTab]);

    const fetchNodes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/explorer/nodes?limit=50');
            const data = await res.json();
            if (data.nodes) setNodes(data.nodes);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateEmbedding = async () => {
        if (!embeddingInput.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: embeddingInput })
            });
            const data = await res.json();
            setEmbeddingResult(data);
        } catch (err) {
            setEmbeddingResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">

            {/* Header / Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 bg-black/50 p-1 rounded-lg border border-[var(--hud-border)]">
                    {[
                        { id: 'activity', label: 'Cache Activity', icon: Activity },
                        { id: 'inspector', label: 'Cache Inspector', icon: Database },
                        { id: 'embeddings', label: 'Vector Lab', icon: Layers }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-[var(--hud-accent)] text-black shadow-[0_0_10px_var(--hud-accent)]'
                                : 'text-[var(--hud-text-dim)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">

                {/* CACHE ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Cache Stats */}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6">
                            <CyberCard className="bg-[rgba(0,255,128,0.05)] border-[var(--hud-success)]">
                                <div className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Global Hit Rate</div>
                                <div className="text-3xl font-mono font-bold text-[var(--hud-success)]">94.2%</div>
                                <div className="text-xs text-[var(--hud-success)] mt-2 flex items-center gap-1">
                                    <ArrowRight size={12} className="-rotate-45" /> +2.4% this week
                                </div>
                            </CyberCard>
                            <CyberCard>
                                <div className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Data Cached</div>
                                <div className="text-3xl font-mono font-bold text-white">4.2 TB</div>
                            </CyberCard>
                            <CyberCard>
                                <div className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Requests Served</div>
                                <div className="text-3xl font-mono font-bold text-[var(--hud-accent)]">8.4M</div>
                            </CyberCard>
                            <CyberCard>
                                <div className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Avg Latency</div>
                                <div className="text-3xl font-mono font-bold text-[var(--hud-accent-secondary)]">12ms</div>
                            </CyberCard>
                        </div>

                        {/* Detailed Breakdown */}
                        <CyberCard title="Throughput Analysis" className="lg:col-span-2">
                            <div className="h-64 flex items-end justify-between gap-2 px-4 pb-4 border-b border-[var(--hud-border)]">
                                {/* Mock Bar Chart */}
                                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                    <div key={i} className="w-full bg-[var(--hud-accent)]/20 hover:bg-[var(--hud-accent)]/40 transition-colors rounded-t relative group" style={{ height: `${h}%` }}>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black border border-[var(--hud-border)] px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                            {h * 100} req/s
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-[var(--hud-text-dim)] font-mono px-4">
                                <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                            </div>
                        </CyberCard>

                        <CyberCard title="Top Agents" className="lg:col-span-1">
                            <DataGrid
                                columns={[
                                    { header: 'Agent', accessor: 'agent' },
                                    { header: 'Ops/Sec', accessor: 'ops', render: r => <span className="text-[var(--hud-success)] font-mono">{r.ops}</span> }
                                ]}
                                data={[
                                    { agent: 'Clinical-Bot-1', ops: '1,204' },
                                    { agent: 'Trading-Alpha', ops: '940' },
                                    { agent: 'Legal-Reviewer', ops: '850' },
                                    { agent: 'Support-Swarm', ops: '420' },
                                ]}
                            />
                        </CyberCard>
                    </div>
                )}

                {/* INSPECTOR TAB */}
                {activeTab === 'inspector' && (
                    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Visualization Panel */}
                        <div className="lg:col-span-2 flex flex-col">
                            <CyberCard title="Knowledge Lattice (Public/Community)" icon={Activity} className="flex-1 relative overflow-hidden p-0">
                                <div className="absolute top-0 left-0 w-full h-full">
                                    <KnowledgeCloud nodes={nodes} />
                                </div>
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 backdrop-blur-sm">
                                        <div className="text-[var(--hud-accent)] animate-pulse font-mono">SCANNING SECTOR...</div>
                                    </div>
                                )}
                            </CyberCard>
                        </div>

                        {/* Data Grid Panel */}
                        <CyberCard title="Node Inspector" icon={Database} className="h-full flex flex-col">
                            <div className="flex-1 overflow-hidden">
                                <DataGrid
                                    columns={[
                                        { header: 'ID', accessor: 'id', render: r => <span className="font-mono text-xs text-[var(--hud-text-dim)]">{r.id.substring(0, 6)}...</span> },
                                        { header: 'Key / Topic', accessor: 'key', render: r => <span className="text-white truncate max-w-[150px] block">{r.key || r.prompt || 'Untitled'}</span> },
                                        { header: 'Conf.', accessor: 'confidence', render: r => <span className="text-[var(--hud-success)] font-mono">{(r.confidence * 100).toFixed(0)}%</span> }
                                    ]}
                                    data={nodes}
                                />
                            </div>
                        </CyberCard>
                    </div>
                )}

                {/* EMBEDDINGS TAB */}
                {activeTab === 'embeddings' && (
                    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        <CyberCard title="Vector Laboratory" icon={Layers}>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-[var(--hud-text-dim)] uppercase tracking-wider mb-2 block">Input Text</label>
                                    <textarea
                                        value={embeddingInput}
                                        onChange={e => setEmbeddingInput(e.target.value)}
                                        className="w-full h-32 bg-black border border-[var(--hud-border)] rounded p-3 text-sm focus:border-[var(--hud-accent)] focus:outline-none transition-colors"
                                        placeholder="Enter text to vectorize..."
                                    />
                                </div>
                                <button
                                    onClick={handleGenerateEmbedding}
                                    disabled={loading}
                                    className="btn-cyber btn-cyber-primary w-full py-3 font-bold flex items-center justify-center gap-2"
                                >
                                    {loading ? <Search className="animate-spin" size={16} /> : <Search size={16} />}
                                    GENERATE VECTOR
                                </button>
                            </div>
                        </CyberCard>

                        <CyberCard title="Vector Output" className="font-mono text-xs">
                            {embeddingResult ? (
                                <div className="h-full overflow-y-auto custom-scrollbar space-y-4">
                                    <div className="flex items-center justify-between p-2 rounded bg-[rgba(255,255,255,0.05)]">
                                        <span className="text-[var(--hud-text-dim)]">Status</span>
                                        <span className={embeddingResult.cached ? 'text-[var(--hud-success)]' : 'text-[var(--hud-warning)]'}>
                                            {embeddingResult.cached ? 'CACHE HIT' : 'CACHE MISS'}
                                        </span>
                                    </div>

                                    <div>
                                        <div className="text-[var(--hud-text-dim)] mb-1">Vector Preview (First 50 dims)</div>
                                        <div className="p-3 rounded bg-black border border-[var(--hud-border)] text-[var(--hud-accent)] break-all leading-relaxed">
                                            [{embeddingResult.embedding?.slice(0, 50).map(n => n.toFixed(4)).join(', ')}...]
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-[var(--hud-text-dim)] italic">
                                    Waiting for input...
                                </div>
                            )}
                        </CyberCard>
                    </div>
                )}

            </div>
        </div>
    );
}
