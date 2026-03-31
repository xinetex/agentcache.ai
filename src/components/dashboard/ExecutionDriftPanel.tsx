import React from 'react';
import { ActivitySquare, AlertTriangle, ScanSearch } from 'lucide-react';

type RecentEvaluation = {
    id: string;
    runId: string;
    verdict: 'stable' | 'watch' | 'drifting';
    actualPhase: string;
    expectedPhase: string;
    surpriseScore: number;
    createdAt: string;
};

type ExecutionDriftSummary = {
    totalEvaluations?: number;
    stableEvaluations?: number;
    watchEvaluations?: number;
    driftingEvaluations?: number;
    averageSurpriseScore?: number;
    recentEvaluations?: RecentEvaluation[];
};

type Props = {
    summary?: ExecutionDriftSummary | null;
};

function verdictTone(verdict: RecentEvaluation['verdict']) {
    if (verdict === 'drifting') return 'text-rose-300 border-rose-500/20 bg-rose-500/10';
    if (verdict === 'watch') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
    return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
}

export function ExecutionDriftPanel({ summary }: Props) {
    const averageSurprisePct = Math.round((summary?.averageSurpriseScore || 0) * 100);
    const recent = summary?.recentEvaluations || [];

    return (
        <div className="p-6 bg-gradient-to-br from-slate-950 via-rose-950/20 to-slate-950 rounded-2xl border border-rose-500/20 backdrop-blur-xl group hover:border-rose-400/35 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-rose-200 transition-colors">Execution Drift Guard</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Shadow-mode execution plausibility monitoring</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 font-mono">
                    SHADOW
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-emerald-300 mb-1">
                        <ActivitySquare className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Stable</span>
                    </div>
                    <div className="text-2xl font-mono text-white">{summary?.stableEvaluations ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-amber-300 mb-1">
                        <ScanSearch className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Watch</span>
                    </div>
                    <div className="text-2xl font-mono text-white">{summary?.watchEvaluations ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-rose-300 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Drifting</span>
                    </div>
                    <div className="text-2xl font-mono text-white">{summary?.driftingEvaluations ?? 0}</div>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/30 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">Average Surprise</span>
                    <span className="text-sm font-mono text-white">{averageSurprisePct}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${averageSurprisePct}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-white/40">
                    {summary?.totalEvaluations ?? 0} shadow evaluations recorded
                </div>
            </div>

            <div className="space-y-2">
                {recent.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-center text-xs text-white/40">
                        Shadow evaluations will appear after execution runs are scored.
                    </div>
                ) : recent.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-sm font-mono text-white truncate">{item.runId}</span>
                            <span className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-widest font-mono ${verdictTone(item.verdict)}`}>
                                {item.verdict}
                            </span>
                        </div>
                        <div className="text-[11px] text-white/45">
                            expected {item.expectedPhase} {'→'} actual {item.actualPhase}
                        </div>
                        <div className="text-[11px] text-rose-200/80 mt-1">
                            surprise {(item.surpriseScore * 100).toFixed(1)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
