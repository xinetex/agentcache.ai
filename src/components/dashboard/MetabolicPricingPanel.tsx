import React from 'react';
import { Zap, Coins, Activity, Scaling, Calculator } from 'lucide-react';
import { calculateMetabolicPrice, formatMicros } from '../../lib/metabolicPricing.js';

export function MetabolicPricingPanel() {
    // Mock factors based on real-ish dashboard data
    const factors = {
        basePriceMicros: 1000, // $0.001
        latencyMs: 1450,
        retries: 1,
        evidenceDensity: 0.85,
        confidence: 0.98,
        isBrowserBacked: true
    };

    const price = calculateMetabolicPrice(factors);

    return (
        <div className="p-6 bg-gradient-to-br from-amber-950/20 via-slate-950/40 to-rose-950/20 rounded-2xl border border-amber-500/20 h-full backdrop-blur-xl group hover:border-amber-400/40 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-amber-300 transition-colors">Metabolic Pricing</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Resource-aware billing dynamic prototype</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono">
                    METABOLIC_V1
                </div>
            </div>

            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Scaling className="w-16 h-16 text-amber-500" />
                </div>
                
                <div className="flex items-center gap-3 mb-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">Effective Unit Price</span>
                </div>
                <p className="text-4xl font-mono text-white tracking-tighter">{formatMicros(price)}</p>
                <div className="mt-2 text-[10px] text-emerald-400/70 font-mono">
                    +{( (price / factors.basePriceMicros - 1) * 100 ).toFixed(1)}% Metabolic Premium
                </div>
            </div>

            <div className="space-y-4">
                <PriceFactor label="Efficiency Drag" value={`${(factors.latencyMs / 1000).toFixed(1)}s + ${factors.retries}R`} pct={((1 + (factors.latencyMs / 1000) * 0.1 + (factors.retries * 0.2)) * 100).toFixed(0)} color="rose" />
                <PriceFactor label="Proof Premium" value={factors.isBrowserBacked ? 'BROWSER_BACKED' : 'STANDARD'} pct={factors.isBrowserBacked ? '150' : '100'} color="cyan" />
                <PriceFactor label="Integrity Weight" value={`${(factors.confidence * 100).toFixed(0)}% CONF`} pct={((0.5 + (factors.confidence * 0.3) + (factors.evidenceDensity * 0.2)) * 100).toFixed(0)} color="emerald" />
            </div>

            <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase font-bold text-white/40 tracking-widest group-hover:border-amber-500/30 transition-all cursor-default">
                    <Calculator className="w-3 h-3" />
                    Evidence-Backed escaped price validation
                </div>
            </div>
        </div>
    );
}

function PriceFactor({ label, value, pct, color }: { label: string, value: string, pct: string, color: string }) {
    const colorMap: any = {
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };

    return (
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
            <div>
                <p className="text-[9px] uppercase font-bold text-white/30 tracking-widest mb-0.5">{label}</p>
                <p className="text-xs text-white font-mono">{value}</p>
            </div>
            <div className={`px-2 py-1 rounded-lg border font-mono text-xs ${colorMap[color]}`}>
                x{ (Number(pct) / 100).toFixed(1) }
            </div>
        </div>
    );
}
