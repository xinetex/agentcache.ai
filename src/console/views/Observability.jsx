import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { MetricFlux } from '../../components/dashboard/MetricFlux';
import { LiquidTraceFeed } from '../../components/dashboard/LiquidTraceFeed';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout';
import { CognitiveMap } from '../../components/dashboard/CognitiveMap';
import AgentLeaderboard from '../../components/dashboard/AgentLeaderboard';

export default function Observability() {
    const { token } = useAuth();
    const [metrics, setMetrics] = useState({
        requests: 0,
        hitRate: 0,
        tokensSaved: 0,
        costSaved: 0,
        latency: 0
    });
    const [traces, setTraces] = useState([]);

    // Fetch Metrics
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/observability/stats');
                const data = await res.json();
                if (!data.error) setMetrics(data);
            } catch (err) {
                console.error("Stats Error:", err);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    // Subscribe to Live Feed
    useEffect(() => {
        const eventSource = new EventSource('/api/observability/stream');

        eventSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.type === 'traces' && Array.isArray(payload.data)) {
                    // Parse inner JSON strings if redis returned strings
                    const newTraces = payload.data.map(t => typeof t === 'string' ? JSON.parse(t) : t);

                    setTraces(prev => {
                        // Deduplicate based on ID
                        const existingIds = new Set(prev.map(t => t.id));
                        const uniqueNew = newTraces.filter(t => !existingIds.has(t.id));
                        if (uniqueNew.length === 0) return prev;
                        return [...uniqueNew, ...prev].slice(0, 50); // Keep last 50
                    });
                }
            } catch (err) {
                console.error("Stream Parse Error:", err);
            }
        };

        return () => eventSource.close();
    }, []);

    // We render inside the existing App shell, but we want to maximize the "Liquid" feel.
    // We can inject the NeuralGlassLayout styles or just use the inner parts.
    // Let's use the inner layout structure but responsive.

    return (
        <div className="flex flex-col gap-6 h-full pb-6">
            {/* 0. Status Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                    <h2 className="text-xl font-bold tracking-[0.2em] text-white">AGENTCACHE</h2>
                    <div className="h-4 w-px bg-white/20" />
                    <span className="text-xs font-mono text-emerald-500 tracking-widest">SYSTEM ONLINE</span>
                </div>

                <div className="flex items-center gap-8 bg-black/40 border border-white/10 rounded-full px-6 py-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Grid Status</span>
                        <span className="text-xs text-emerald-400 font-bold font-mono">OPTIMAL</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Latency</span>
                        <span className="text-xs text-cyan-400 font-bold font-mono">{metrics.latency}ms</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Active Agents</span>
                        <span className="text-xs text-white font-bold font-mono">8,492</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-white/40">
                    <span className="font-mono text-xs">{new Date().toLocaleTimeString('en-US', { hour12: false })} UTC</span>
                </div>
            </div>

            {/* Main 3-Column Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* COL 1: Live Discoveries */}
                <div className="lg:col-span-1 min-h-0 flex flex-col">
                    <DiscoveryFeed />
                </div>

                {/* COL 2: Cognitive Map (Vis) + Experiments */}
                <div className="lg:col-span-2 min-h-0 flex flex-col gap-4 relative">
                    <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                        <CognitiveMap />
                        {/* Experiment Overlay at Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                            <ExperimentCard />
                        </div>
                    </div>
                </div>

                {/* COL 3: Top Agents */}
                <div className="lg:col-span-1 min-h-0 flex flex-col">
                    <AgentLeaderboard />
                </div>
            </div>

            {/* Bottom Stream (Optional - kept for data density) */}
            <div className="flex-none h-32 border-t border-white/5 pt-4">
                <LiquidTraceFeed traces={traces} />
            </div>
        </div>
    );
}
