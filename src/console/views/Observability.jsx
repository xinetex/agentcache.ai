import React, { useEffect, useState } from 'react';

export default function Observability() {
    const [decisions, setDecisions] = useState([]);
    const [selectedDecision, setSelectedDecision] = useState(null);
    const [loading, setLoading] = useState(true);
    const [crumbs, setCrumbs] = useState([]); // Visual crumbs

    // Fetch initial decisions
    const fetchDecisions = async () => {
        try {
            const res = await fetch('/api/decisions?limit=50');
            const data = await res.json();
            if (data.decisions) {
                setDecisions(data.decisions);
            }
        } catch (err) {
            console.error("Failed to fetch decisions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDecisions();

        // Connect to SSE Stream
        const eventSource = new EventSource('/api/events/stream');

        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);

            // Add visual crumb
            if (event.type !== 'sys:connected') {
                const id = Math.random().toString(36).substr(2, 9);
                setCrumbs(prev => [...prev, { id, ...event, x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 }]);

                // Remove crumb after animation
                setTimeout(() => {
                    setCrumbs(prev => prev.filter(c => c.id !== id));
                }, 2000);
            }

            // If it's a decision event, refresh list
            if (event.type === 'decision:recorded') {
                fetchDecisions();
            }
        };

        return () => {
            eventSource.close();
        };
    }, []);

    return (
        <div className="flex h-full bg-slate-950 text-slate-100 font-sans relative overflow-hidden">

            {/* Visual Crumb Overlay */}
            <div className="absolute inset-0 pointer-events-none z-50">
                {crumbs.map(crumb => (
                    <div
                        key={crumb.id}
                        className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-ping"
                        style={{ left: `${crumb.x}%`, top: `${crumb.y}%` }}
                    />
                ))}
            </div>

            {/* Sidebar: Decision Stream */}
            <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-900/50 backdrop-blur z-10">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-emerald-500">👁️</span> Observability
                    </h2>
                    <span className="text-xs text-slate-500 font-mono animate-pulse">LIVE STREAM</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading && <div className="p-4 text-center text-slate-500">Loading stream...</div>}

                    {decisions.map(decision => (
                        <div
                            key={decision.id}
                            onClick={() => setSelectedDecision(decision)}
                            className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedDecision?.id === decision.id
                                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                                }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-white uppercase tracking-wider">{decision.action}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                    {new Date(decision.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="text-xs text-slate-400 line-clamp-2 font-mono">
                                {decision.reasoning || "No reasoning provided."}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main: Detail View */}
            <div className="flex-1 p-8 overflow-y-auto z-10">
                {selectedDecision ? (
                    <div className="max-w-3xl mx-auto space-y-8">

                        <header>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase border border-emerald-500/30">
                                    {selectedDecision.action}
                                </div>
                                <span className="text-slate-500 text-sm font-mono">{selectedDecision.id}</span>
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-4">Decision Trace</h1>
                        </header>

                        {/* Reasoning Block */}
                        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Reasoning Chain</h3>
                            <p className="text-slate-300 leading-relaxed font-mono text-sm">
                                {selectedDecision.reasoning}
                            </p>
                        </section>

                        {/* Outcome Block */}
                        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Outcome</h3>
                            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800">
                                {JSON.stringify(selectedDecision.outcome, null, 2)}
                            </div>
                        </section>

                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <div className="text-6xl mb-4">👁️</div>
                        <p className="text-lg font-medium">Select a decision to inspect details</p>
                    </div>
                )}
            </div>

        </div>
    );
}
