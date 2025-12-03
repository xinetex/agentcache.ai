import React, { useEffect, useState } from 'react';
import { Eye, Activity, GitCommit, ArrowRight, Terminal } from 'lucide-react';
import CyberCard from '../components/CyberCard';

export default function Observability() {
    const [decisions, setDecisions] = useState([]);
    const [selectedDecision, setSelectedDecision] = useState(null);
    const [loading, setLoading] = useState(true);
    const [crumbs, setCrumbs] = useState([]);

    // Fetch initial decisions
    const fetchDecisions = async () => {
        try {
            const res = await fetch('/api/decisions?limit=20');
            const data = await res.json();

            if (data && data.decisions && data.decisions.length > 0) {
                setDecisions(data.decisions);
            } else {
                // Keep mock data only if no real data exists yet (for demo purposes)
                const mockDecisions = Array.from({ length: 5 }).map((_, i) => ({
                    id: `demo-${Math.random().toString(36).substr(2, 9)}`,
                    action: 'SYSTEM_READY',
                    timestamp: new Date().toISOString(),
                    reasoning: "System initialized. Waiting for live traffic...",
                    outcome: { status: "ready" }
                }));
                setDecisions(mockDecisions);
            }
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch decisions:", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDecisions();

        // Connect to SSE Stream
        const eventSource = new EventSource('/api/events/stream');

        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);

            if (event.type !== 'sys:connected') {
                const id = Math.random().toString(36).substr(2, 9);
                setCrumbs(prev => [...prev, { id, ...event, x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 }]);

                setTimeout(() => {
                    setCrumbs(prev => prev.filter(c => c.id !== id));
                }, 2000);
            }

            if (event.type === 'decision:recorded') {
                fetchDecisions();
            }
        };

        return () => {
            eventSource.close();
        };
    }, []);

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6 relative">

            {/* Visual Crumb Overlay (Global) */}
            <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                {crumbs.map(crumb => (
                    <div
                        key={crumb.id}
                        className="absolute w-2 h-2 rounded-full bg-[var(--hud-accent)] shadow-[0_0_10px_var(--hud-accent)] animate-ping"
                        style={{ left: `${crumb.x}%`, top: `${crumb.y}%` }}
                    />
                ))}
            </div>

            {/* Left: Decision Stream */}
            <div className="w-1/3 min-w-[300px] flex flex-col">
                <CyberCard title="Decision Stream" icon={Activity} className="h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {loading && <div className="p-4 text-center text-[var(--hud-text-dim)]">Loading stream...</div>}

                        {decisions.map(decision => (
                            <div
                                key={decision.id}
                                onClick={() => setSelectedDecision(decision)}
                                className={`p-3 rounded border cursor-pointer transition-all duration-200 group ${selectedDecision?.id === decision.id
                                    ? 'bg-[rgba(0,243,255,0.1)] border-[var(--hud-accent)]'
                                    : 'bg-[rgba(255,255,255,0.03)] border-transparent hover:border-[rgba(0,243,255,0.3)]'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${selectedDecision?.id === decision.id ? 'text-[var(--hud-accent)]' : 'text-white'
                                        }`}>
                                        {decision.action}
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--hud-text-dim)]">
                                        {new Date(decision.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-xs text-[var(--hud-text-dim)] line-clamp-2 font-mono group-hover:text-white transition-colors">
                                    {decision.reasoning}
                                </div>
                            </div>
                        ))}
                    </div>
                </CyberCard>
            </div>

            {/* Right: Inspection Panel */}
            <div className="flex-1 flex flex-col">
                <CyberCard title="Trace Inspector" icon={Eye} className="h-full flex flex-col">
                    {selectedDecision ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

                            {/* Header Info */}
                            <div className="flex items-center gap-4 pb-4 border-b border-[rgba(255,255,255,0.05)]">
                                <div className="w-12 h-12 rounded bg-[rgba(0,243,255,0.1)] flex items-center justify-center border border-[var(--hud-accent)]">
                                    <GitCommit size={24} className="text-[var(--hud-accent)]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedDecision.action}</h2>
                                    <p className="text-xs font-mono text-[var(--hud-text-dim)]">ID: {selectedDecision.id}</p>
                                </div>
                            </div>

                            {/* Reasoning Chain */}
                            <div>
                                <h3 className="text-xs font-bold text-[var(--hud-accent)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ArrowRight size={14} /> Reasoning Chain
                                </h3>
                                <div className="p-4 rounded bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] font-mono text-sm text-white leading-relaxed">
                                    {selectedDecision.reasoning}
                                </div>
                            </div>

                            {/* Outcome Data */}
                            <div className="flex-1">
                                <h3 className="text-xs font-bold text-[var(--hud-success)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Terminal size={14} /> Execution Outcome
                                </h3>
                                <div className="p-4 rounded bg-black border border-[rgba(255,255,255,0.1)] font-mono text-xs text-[var(--hud-success)] overflow-x-auto">
                                    <pre>{JSON.stringify(selectedDecision.outcome, null, 2)}</pre>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[var(--hud-text-dim)] opacity-50">
                            <Activity size={64} className="mb-4 animate-pulse" />
                            <p className="font-['Rajdhani'] text-lg tracking-wide">SELECT A TRACE TO INSPECT</p>
                        </div>
                    )}
                </CyberCard>
            </div>

        </div>
    );
}
