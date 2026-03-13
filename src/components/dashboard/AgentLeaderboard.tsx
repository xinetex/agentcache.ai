
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
                                        <span className={`text-[10px] font-mono ${row.isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {row.status.toUpperCase()} {row.isOnline ? '(ONLINE)' : '(OFFLINE)'}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                header: 'CURRENT TASK',
                                accessor: 'currentTask',
                                render: (row) => (
                                    <span className="text-[10px] font-mono text-white/50 truncate max-w-[150px] inline-block">
                                        {row.currentTask ? row.currentTask.goal : 'IDLE'}
                                    </span>
                                )
                            },
                            {
                                header: 'LAST SEEN',
                                accessor: 'lastSeen',
                                render: (row) => (
                                    <span className="font-mono text-white/30 text-[10px]">
                                        {new Date(row.lastSeen).toLocaleTimeString()}
                                    </span>
                                )
                            },
                            {
                                header: 'IDENTITY',
                                accessor: 'hasPassport',
                                render: (row) => (
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${row.hasPassport ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-white/10'}`} title={row.hasPassport ? 'Sovereign Passport Active' : 'No Passport'} />
                                        <span className={`text-[10px] font-mono ${row.hasPassport ? 'text-cyan-400' : 'text-white/20'}`}>
                                            {row.hasPassport ? 'SOVEREIGN' : 'GUEST'}
                                        </span>
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
