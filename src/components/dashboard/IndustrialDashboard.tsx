import React, { useState, useEffect } from 'react';
import { NeuralGlassLayout } from './NeuralGlassLayout.js';
import { MetricFlux } from './MetricFlux.js';
import { MoltbookGrowthPanel } from './MoltbookGrowthPanel.js';
import { MemoryFabricROIPanel } from './MemoryFabricROIPanel.js';
import { RevenueMonitor } from './RevenueMonitor.js';
import { RevenueCorePanel } from './RevenueCorePanel.js';
import AgentLeaderboard from './AgentLeaderboard.js';
import { CognitiveMap } from './CognitiveMap.js';
import { ComplianceHealthMonitor } from './ComplianceHealthMonitor.js';
import { SoulprintTrustPanel } from './SoulprintTrustPanel.js';
import { ReceiptInspector } from './ReceiptInspector.js';
import { ProviderTrustScorecard } from './ProviderTrustScorecard.js';
import { MetabolicPricingPanel } from './MetabolicPricingPanel.js';
import { AlignmentFabricPanel } from './AlignmentFabricPanel.js';
import { ExecutionDriftPanel } from './ExecutionDriftPanel.js';

export default function IndustrialDashboard() {
    const [stats, setStats] = useState<any>(null);
    const labsEnabled = import.meta.env.VITE_ENABLE_LABS === 'true';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/observability/stats');
                const data = await res.json();
                setStats(data);
            } catch (e) {
                console.error('Failed to load global stats', e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <NeuralGlassLayout>
            <div className="flex flex-col gap-8 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                {/* Top row metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                    <MetricFlux 
                        label="System Throughput" 
                        value={stats ? `${(stats.active_sessions * 10).toLocaleString()}` : "..."} 
                        subValue="Live Traffic" 
                        icon="activity" 
                        color="cyan" 
                    />
                    <MetricFlux 
                        label="Threats Blocked" 
                        value={stats ? stats.eventCounts?.POLICY || "0" : "..."} 
                        subValue="Cognitive Immune Active" 
                        icon="shield" 
                        color="rose" 
                    />
                    <MetricFlux 
                        label="Cache Efficiency" 
                        value={(stats && typeof stats.cache_hit_rate === 'number') ? `${stats.cache_hit_rate.toFixed(1)}%` : "..."} 
                        subValue="L2 Optimized" 
                        icon="zap" 
                        color="emerald" 
                    />
                    <MetricFlux 
                        label="Ops Cost Saved" 
                        value={(stats && typeof stats.cost_savings_usd === 'number') ? formatCurrency(stats.cost_savings_usd) : "..."} 
                        subValue="MTD Projection" 
                        icon="dollar" 
                        color="amber" 
                    />
                </div>

                {/* Middle row: Substrate Health & Market */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-6 shrink-0">
                    {labsEnabled ? <MoltbookGrowthPanel /> : <RevenueCorePanel />}
                    <ComplianceHealthMonitor />
                    <MemoryFabricROIPanel fabric={stats?.fabric} browserProof={stats?.browserProof} />
                    <ExecutionDriftPanel summary={stats?.executionDrift} />
                    {labsEnabled ? <MetabolicPricingPanel /> : <SoulprintTrustPanel externalAgents={stats?.externalAgents} />}
                    {labsEnabled ? <RevenueMonitor /> : <ProviderTrustScorecard summary={stats?.receipts} />}
                </div>

                {/* Infrastructure & Leaderboard */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative group hover:border-cyan-500/30 transition-all duration-500">
                        <CognitiveMap />
                    </div>
                    <div className="flex flex-col gap-6">
                        <AlignmentFabricPanel summary={stats?.alignment} />
                        <ProviderTrustScorecard summary={stats?.receipts} />
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex-1 group hover:border-emerald-500/30 transition-all duration-500">
                            <AgentLeaderboard />
                        </div>
                    </div>
                </div>

                {/* Evidence Spine: Receipt Inspector */}
                <div className="h-[600px] mb-10">
                    <ReceiptInspector />
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </NeuralGlassLayout>
    );
}
