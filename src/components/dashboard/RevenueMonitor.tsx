import React, { useState, useEffect } from 'react';

export function RevenueMonitor() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/economy/stats');
                const json = await res.json();
                setData(json);
                setLoading(false);
            } catch (e) {
                console.error('Failed to fetch economy stats', e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) {
        return (
            <div className="p-6 bg-white/5 animate-pulse rounded-2xl h-full flex items-center justify-center text-cyan-400/50">
                Initializing Economy Stream...
            </div>
        );
    }

    return (
        <div className="p-6 bg-gradient-to-br from-white/10 to-transparent rounded-2xl border border-white/10 h-full backdrop-blur-xl group hover:border-cyan-500/30 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-cyan-400 transition-colors">Substrate Revenue</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Real-time Financial Vibe</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono animate-pulse">
                    LIVE_LEDGER
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <p className="text-white/40 text-[10px] uppercase font-bold">Total Volume</p>
                    <p className="text-2xl font-mono text-white mt-1">{(typeof data.totalVolume === 'number') ? data.totalVolume.toFixed(2) : '0.00'} <span className="text-xs text-white/30">SOL</span></p>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <p className="text-white/40 text-[10px] uppercase font-bold">Platform Fee</p>
                    <p className="text-2xl font-mono text-cyan-400 mt-1">{(typeof data.totalFees === 'number') ? data.totalFees.toFixed(2) : '0.00'} <span className="text-xs text-cyan-400/30">SOL</span></p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">Tx Velocity</span>
                    <span className="text-white font-mono text-sm">{data.velocity || '0.00'} <span className="text-[10px] text-white/40">/hr</span></span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/60 text-sm">System Integrity</span>
                    <span className="text-emerald-400 font-mono text-sm">{data.isIntegral ? 'OPTIMAL' : 'DRIFT'}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-white/60 text-sm">Unaccounted Flux</span>
                    <span className="text-rose-400 font-mono text-sm">{(typeof data.drift === 'number') ? data.drift.toFixed(4) : '0.0000'} <span className="text-[10px] text-rose-400/40">SOL</span></span>
                </div>
            </div>

            <div className="mt-8">
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500 transition-all duration-1000"
                        style={{ width: `${Math.min(100, ((typeof data.totalVolume === 'number' ? data.totalVolume : 0) / 100) * 100)}%` }}
                    />
                </div>
                <p className="text-white/20 text-[9px] mt-2 text-center uppercase tracking-widest">Substrate Saturation Index</p>
            </div>
        </div>
    );
}
