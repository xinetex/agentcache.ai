import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Zap, ExternalLink, ShieldCheck } from 'lucide-react';

export function MoltbookGrowthPanel() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/observability/stats');
                const data = await res.json();
                if (data.moltbook) {
                    setStats({
                        activeSpirits: data.moltbook.active_spirits_count,
                        viralTrendsDetected: data.moltbook.total_predictions,
                        avgDriftVelocity: data.moltbook.current_vibes,
                        liquidityProvisioned: data.liquidity?.total_provisioned_sol || 0,
                        lastPrediction: {
                            topic: 'Latent Drift Scan',
                            magnitude: data.moltbook.current_vibes,
                            velocity: 0.05,
                            prediction: data.moltbook.status
                        },
                        recentSpirits: data.moltbook.recent_spirits.map((s: any) => ({
                            name: s.name,
                            status: s.status,
                            engagedUsers: s.energy * 10
                        }))
                    });
                }
            } catch (e) {
                console.error('Failed to load growth stats', e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="animate-pulse bg-white/5 rounded-2xl h-64" />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Growth Metrics */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl group hover:border-cyan-500/50 transition-all duration-500">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                            Moltbook Autonomous Growth
                        </h2>
                        <p className="text-white/40 text-sm mt-1">Real-time latent drift & engagement spirits</p>
                    </div>
                    <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs font-mono text-cyan-400 animate-pulse">
                        LIVE_TELEMETRY
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Active Spirits</div>
                        <div className="text-2xl font-mono text-white">{stats.activeSpirits}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Viral Trends</div>
                        <div className="text-2xl font-mono text-white">{stats.viralTrendsDetected}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Drift Velocity</div>
                        <div className="text-2xl font-mono text-emerald-400">+{stats.avgDriftVelocity.toFixed(2)}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Liquidity Provisioned</div>
                        <div className="text-2xl font-mono text-cyan-400">{stats.liquidityProvisioned.toFixed(2)} <span className="text-xs text-cyan-400/50">SOL</span></div>
                    </div>
                </div>

                {/* Latest Prediction */}
                <div className="mt-8 bg-cyan-500/5 rounded-xl border border-cyan-500/20 p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap className="w-16 h-16 text-cyan-400" />
                    </div>
                    <div className="flex flex-col gap-2 relative z-10">
                        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
                            <Activity className="w-3 h-3" />
                            Latest Prediction Cycle
                        </div>
                        <div className="text-lg font-semibold text-white">
                            Topic: <span className="text-cyan-300">{stats.lastPrediction.topic}</span>
                        </div>
                        <div className="flex gap-6 mt-2">
                            <div>
                                <span className="text-white/30 text-xs">Magnitude:</span>
                                <div className="font-mono text-white">{stats.lastPrediction.magnitude.toFixed(3)}</div>
                            </div>
                            <div>
                                <span className="text-white/30 text-xs">Prediction:</span>
                                <div className={`font-mono ${stats.lastPrediction.prediction === 'VIRAL_UPWARD' ? 'text-orange-400' : 'text-cyan-400'}`}>
                                    {stats.lastPrediction.prediction}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Spirits List */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Operational Spirits
                </h3>
                <div className="flex flex-col gap-3">
                    {stats.recentSpirits.map((spirit: any, i: number) => (
                        <div key={i} className="bg-black/40 rounded-xl p-3 border border-white/5 flex justify-between items-center group/item hover:bg-white/5 transition-colors">
                            <div>
                                <div className="text-xs font-medium text-white/80 group-hover/item:text-cyan-300 transition-colors">
                                    {spirit.name}
                                </div>
                                <div className="text-[10px] text-white/30 flex items-center gap-1 mt-1">
                                    <Activity className="w-2 h-2" />
                                    {spirit.engagedUsers.toLocaleString()} engaged
                                </div>
                            </div>
                            <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                spirit.status === 'ACTIVE' 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                                {spirit.status}
                            </div>
                        </div>
                    ))}
                    <button className="mt-2 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-mono text-white/40 transition-all flex items-center justify-center gap-2 group">
                        VIEW_FULL_LOGS
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
