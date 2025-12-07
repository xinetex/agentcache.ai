import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { MetricFlux } from '../../components/dashboard/MetricFlux';
import { LiquidTraceFeed } from '../../components/dashboard/LiquidTraceFeed';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout';

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
        <div className="flex flex-col gap-8 h-full">
            {/* Header / HUD Integration */}
            <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                        Neural Glass
                    </h2>
                    <p className="text-xs font-mono text-white/40 uppercase tracking-widest mt-1">
                        System Observability Deck
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono animate-pulse">
                        LIVE
                    </span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricFlux
                    label="Cache Hit Rate"
                    value={`${metrics.hitRate}%`}
                    subValue="Global Efficiency"
                    icon="activity"
                    color="cyan"
                />
                <MetricFlux
                    label="Est. Savings"
                    value={`$${metrics.costSaved.toFixed(2)}`}
                    subValue="Today's ROI"
                    icon="dollar"
                    color="emerald"
                />
                <MetricFlux
                    label="Tokens Saved"
                    value={`${(metrics.tokensSaved / 1000).toFixed(1)}k`}
                    subValue="Bandwidth Preserved"
                    icon="shield"
                    color="amber"
                />
                <MetricFlux
                    label="Avg Latency"
                    value={`${metrics.latency}ms`}
                    subValue="Edge Performance"
                    icon="zap"
                    color="rose"
                />
            </div>

            {/* Live Feed */}
            <div className="flex-1 min-h-[400px]">
                <LiquidTraceFeed traces={traces} />
            </div>
        </div>
    );
}

