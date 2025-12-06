import React, { useState, useEffect } from 'react';
import { TrustCenter } from '../infrastructure/TrustCenter';

// Real Telemetry Integration
const fetchTelemetry = async () => {
    try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json();
    } catch (e) {
        console.warn('Telemetry offline, using fallback', e);
        return {
            active_nodes: 0,
            threats_blocked: 0,
            global_latency_ms: 0,
            cache_efficiency: 0
        };
    }
};

export default function SentinelHUD() {
    const [data, setData] = useState({
        active_nodes: 0,
        threats_blocked: 0,
        global_latency_ms: 0,
        cache_efficiency: 0
    });

    useEffect(() => {
        // Initial Fetch
        fetchTelemetry().then(setData);

        // Polling
        const interval = setInterval(async () => {
            const fresh = await fetchTelemetry();
            setData(fresh);
        }, 3000); // 3s polling to be nice to the server
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between z-10">
            {/* Top Bar */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-xs font-mono text-blue-400 mb-1">SYSTEM STATUS</div>
                    <div className="text-2xl font-bold text-white tracking-widest">SENTINEL <span className="text-green-400">ONLINE</span></div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-mono text-blue-400 mb-1">SECURE CONNECTION</div>
                    <div className="text-xl font-mono text-white">TLS 1.3 / AES-256</div>
                </div>
            </div>

            {/* Center Reticle (Decorative) */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-blue-500/20 rounded-full flex items-center justify-center">
                <div className="w-60 h-60 border border-dashed border-blue-500/10 rounded-full animate-spin-slow"></div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-4 gap-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-blue-500/30">
                <div>
                    <div className="text-xs font-mono text-slate-400">ACTIVE NODES</div>
                    <div className="text-2xl font-bold text-blue-400">{data.active_nodes}</div>
                </div>
                <div>
                    <div className="text-xs font-mono text-slate-400">THREATS BLOCKED</div>
                    <div className="text-2xl font-bold text-red-400">{data.threats_blocked.toLocaleString()}</div>
                </div>
                <div>
                    <div className="text-xs font-mono text-slate-400">GLOBAL LATENCY</div>
                    <div className="text-2xl font-bold text-green-400">{data.global_latency_ms}ms</div>
                </div>
                <div>
                    <div className="text-xs font-mono text-slate-400">CACHE EFFICIENCY</div>
                    <div className="text-2xl font-bold text-purple-400">{data.cache_efficiency}%</div>
                </div>
            </div>
        </div>
    );
}
