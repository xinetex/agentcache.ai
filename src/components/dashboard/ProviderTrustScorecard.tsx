import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import type { SharedReceiptSummary } from '../../services/SharedReceiptService.js';

type ProviderStats = {
    system: string;
    totalReceipts: number;
    passRate: number;
    avgConfidence: number;
    avgLatency: number;
    status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
};

type Props = {
    summary?: SharedReceiptSummary | null;
};

export function ProviderTrustScorecard({ summary }: Props) {
    const [providers, setProviders] = useState<ProviderStats[]>([]);

    useEffect(() => {
        if (!summary?.providers) {
            setProviders([]);
            return;
        }

        setProviders(
            summary.providers.map((provider) => ({
                system: provider.system,
                totalReceipts: provider.totalReceipts,
                passRate: provider.passRate * 100,
                avgConfidence: provider.averageConfidence * 100,
                avgLatency: provider.averageLatencyMs,
                status: provider.status,
            })),
        );
    }, [summary]);

    return (
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 rounded-2xl border border-indigo-500/20 h-full backdrop-blur-xl group hover:border-indigo-400/40 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-indigo-300 transition-colors">Composite Trust Scorecards</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Provider-level integrity and performance audit</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-mono">
                    TRUST_CORE
                </div>
            </div>

            <div className="space-y-4">
                {providers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-xs text-white/40">
                        Provider trust scores will appear after receipt telemetry is ingested.
                    </div>
                ) : providers.map((p) => (
                    <div key={p.system} className="bg-black/40 p-4 rounded-xl border border-white/5 group/provider hover:border-indigo-500/30 transition-all">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                    p.status === 'OPTIMAL' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                                    p.status === 'DEGRADED' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                                    'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                }`} />
                                <span className="text-sm font-bold text-white tracking-wider font-mono">{p.system}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400' : 
                                p.status === 'DEGRADED' ? 'bg-amber-500/10 text-amber-400' : 
                                'bg-rose-500/10 text-rose-400'
                            }`}>
                                {p.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <p className="text-[9px] uppercase font-bold text-white/30 mb-1">Pass Rate</p>
                                <p className="text-sm font-mono text-emerald-300">{p.passRate.toFixed(1)}%</p>
                            </div>
                            <div className="text-center border-l border-white/5">
                                <p className="text-[9px] uppercase font-bold text-white/30 mb-1">Conf</p>
                                <p className="text-sm font-mono text-cyan-300">{p.avgConfidence.toFixed(1)}%</p>
                            </div>
                            <div className="text-center border-l border-white/5">
                                <p className="text-[9px] uppercase font-bold text-white/30 mb-1">Latency</p>
                                <p className="text-sm font-mono text-white/80">{Math.round(p.avgLatency)}ms</p>
                            </div>
                        </div>

                        <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${
                                    p.passRate > 95 ? 'bg-emerald-500' : p.passRate > 80 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${p.passRate}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10 flex items-start gap-3">
                <Shield className="w-4 h-4 text-indigo-400 mt-0.5" />
                <p className="text-[10px] text-white/50 leading-relaxed italic">
                    Aggregate scores are weighted by evidence density and subject kind criticality. Real-time drift detection active.
                </p>
            </div>
        </div>
    );
}
