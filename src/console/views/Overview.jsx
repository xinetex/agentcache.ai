import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Server, Shield, Clock } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import StatDial from '../components/StatDial';
import DataGrid from '../components/DataGrid';

const Overview = () => {
    const [metrics, setMetrics] = useState({
        requests: 2458921,
        bandwidth: 845,
        latency: 42,
        savings: 1240
    });

    // Mock Live Events
    const [events, setEvents] = useState([
        { id: 1, type: 'CACHE_HIT', source: 'Agent-Alpha', hash: '8f2a...9b1c', time: '10:42:01' },
        { id: 2, type: 'OPTIMIZATION', source: 'Swarm-Beta', hash: '3d4e...1f2a', time: '10:41:58' },
        { id: 3, type: 'SEC_SCAN', source: 'Sentinel-01', hash: 'SCAN_COMPLETE', time: '10:41:45' },
        { id: 4, type: 'CACHE_MISS', source: 'Agent-Gamma', hash: '1a2b...3c4d', time: '10:41:30' },
    ]);

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
                        <StatDial value={98} label="Uptime" sublabel="30 Days" color="var(--hud-success)" />
                        <StatDial value={87} label="Cache Hit" sublabel="Global" color="var(--hud-accent)" />
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
                            <h3 className="text-2xl font-mono font-bold text-white">2.4M</h3>
                        </div>
                        <Zap className="text-[var(--hud-accent)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>↑ 12.5%</span>
                        <span className="text-[var(--hud-text-dim)] ml-1">vs last week</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Bandwidth Saved</p>
                            <h3 className="text-2xl font-mono font-bold text-white">845 GB</h3>
                        </div>
                        <Server className="text-[var(--hud-accent-secondary)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>↑ 8.2%</span>
                        <span className="text-[var(--hud-text-dim)] ml-1">vs last week</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Avg Latency</p>
                            <h3 className="text-2xl font-mono font-bold text-white">42ms</h3>
                        </div>
                        <Activity className="text-[var(--hud-warning)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>↓ 15ms</span>
                        <span className="text-[var(--hud-text-dim)] ml-1">improvement</span>
                    </div>
                </CyberCard>

                <CyberCard className="p-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[var(--hud-text-dim)] text-xs uppercase tracking-wider mb-1">Cost Savings</p>
                            <h3 className="text-2xl font-mono font-bold text-white">$1,240</h3>
                        </div>
                        <Shield className="text-[var(--hud-success)] opacity-50" size={24} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--hud-success)] flex items-center">
                        <span>↑ 18%</span>
                        <span className="text-[var(--hud-text-dim)] ml-1">vs last week</span>
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
                                <span className={`text-xs font-bold px-2 py-1 rounded ${row.type === 'CACHE_HIT' ? 'bg-green-500/10 text-green-400' :
                                        row.type === 'CACHE_MISS' ? 'bg-red-500/10 text-red-400' :
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
            </CyberCard>
        </div>
    );
};

export default Overview;
