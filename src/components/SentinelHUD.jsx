import React, { useState, useEffect } from 'react';
import { TrustCenter } from '../infrastructure/TrustCenter';

// Mocking the service import for the frontend component since TrustCenter is a backend class
// In a real app, this would fetch from an API endpoint.
const mockTelemetry = () => {
    const now = Date.now();
    return {
        active_nodes: 12,
        threats_blocked: 14205 + Math.floor((now % 100000) / 1000),
        global_latency_ms: 24 + Math.floor(Math.random() * 5),
        cache_efficiency: 94.5
    };
};

export default function SentinelHUD() {
    const [data, setData] = useState(mockTelemetry());

    useEffect(() => {
        const interval = setInterval(() => {
            setData(mockTelemetry());
        }, 1000);
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
