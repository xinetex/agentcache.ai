import React from 'react';
import { GitBranch, Lock, Radar } from 'lucide-react';

type AlignmentSummary = {
    totalRuns?: number;
    blockedRuns?: number;
    encryptedLinearRuns?: number;
    averageCompatibilityScore?: number;
    validatedPairs?: number;
    estimatedPairs?: number;
    blockedPairs?: number;
    storedBenchmarks?: number;
    byTargetProvider?: Array<{ provider: string; count: number }>;
};

type Props = {
    summary?: AlignmentSummary | null;
};

export function AlignmentFabricPanel({ summary }: Props) {
    const providerLeaders = (summary?.byTargetProvider || []).slice(0, 3);
    const compatibilityPct = Math.round((summary?.averageCompatibilityScore || 0) * 100);

    return (
        <div className="p-6 bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950 rounded-2xl border border-cyan-500/20 backdrop-blur-xl group hover:border-cyan-400/40 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-cyan-300 transition-colors">Alignment Fabric</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Cross-provider compatibility and private routing posture</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-mono">
                    ALIGN_V1
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-cyan-300 mb-1">
                        <GitBranch className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Validated Pairs</span>
                    </div>
                    <div className="text-2xl font-mono text-white">{summary?.validatedPairs ?? 0}</div>
                    <div className="text-[11px] text-white/40">{summary?.estimatedPairs ?? 0} estimated, {summary?.blockedPairs ?? 0} blocked</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center gap-2 text-emerald-300 mb-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Encrypted Linear</span>
                    </div>
                    <div className="text-2xl font-mono text-white">{summary?.encryptedLinearRuns ?? 0}</div>
                    <div className="text-[11px] text-white/40">{summary?.blockedRuns ?? 0} blocked runs</div>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/30 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-cyan-300">
                        <Radar className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest text-white/50">Average Compatibility</span>
                    </div>
                    <span className="text-sm font-mono text-white">{compatibilityPct}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${compatibilityPct}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-white/40">
                    {summary?.totalRuns ?? 0} routed runs, {summary?.storedBenchmarks ?? 0} stored benchmarks
                </div>
            </div>

            <div className="space-y-2">
                {providerLeaders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-center text-xs text-white/40">
                        Alignment targets will appear after runs or benchmarks are recorded.
                    </div>
                ) : providerLeaders.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                        <span className="text-sm font-mono text-white">{provider.provider}</span>
                        <span className="text-xs text-cyan-300 font-mono">{provider.count} routes</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
