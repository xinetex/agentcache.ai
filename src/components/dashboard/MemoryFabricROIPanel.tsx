import React from 'react';
import { Database, Coins, Gauge, ShieldCheck } from 'lucide-react';

type Props = {
    fabric?: {
        analytics?: any;
        accounting?: any;
    } | null;
};

function formatMoney(value?: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value || 0);
}

function formatCredits(value?: number) {
    if (!value) return '0.000';
    return `${value.toFixed(3)} cr`;
}

export function MemoryFabricROIPanel({ fabric }: Props) {
    const analytics = fabric?.analytics;
    const accounting = fabric?.accounting;
    const summary = analytics?.summary || {};
    const topSku = analytics?.bySku?.[0];

    return (
        <div className="p-6 bg-gradient-to-br from-cyan-950/30 via-slate-950/40 to-emerald-950/20 rounded-2xl border border-cyan-500/20 h-full backdrop-blur-xl group hover:border-cyan-400/40 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-cyan-300 transition-colors">Memory Fabric ROI</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Savings, evidence, and estimated billing by SKU</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-mono">
                    ROI_LEDGER
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-cyan-300">
                        <Gauge className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Hit Rate</p>
                    </div>
                    <p className="text-2xl font-mono text-white">{typeof summary.hitRate === 'number' ? `${summary.hitRate.toFixed(1)}%` : '0.0%'}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-emerald-300">
                        <Database className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Saved</p>
                    </div>
                    <p className="text-2xl font-mono text-emerald-300">{formatMoney(summary.estimatedUsdSaved)}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-amber-300">
                        <Coins className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Est. Credits</p>
                    </div>
                    <p className="text-2xl font-mono text-amber-300">{formatCredits(accounting?.totalCreditsEstimated)}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-violet-300">
                        <ShieldCheck className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Evidence</p>
                    </div>
                    <p className="text-2xl font-mono text-violet-300">{typeof summary.evidenceCoverageRate === 'number' ? `${summary.evidenceCoverageRate.toFixed(1)}%` : '0.0%'}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">Top SKU</span>
                    <span className="text-cyan-300 font-mono text-sm">{topSku?.sku || 'n/a'}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">Operations Today</span>
                    <span className="text-white font-mono text-sm">{summary.totalOperations || 0}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">TTL Clamp Events</span>
                    <span className="text-amber-300 font-mono text-sm">{summary.ttlClampCount || 0}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-white/60 text-sm">Billable USD</span>
                    <span className="text-rose-300 font-mono text-sm">{formatMoney(accounting?.usdEquivalent)}</span>
                </div>
            </div>

            <div className="mt-8">
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400 transition-all duration-1000"
                        style={{ width: `${Math.min(100, Number(summary.evidenceCoverageRate || 0))}%` }}
                    />
                </div>
                <p className="text-white/20 text-[9px] mt-2 text-center uppercase tracking-widest">Evidence-weighted memory substrate utilization</p>
            </div>
        </div>
    );
}
