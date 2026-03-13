import React from 'react';
import { NeuralGlassLayout } from './NeuralGlassLayout.js';
import { MetricFlux } from './MetricFlux.js';
import { MoltbookGrowthPanel } from './MoltbookGrowthPanel.js';
import AgentLeaderboard from './AgentLeaderboard.js';
import { CognitiveMap } from './CognitiveMap.js';

export default function IndustrialDashboard() {
    return (
        <NeuralGlassLayout>
            <div className="flex flex-col gap-8 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                {/* Top row metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                    <MetricFlux 
                        label="System Throughput" 
                        value="1.2M" 
                        subValue="+12% from yesterday" 
                        icon="activity" 
                        color="cyan" 
                    />
                    <MetricFlux 
                        label="Threats Blocked" 
                        value="42" 
                        subValue="Cognitive Immune Active" 
                        icon="shield" 
                        color="rose" 
                    />
                    <MetricFlux 
                        label="Cache Efficiency" 
                        value="92.4%" 
                        subValue="L1/L2 Optimal" 
                        icon="zap" 
                        color="emerald" 
                    />
                    <MetricFlux 
                        label="Ops Cost Saved" 
                        value="$12,450" 
                        subValue="MTD Projection" 
                        icon="dollar" 
                        color="amber" 
                    />
                </div>

                {/* Middle row: Moltbook Growth Panel */}
                <div className="shrink-0">
                    <MoltbookGrowthPanel />
                </div>

                {/* Bottom row: Infrastructure & Leaderboard */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px] pb-10">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative group hover:border-cyan-500/30 transition-all duration-500">
                        <CognitiveMap />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                        <AgentLeaderboard />
                    </div>
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
