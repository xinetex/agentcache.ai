import React, { useState, useEffect } from 'react';

export default function Overview() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const apiKey = localStorage.getItem('ac_api_key');
                if (!apiKey) return;

                const res = await fetch('/api/stats', {
                    headers: { 'X-API-Key': apiKey }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8 text-slate-400">Loading stats...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Overview</h2>
                <p className="text-slate-400">Real-time platform metrics</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Hit Rate Dial */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <h3 className="text-slate-400 text-sm font-medium absolute top-6 left-6">Cache Hit Rate</h3>
                    <div className="relative w-48 h-24 mt-8">
                        <svg className="w-full h-full" viewBox="0 0 200 100">
                            {/* Background Arc */}
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="20" strokeLinecap="round" />
                            {/* Value Arc */}
                            <path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke="#4ade80"
                                strokeWidth="20"
                                strokeLinecap="round"
                                strokeDasharray="251.2"
                                strokeDashoffset={251.2 * (1 - (stats?.hitRate || 0) / 100)}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                            <div className="text-4xl font-bold text-white">{stats?.hitRate || 0}%</div>
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                        {stats?.hits || 0} hits / {stats?.misses || 0} misses
                    </div>
                </div>

                {/* Traffic Chart (Simulated for Demo) */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-slate-400 text-sm font-medium mb-4">Request Traffic (24h)</h3>
                    <div className="h-48 w-full flex items-end gap-1">
                        {[...Array(24)].map((_, i) => {
                            const height = Math.random() * 80 + 20; // Mock data
                            return (
                                <div key={i} className="flex-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors rounded-t-sm relative group" style={{ height: `${height}%` }}>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                                        {Math.floor(height * 10)} reqs
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 mt-2">
                        <span>24h ago</span>
                        <span>12h ago</span>
                        <span>Now</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    label="Requests Today"
                    value={stats?.requestsToday || 0}
                    sub={`${(stats?.monthlyQuota || 10000) - (stats?.used || 0)} remaining`}
                    icon="📉"
                />
                <StatCard
                    label="Money Saved"
                    value={`$${(stats?.costSaved || 0).toFixed(2)}`}
                    valueColor="text-green-400"
                    sub="This month"
                    icon="💰"
                />
                <StatCard
                    label="Avg Latency"
                    value={`${stats?.avgLatency || 0}ms`}
                    valueColor="text-cyan-400"
                    sub={`P95: ${stats?.latencyP95 || 0}ms`}
                    icon="⚡"
                />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Cache Freshness Distribution</h3>
                <div className="flex h-4 rounded-full overflow-hidden mb-4">
                    <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(stats?.freshness?.fresh || 0) / ((stats?.freshness?.fresh || 1) + (stats?.freshness?.stale || 0) + (stats?.freshness?.expired || 0)) * 100}%` }}></div>
                    <div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: `${(stats?.freshness?.stale || 0) / ((stats?.freshness?.fresh || 1) + (stats?.freshness?.stale || 0) + (stats?.freshness?.expired || 0)) * 100}%` }}></div>
                    <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${(stats?.freshness?.expired || 0) / ((stats?.freshness?.fresh || 1) + (stats?.freshness?.stale || 0) + (stats?.freshness?.expired || 0)) * 100}%` }}></div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-green-500">{stats?.freshness?.fresh || 0}</div>
                        <div className="text-xs text-slate-400">Fresh</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-yellow-500">{stats?.freshness?.stale || 0}</div>
                        <div className="text-xs text-slate-400">Stale</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-red-500">{stats?.freshness?.expired || 0}</div>
                        <div className="text-xs text-slate-400">Expired</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, valueColor = "text-white", icon }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-4xl grayscale">
                {icon}
            </div>
            <div className="text-sm text-slate-400 mb-2">{label}</div>
            <div className={`text-3xl font-bold mb-1 ${valueColor}`}>{value}</div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
    );
}
