import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgeCheck,
    GitBranch,
    LockKeyhole,
    Radio,
    RefreshCw,
    ShieldCheck,
    Siren,
    Workflow,
} from 'lucide-react';

const fallbackMesh = {
    reliabilityScore: 0,
    posture: 'loading',
    killSwitch: { status: 'standby', reason: 'Loading reliability posture' },
    summary: {
        monitoredActions: 0,
        activeAgents: 0,
        receiptTotal: 0,
        driftEvaluations: 0,
        driftingEvaluations: 0,
        graphNodes: 0,
    },
    lanes: [],
    recentSignals: [],
    recentDrift: [],
};

function statusClass(status) {
    if (status === 'active' || status === 'operational') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    if (status === 'watch') return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    if (status === 'armed' || status === 'intervention') return 'border-rose-400/30 bg-rose-500/10 text-rose-200';
    return 'border-slate-400/30 bg-slate-500/10 text-slate-200';
}

function formatTime(value) {
    if (!value) return 'pending';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const Stat = ({ icon: Icon, label, value }) => (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">{label}</span>
            <Icon size={18} className="text-cyan-200" />
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
);

const ReliabilityMesh = () => {
    const [mesh, setMesh] = useState(fallbackMesh);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadMesh = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/observability/reliability-mesh');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load reliability mesh.');
            setMesh({ ...fallbackMesh, ...data });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMesh();
        const interval = setInterval(loadMesh, 30000);
        return () => clearInterval(interval);
    }, []);

    const topRisk = useMemo(() => {
        if (!mesh.lanes?.length) return null;
        return [...mesh.lanes].sort((a, b) => a.score - b.score)[0];
    }, [mesh.lanes]);

    return (
        <div className="space-y-6">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-3 text-emerald-200">
                        <ShieldCheck size={28} />
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--hud-text-dim)]">Agent Reliability Mesh</span>
                    </div>
                    <h1 className="mt-3 font-['Rajdhani'] text-4xl font-bold tracking-wide text-white">Reliability Mesh</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--hud-text-dim)]">
                        Live control plane for agent traces, policy enforcement, execution drift, audit receipts, and intervention posture.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={loadMesh}
                    disabled={loading}
                    className="btn-secondary inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                >
                    <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </section>

            {error && (
                <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={17} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <section className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
                <div className="glass rounded-lg p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Production Posture</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">A single score from drift, policy, receipts, and trace coverage.</p>
                        </div>
                        <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClass(mesh.posture)}`}>
                            {mesh.posture}
                        </span>
                    </div>

                    <div className="mt-8 flex items-end gap-4">
                        <div className="text-7xl font-semibold text-white">{mesh.reliabilityScore}</div>
                        <div className="pb-3 text-sm uppercase tracking-wide text-[var(--hud-text-dim)]">/ 100</div>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300"
                            style={{ width: `${Math.max(0, Math.min(100, mesh.reliabilityScore))}%` }}
                        />
                    </div>

                    <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Siren size={18} className={mesh.killSwitch?.status === 'armed' ? 'text-rose-300' : 'text-emerald-300'} />
                                <span className="text-sm font-semibold text-white">Kill Switch</span>
                            </div>
                            <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(mesh.killSwitch?.status)}`}>
                                {mesh.killSwitch?.status}
                            </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--hud-text-dim)]">{mesh.killSwitch?.reason}</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Stat icon={Workflow} label="Monitored Actions" value={mesh.summary.monitoredActions} />
                    <Stat icon={Radio} label="Active Agents" value={mesh.summary.activeAgents} />
                    <Stat icon={BadgeCheck} label="Receipts" value={mesh.summary.receiptTotal} />
                    <Stat icon={GitBranch} label="Drift Evaluations" value={mesh.summary.driftEvaluations} />
                    <Stat icon={AlertTriangle} label="Drifting" value={mesh.summary.driftingEvaluations} />
                    <Stat icon={LockKeyhole} label="Graph Nodes" value={mesh.summary.graphNodes} />
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="glass rounded-lg p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Control Lanes</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">The core reliability mesh from the enterprise memo, wired to live AgentCache signals.</p>
                        </div>
                        {topRisk && (
                            <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(topRisk.status)}`}>
                                watch: {topRisk.name}
                            </span>
                        )}
                    </div>

                    <div className="mt-5 grid gap-3">
                        {mesh.lanes.map((lane) => (
                            <div key={lane.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-white">{lane.name}</h3>
                                            <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(lane.status)}`}>{lane.status}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-[var(--hud-text-dim)]">{lane.signal}</p>
                                    </div>
                                    <div className="font-mono text-2xl text-white">{lane.score}</div>
                                </div>
                                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(0, Math.min(100, lane.score))}%` }} />
                                </div>
                                <div className="mt-3 text-xs uppercase tracking-wide text-cyan-200">{lane.control}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass rounded-lg p-5">
                        <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Recent Signals</h2>
                        <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
                            {mesh.recentSignals.length === 0 ? (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--hud-text-dim)]">
                                    No recent reliability signals.
                                </div>
                            ) : mesh.recentSignals.map((signal) => (
                                <div key={signal.id || `${signal.type}-${signal.timestamp}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{signal.type}</span>
                                        <span className="text-xs text-[var(--hud-text-dim)]">{formatTime(signal.timestamp)}</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-5 text-slate-300">{signal.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass rounded-lg p-5">
                        <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Drift Watch</h2>
                        <div className="mt-4 space-y-2">
                            {mesh.recentDrift.length === 0 ? (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--hud-text-dim)]">
                                    No shadow evaluations recorded yet.
                                </div>
                            ) : mesh.recentDrift.map((drift) => (
                                <div key={drift.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(drift.verdict)}`}>{drift.verdict}</span>
                                        <span className="font-mono text-sm text-white">{Math.round((drift.surpriseScore || 0) * 100)}%</span>
                                    </div>
                                    <p className="mt-2 text-xs text-[var(--hud-text-dim)]">
                                        {drift.actualPhase} vs expected {drift.expectedPhase}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ReliabilityMesh;
