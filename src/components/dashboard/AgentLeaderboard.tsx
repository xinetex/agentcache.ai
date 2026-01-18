
import React, { useState, useEffect } from 'react';
import { Trophy, Activity, Zap, Server } from 'lucide-react';
import CyberCard from '../../console/components/CyberCard.jsx';
import DataGrid from '../../console/components/DataGrid.jsx';
import { motion } from 'framer-motion';

export default function AgentLeaderboard() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/observability/agents');
            const data = await res.json();
            if (Array.isArray(data)) {
                setAgents(data);
            }
        } catch (err) {
            console.error("Failed to fetch agent leaderboard:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // 5s refresh
        return () => clearInterval(interval);
    }, []);

    // Helper for cost badge color
    const getEfficiencyColor = (hitRate) => {
        if (hitRate > 70) return 'text-[var(--hud-success)]';
        if (hitRate > 30) return 'text-[var(--hud-accent)]';
        return 'text-[var(--hud-warning)]';
    };

    return (
        <CyberCard title="Top Agents" icon={Trophy} className="h-full flex flex-col">
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-[var(--hud-text-dim)] font-mono animate-pulse">
                    SCANNING NETWORK...
                </div>
            ) : agents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--hud-text-dim)] font-mono opacity-50 space-y-2">
                    <Server size={32} />
                    <span>NO ACTIVE AGENTS</span>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <DataGrid
                        columns={[
                            {
                                header: 'AGENT',
                                accessor: 'name',
                                render: (row) => (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white text-sm">{row.name.toUpperCase()}</span>
                                        <span className="text-[10px] text-[var(--hud-text-dim)] font-mono">{row.provider}</span>
                                    </div>
                                )
                            },
                            {
                                header: 'THROUGHPUT',
                                accessor: 'requests',
                                render: (row) => <span className="font-mono text-[var(--hud-accent)]">{row.requests.toLocaleString()} ops</span>
                            },
                            {
                                header: 'LATENCY',
                                accessor: 'avgLatency',
                                render: (row) => (
                                    <div className="flex items-center gap-1">
                                        <Activity size={12} className={row.avgLatency < 500 ? 'text-[var(--hud-success)]' : 'text-[var(--hud-warning)]'} />
                                        <span className="font-mono text-white text-xs">{row.avgLatency}ms</span>
                                    </div>
                                )
                            },
                            {
                                header: 'EFFICIENCY',
                                accessor: 'hitRate',
                                render: (row) => (
                                    <div className={`flex items-center gap-1 font-bold ${getEfficiencyColor(row.hitRate)}`}>
                                        <Zap size={12} />
                                        <span>{row.hitRate}%</span>
                                    </div>
                                )
                            },
                        ]}
                        data={agents}
                    />
                </div>
            )}
        </CyberCard>
    );
}
