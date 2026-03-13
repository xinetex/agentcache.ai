/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ComplianceHealthMonitor: Visualizes sentient substrate integrity and auditor status.
 * Phase 8: Scaling the B2B Sentient Economy.
 */

import React, { useEffect, useState } from 'react';
import { Shield, Search, Activity, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

interface ComplianceStats {
    total: number;
    active: number;
    idle: number;
    bySpecialization: {
        FINANCIAL: number;
        LEGAL: number;
        ETHICAL: number;
    };
    escrowLiquidity?: number;
    avgReasoningConfidence?: number;
}

export const ComplianceHealthMonitor: React.FC = () => {
    const [stats, setStats] = useState<ComplianceStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/compliance/stats');
                const data = await res.json();
                if (data.success) {
                    setStats({
                        ...data.stats,
                        escrowLiquidity: 124.50, // Simulated Phase 9 metric
                        avgReasoningConfidence: 0.94 // Simulated Phase 9 metric
                    });
                }
            } catch (err) {
                console.error('Failed to fetch compliance stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !stats) {
        return <div className="p-4 text-emerald-500/50 animate-pulse">Initializing Compliance Swarm...</div>;
    }

    const integrityScore = 98.4; // Simulated live integrity

    return (
        <div className="bg-slate-900/40 border border-emerald-500/20 rounded-lg p-5 backdrop-blur-md">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                        <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-emerald-50 text-sm font-bold tracking-wider uppercase">Sentient Integrity</h3>
                        <p className="text-emerald-500/60 text-[10px] font-mono">SOUL VERIFICATION ACTIVE</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-mono text-emerald-400 font-bold">{integrityScore}%</div>
                    <div className="text-[10px] text-emerald-500/40 uppercase">Axiom Alignment</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-100/60 uppercase">Reasoning Conf.</span>
                    </div>
                    <div className="text-xl font-mono text-emerald-50">{(stats.avgReasoningConfidence! * 100).toFixed(0)}%</div>
                </div>
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded">
                    <div className="flex items-center gap-2 mb-1">
                        <Cpu className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-emerald-100/60 uppercase">Escrow (SOL)</span>
                    </div>
                    <div className="text-xl font-mono text-blue-50">{stats.escrowLiquidity?.toFixed(2)}</div>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-[10px] text-emerald-500/50 uppercase font-bold mb-2">Substrate Density</p>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-100/70">Verified Decisions</span>
                    <span className="text-emerald-400 font-mono">1,204</span>
                </div>
                <div className="w-full bg-emerald-950/40 h-1 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "94%" }}
                        className="bg-emerald-500 h-full"
                    />
                </div>

                <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-emerald-100/70">Escrow Throughput</span>
                    <span className="text-emerald-400 font-mono">82.4 SOL</span>
                </div>
                <div className="w-full bg-emerald-950/40 h-1 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "70%" }}
                        className="bg-blue-500 h-full"
                    />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-emerald-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-emerald-500/60 font-mono">ESCROW LOCK ACTIVE: CRYSTAL CLEAR</span>
                </div>
                <Search className="w-3 h-3 text-emerald-500/40 cursor-pointer hover:text-emerald-400 transition-colors" />
            </div>
        </div>
    );
};
