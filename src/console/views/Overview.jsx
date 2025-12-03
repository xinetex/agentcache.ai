import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Server, Shield, Clock } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import StatDial from '../components/StatDial';
import DataGrid from '../components/DataGrid';

import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Server, Shield, Clock } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import StatDial from '../components/StatDial';
import DataGrid from '../components/DataGrid';

const Overview = () => {
    const [metrics, setMetrics] = useState({
        requests: 0,
        bandwidth: 0,
        latency: 0,
        savings: 0,
        hitRate: 0,
        uptime: 100
    });
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch Metrics
        const fetchMetrics = async () => {
            try {
                const res = await fetch('/api/admin-stats', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('agentcache_token')}` }
                });
                const data = await res.json();

                if (data && !data.error) {
                    setMetrics({
                        requests: data.total_requests_today || 0,
                        bandwidth: Math.round((data.tokens_saved_today || 0) / 1000), // Approx KB/MB
                        latency: 42, // Still mocked as we don't have real latency stats yet
                        savings: data.cost_saved_today ? parseFloat(data.cost_saved_today.replace('$', '')) : 0,
                        hitRate: data.hit_rate || 0,
                        uptime: 99.9
                    });
                }
            } catch (err) {
                console.error("Failed to fetch admin stats:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

        // Connect to Event Stream
        const eventSource = new EventSource('/api/events/stream');

        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
            if (event.type === 'sys:connected') return;

            const newEvent = {
                id: Date.now(),
                type: event.type.toUpperCase(),
                source: event.agentId || 'System',
                hash: event.hash ? `${event.hash.substring(0, 8)}...` : '-',
                time: new Date().toLocaleTimeString()
            };

            setEvents(prev => [newEvent, ...prev].slice(0, 10));
        };

        return () => {
            clearInterval(interval);
            eventSource.close();
        };
    }, []);

    return (
        <div className="space-y-6">
            {/* Top Row: Global Status & Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Global Map Placeholder */}
                <CyberCard title="Global Grid Status" icon={Globe} className="lg:col-span-2 min-h-[300px]">
                    <div className="w-full h-full flex items-center justify-center bg-[rgba(0,0,0,0.3)] rounded border border-[rgba(255,255,255,0.05)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--hud-accent)_0%,_transparent_70%)] opacity-10 animate-pulse"></div>
                        <div className="text-center">
                            <Globe size={64} className="mx-auto text-[var(--hud-accent)] opacity-50 mb-4" />
                            <p className="text-[var(--hud-text-dim)] font-mono text-sm">
                                GRID VISUALIZATION ONLINE<br />
                                <span className="text-[var(--hud-success)]">3 REGIONS ACTIVE</span>
                            </p>
                        </div>
                    </div>
                </CyberCard>

                {/* System Health Dials */}
                <CyberCard title="System Health" icon={Activity} className="flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-4">
                        <StatDial value={metrics.uptime} label="Uptime" sublabel="30 Days" color="var(--hud-success)" />
                        <StatDial value={metrics.hitRate} label="Cache Hit" sublabel="Global" color="var(--hud-accent)" />
                        <StatDial value={42} max={100} label="CPU Load" sublabel="Cluster" color="var(--hud-warning)" />
                        <StatDial value={12} max={100} label="Memory" sublabel="Usage" color="var(--hud-accent-secondary)" />
                    </div>
                </CyberCard>
            </div>

            {/* Middle Row: Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Total Requests</p>
                            <h3 className="text-2xl font-mono font-bold text-white">
                                {metrics.requests.toLocaleString()}
                            </h3>
                        </div>
                        <Zap className="text-[var(--hud-accent)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>Today</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Tokens Saved</p>
                            <h3 className="text-2xl font-mono font-bold text-white">
                                {metrics.bandwidth.toLocaleString()} k
                            </h3>
                        </div>
                        <Server className="text-[var(--hud-accent-secondary)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>Est. Bandwidth</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Avg Latency</p>
                            <h3 className="text-2xl font-mono font-bold text-white">{metrics.latency}ms</h3>
                        </div>
                        <Activity className="text-[var(--hud-warning)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>Global Avg</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Cost Savings</p>
                            <h3 className="text-2xl font-mono font-bold text-white">${metrics.savings.toFixed(2)}</h3>
                        </div>
                        <Shield className="text-[var(--hud-success)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>Today</span>
                    </div>
                </CyberCard>
            </div>

            {/* Bottom Row: Live Event Log */}
            <CyberCard title="Live Event Stream" icon={Clock} action={<button className="text-xs text-[var(--hud-accent)] hover:underline">View All</button>}>
                <DataGrid
                    columns={[
                        { header: 'Time', accessor: 'time' },
                        {
                            header: 'Type', accessor: 'type', render: (row) => (
                                <span className={`text-xs font-bold px-2 py-1 rounded ${row.type.includes('HIT') ? 'bg-green-500/10 text-green-400' :
                                    row.type.includes('MISS') ? 'bg-red-500/10 text-red-400' :
                                        'bg-blue-500/10 text-blue-400'
                                    }`}>
                                    {row.type}
                                </span>
                            )
                        },
                        { header: 'Source', accessor: 'source' },
                        { header: 'Hash / ID', accessor: 'hash', render: (row) => <span className="font-mono text-[var(--hud-text-dim)]">{row.hash}</span> },
                    ]}
                    data={events}
                />
                {events.length === 0 && (
                    <div className="p-4 text-center text-[var(--hud-text-dim)] italic">Waiting for events...</div>
                )}
            </CyberCard>
        </div>
    );
};

export default Overview;
