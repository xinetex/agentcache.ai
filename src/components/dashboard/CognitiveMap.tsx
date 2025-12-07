import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Snowflake, X, Zap } from 'lucide-react';

interface Cluster {
    id: string;
    label: string;
    size: number;
    state: 'liquid' | 'crystallized';
    value: number;
    color: string;
    x: number;
    y: number;
    count: number;
}

interface NetworkStatus {
    server: { region: string; status: string };
    connectivity: { name: string; latency: number; status: string }[];
}

export function CognitiveMap() {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [network, setNetwork] = useState<NetworkStatus | null>(null);
    const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch REAL Data
    const fetchData = async () => {
        try {
            const [clusterRes, networkRes] = await Promise.all([
                fetch('/api/observability/clusters'),
                fetch('/api/observability/network')
            ]);

            const clusterData = await clusterRes.json();
            const networkData = await networkRes.json();

            if (Array.isArray(clusterData)) {
                setClusters(clusterData);
            }
            setNetwork(networkData);
        } catch (err) {
            console.error("Failed to map cognitive landscape:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll real data every 10s
        return () => clearInterval(interval);
    }, []);

    const crystallize = (id: string) => {
        // TODO: Call API to pin
        setClusters(prev => prev.map(c =>
            c.id === id ? { ...c, state: 'crystallized', color: 'bg-cyan-400', value: c.value * 1.5 } : c
        ));
    };

    return (
        <div className="relative w-full h-full bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* LED Map Background (Real World Data Layer) */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                {/* World Dot Grid */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}></div>

                {/* Real Server Location Pulse */}
                <div className="absolute top-[40%] left-[20%]">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute" />
                    <div className="w-2 h-2 bg-emerald-500 rounded-full relative" />
                    <div className="text-[10px] text-emerald-500 font-mono mt-2 whitespace-nowrap">
                        SERVER_LOC: {network?.server.region?.toUpperCase() || 'SEARCHING...'}
                    </div>
                </div>

                {/* Connectivity Lines to Real Hubs */}
                <svg className="absolute inset-0 w-full h-full">
                    <line x1="20%" y1="40%" x2="50%" y2="30%" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="5,5" />
                    <line x1="20%" y1="40%" x2="50%" y2="60%" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="5,5" />
                </svg>
            </div>

            {/* Header / HUD */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3 pointer-events-none">
                <div className="w-10 h-10 rounded-lg bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-cyan-400">
                    <Globe size={20} />
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm tracking-widest uppercase">Global Neural Map</h3>
                    <div className="flex items-center gap-2 text-white/40 text-xs font-mono">
                        {loading ? 'CALIBRATING...' : (
                            <>
                                <span className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${network?.server.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    SYSTEM {network?.server.status.toUpperCase()}
                                </span>
                                <span className="text-white/20">|</span>
                                <span>NET_LATENCY: {network?.connectivity[0]?.latency || 0}ms</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Clusters (Real Redis Data) */}
            {clusters.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 font-mono text-sm pointer-events-none z-20">
                    WAITING FOR NEURAL TRAFFIC...
                </div>
            )}

            {clusters.map((cluster) => (
                <motion.div
                    key={cluster.id}
                    className={`absolute rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center group ${cluster.color} bg-opacity-20 border border-white/20`}
                    style={{
                        left: `${cluster.x}%`,
                        top: `${cluster.y}%`,
                        width: Math.max(60, cluster.size * 1.5),
                        height: Math.max(60, cluster.size * 1.5),
                    }}
                    drag
                    dragMomentum={false}
                    initial={{ scale: 0 }}
                    animate={{
                        scale: 1,
                        boxShadow: cluster.state === 'crystallized'
                            ? '0 0 30px rgba(6,182,212,0.4)'
                            : '0 0 0 rgba(0,0,0,0)'
                    }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setSelectedCluster(cluster)}
                >
                    {/* Inner Core */}
                    <div className={`w-3 h-3 rounded-full ${cluster.state === 'crystallized' ? 'bg-white animate-pulse' : cluster.color.replace('bg-', 'text-')}`} />

                    {/* Label (Hover) */}
                    <div className="absolute -bottom-8 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-xs text-white pointer-events-none z-30">
                        {cluster.label} ({cluster.count})
                    </div>

                    {/* Crystal Effect Overlay */}
                    {cluster.state === 'crystallized' && (
                        <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-20 mix-blend-overlay rounded-full" />
                    )}
                </motion.div>
            ))}

            {/* Inspector Modal / Detail View */}
            <AnimatePresence>
                {selectedCluster && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/95 backdrop-blur-xl border-l border-white/10 p-6 z-40 flex flex-col"
                    >
                        <button
                            onClick={() => setSelectedCluster(null)}
                            className="absolute top-4 right-4 text-white/40 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <div className="mt-8 mb-6">
                            <div className="text-xs text-white/40 font-mono uppercase tracking-widest mb-2">Live Semantic Cluster</div>
                            <h2 className="text-2xl font-bold text-white mb-2 break-words">{selectedCluster.label}</h2>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${selectedCluster.state === 'crystallized'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                    }`}>
                                    {selectedCluster.state === 'crystallized' ? 'Asset (Frozen)' : 'Liquid (Active)'}
                                </span>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase">Trace Volume</div>
                                <div className="text-xl font-mono text-emerald-400">{selectedCluster.count}</div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="text-[10px] text-white/40 uppercase">Avg Value</div>
                                <div className="text-xl font-mono text-white">${(selectedCluster.value / (selectedCluster.count || 1)).toFixed(4)}</div>
                            </div>
                        </div>

                        {/* Action */}
                        <div className="mt-auto">
                            {selectedCluster.state === 'liquid' ? (
                                <button
                                    onClick={() => crystallize(selectedCluster.id)}
                                    className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 group transition-all"
                                >
                                    <Snowflake className="group-hover:rotate-12 transition-transform" />
                                    Crystallize Intelligence
                                </button>
                            ) : (
                                <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-2">
                                    <Snowflake size={18} />
                                    Asset Frozen
                                </div>
                            )}
                            <p className="text-[10px] text-center text-white/20 mt-3">
                                Freezing converts this logic pattern into a permanent L3 asset.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
