import React from 'react';
import { Fingerprint, ShieldCheck, ScanSearch, BrainCircuit } from 'lucide-react';

type SummaryBucket<T extends string> = Array<{ [K in T]: string } & { count: number }>;

type Props = {
    externalAgents?: {
        total?: number;
        verified?: number;
        pending?: number;
        withSoulprint?: number;
        bySector?: SummaryBucket<'sector'>;
        byBiasFlag?: SummaryBucket<'biasFlag'>;
    } | null;
};

export function SoulprintTrustPanel({ externalAgents }: Props) {
    const total = externalAgents?.total || 0;
    const verified = externalAgents?.verified || 0;
    const withSoulprint = externalAgents?.withSoulprint || 0;
    const topSector = externalAgents?.bySector?.[0]?.sector || 'n/a';
    const topBias = externalAgents?.byBiasFlag?.[0]?.biasFlag || 'n/a';
    const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0;

    return (
        <div className="p-6 bg-gradient-to-br from-fuchsia-950/25 via-slate-950/40 to-cyan-950/20 rounded-2xl border border-fuchsia-500/20 h-full backdrop-blur-xl group hover:border-fuchsia-400/40 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-fuchsia-300 transition-colors">Soulprint Trust</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">External agents, preregistration, and bias visibility</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[10px] text-fuchsia-300 font-mono">
                    SOULPRINT
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-fuchsia-300">
                        <Fingerprint className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Registered</p>
                    </div>
                    <p className="text-2xl font-mono text-white">{total}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-emerald-300">
                        <ShieldCheck className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Verified</p>
                    </div>
                    <p className="text-2xl font-mono text-emerald-300">{verified}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-cyan-300">
                        <ScanSearch className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Scanned</p>
                    </div>
                    <p className="text-2xl font-mono text-cyan-300">{withSoulprint}</p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-1 text-violet-300">
                        <BrainCircuit className="w-3 h-3" />
                        <p className="text-[10px] uppercase font-bold text-white/50">Verified Rate</p>
                    </div>
                    <p className="text-2xl font-mono text-violet-300">{verificationRate}%</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">Top Sector</span>
                    <span className="text-fuchsia-300 font-mono text-sm">{topSector}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">Top Bias Signal</span>
                    <span className="text-cyan-300 font-mono text-[11px]">{topBias}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-white/60 text-sm">Pending Review</span>
                    <span className="text-amber-300 font-mono text-sm">{externalAgents?.pending || 0}</span>
                </div>
            </div>

            <div className="mt-8">
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-emerald-400 transition-all duration-1000"
                        style={{ width: `${Math.min(100, verificationRate)}%` }}
                    />
                </div>
                <p className="text-white/20 text-[9px] mt-2 text-center uppercase tracking-widest">
                    Ownership-verified preregistration trust substrate
                </p>
            </div>
        </div>
    );
}
