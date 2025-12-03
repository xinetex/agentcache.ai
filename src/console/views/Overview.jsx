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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    label="Requests Today"
                    value={stats?.requestsToday || 0}
                    sub={`${(stats?.monthlyQuota || 10000) - (stats?.used || 0)} remaining`}
                />
                <StatCard
                    label="Cache Hit Rate"
                    value={`${stats?.hitRate || 0}%`}
                    valueColor="text-green-400"
                    sub={`${stats?.hits || 0} hits / ${stats?.misses || 0} misses`}
                />
                <StatCard
                    label="Money Saved"
                    value={`$${(stats?.costSaved || 0).toFixed(2)}`}
                    valueColor="text-green-400"
                    sub="This month"
                />
                <StatCard
                    label="Avg Latency"
                    value={`${stats?.avgLatency || 0}ms`}
                    valueColor="text-cyan-400"
                    sub={`P95: ${stats?.latencyP95 || 0}ms`}
                />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Cache Freshness</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-3xl font-bold text-green-500">{stats?.freshness?.fresh || 0}</div>
                        <div className="text-sm text-slate-400">Fresh</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-yellow-500">{stats?.freshness?.stale || 0}</div>
                        <div className="text-sm text-slate-400">Stale</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-red-500">{stats?.freshness?.expired || 0}</div>
                        <div className="text-sm text-slate-400">Expired</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, valueColor = "text-white" }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="text-sm text-slate-400 mb-2">{label}</div>
            <div className={`text-4xl font-bold mb-1 ${valueColor}`}>{value}</div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
    );
}
