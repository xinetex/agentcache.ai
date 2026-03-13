/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * B2BMarketPanel: Real-time observability for B2B swarms.
 */

import React, { useState, useEffect } from 'react';
import { Briefcase, TrendingUp, BarChart, Globe, Shield, Zap, ShieldCheck } from 'lucide-react';

export function B2BMarketPanel() {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/b2b/market-context?clientId=client-alpha-99');
                const data = await res.json();
                if (data.success) setStats(data.stats);
            } catch (e) {
                console.error('Failed to load B2B stats', e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 15000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return <div className="p-6 text-white/20 animate-pulse">Loading Market Context...</div>;

    return (
        <div className="p-6 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Briefcase className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">B2B Service Silos</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3" /> Bullish
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Active Swarms</div>
                    <div className="text-2xl font-mono text-white">{stats.active_swarms}</div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 group">
                    <div className="text-[10px] text-amber-400 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                        Shadow Value (Δm) <Shield className="w-3 h-3" />
                    </div>
                    <div className="text-2xl font-mono text-amber-400">${stats.measurability_gap.toFixed(2)}</div>
                    <div className="text-[8px] text-white/20 mt-1 uppercase">Unbilled Latent Utility</div>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-bold tracking-widest px-1 mb-3">
                        <BarChart className="w-3 h-3" /> Niche Distribution
                    </div>
                    <div className="space-y-2">
                        {stats.top_niches.map((niche: string) => (
                            <div key={niche} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg group hover:bg-white/5 transition-colors">
                                <span className="text-xs text-white/60 font-medium">{niche}</span>
                                <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500/60 w-3/4 group-hover:bg-amber-400 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between px-1 mb-3">
                        <div className="flex items-center gap-2 text-[10px] text-red-400 uppercase font-bold tracking-widest">
                            <Zap className="w-3 h-3" /> Detected Vacuum Zones
                        </div>
                        <div className="text-[8px] font-mono text-white/20 uppercase">
                            Probes Sent: {stats.outreach_stats.total_sent}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {stats.detected_vacuums.map((v: any) => (
                            <div key={v.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-red-400 uppercase">{v.sector}</span>
                                    <span className="text-[10px] font-mono text-red-400/60">${v.revenue_potential.toLocaleString()} Potential</span>
                                </div>
                                <p className="text-[10px] text-white/40 leading-tight italic">"{v.gap_description}"</p>
                            </div>
                        ))}
                    </div>
                </div>

                {stats.active_negotiations.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 text-[10px] text-blue-400 uppercase font-bold tracking-widest px-1 mb-3">
                            <ShieldCheck className="w-3 h-3" /> A2A Negotiation Monitor
                        </div>
                        <div className="space-y-2">
                            {stats.active_negotiations.map((n: any) => (
                                <div key={n.id} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg group transition-all hover:bg-blue-500/10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-blue-400 uppercase">{n.targetSector}</span>
                                        <span className="text-[10px] font-mono text-blue-400">${n.valuationOffer.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1 w-full bg-blue-500/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-400 transition-all duration-1000" 
                                                style={{ width: n.currentStage === 'SIGNED' ? '100%' : n.currentStage === 'ACCEPTED' ? '80%' : '40%' }}
                                            />
                                        </div>
                                        <span className="text-[8px] font-bold text-blue-400/60 uppercase whitespace-nowrap">{n.currentStage}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
                <button className="w-full h-10 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all">
                    <Globe className="w-3 h-3" /> Launch Global Outreach
                </button>
            </div>
        </div>
    );
}
