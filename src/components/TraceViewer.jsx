import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, AlertTriangle, Clock, Database, Server } from 'lucide-react';

export default function TraceViewer({ traceId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!traceId) return;

        const fetchTrace = async () => {
            try {
                setLoading(true);
                // Determine base URL based on environment (local vs production)
                const baseUrl = window.location.hostname === 'localhost' ? '' : 'https://agentcache.ai';
                const res = await fetch(`${baseUrl}/api/trace?id=${traceId}`);

                if (!res.ok) throw new Error('Failed to load trace');

                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrace();
    }, [traceId]);

    if (!traceId) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-mono">TRACE</span>
                            {traceId}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            {data ? new Date(data.timestamp).toLocaleString() : 'Loading...'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                            <AlertTriangle size={20} />
                            {error}
                        </div>
                    )}

                    {data && (
                        <div className="space-y-6">
                            {/* Top Metrics Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Total Latency"
                                    value={`${data.summary.totalLatency}ms`}
                                    icon={<Clock size={16} />}
                                    color="text-blue-400"
                                />
                                <MetricCard
                                    label="Cache Hit Rate"
                                    value={`${data.summary.cacheHitRate}%`}
                                    sub={`Hits: ${data.summary.cacheHits} / Misses: ${data.summary.cacheMisses}`}
                                    icon={<Database size={16} />}
                                    color={data.summary.cacheHitRate > 50 ? "text-emerald-400" : "text-amber-400"}
                                />
                                <MetricCard
                                    label="Total Cost"
                                    value={`$${data.summary.totalCost}`}
                                    sub={`Saved: $${data.summary.estimatedSavings}`}
                                    icon={<div className="font-bold text-xs">$</div>}
                                    color="text-purple-400"
                                />
                                <MetricCard
                                    label="Errors"
                                    value={data.summary.errors}
                                    icon={<AlertTriangle size={16} />}
                                    color={data.summary.errors > 0 ? "text-red-400" : "text-slate-400"}
                                />
                            </div>

                            {/* Hit/Miss Visualization */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/30 rounded-lg p-5 border border-slate-700">
                                    <h3 className="text-sm font-medium text-slate-300 mb-4">Cache Performance</h3>
                                    <div className="flex items-center gap-8">
                                        {/* Donut Chart */}
                                        <div className="relative w-32 h-32">
                                            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                                {/* Background */}
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="#334155"
                                                    strokeWidth="3"
                                                />
                                                {/* Hit Segment */}
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="#10b981"
                                                    strokeWidth="3"
                                                    strokeDasharray={`${data.summary.cacheHitRate}, 100`}
                                                    className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                                <span className="text-2xl font-bold text-white">{data.summary.cacheHitRate}%</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">HIT RATE</span>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="space-y-3 flex-1">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                                    <span className="text-sm text-slate-300">Hits (L1/L2/L3)</span>
                                                </div>
                                                <span className="font-mono text-emerald-400">{data.summary.cacheHits}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                                                    <span className="text-sm text-slate-300">Misses (Origin)</span>
                                                </div>
                                                <span className="font-mono text-slate-400">{data.summary.cacheMisses}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-800/30 rounded-lg p-5 border border-slate-700">
                                    <h3 className="text-sm font-medium text-slate-300 mb-4">Model Usage</h3>
                                    <div className="space-y-3">
                                        {data.byProvider.map((p, i) => (
                                            <div key={i} className="space-y-1">
                                                <div className="flex justify-between text-xs text-slate-400">
                                                    <span>{p.provider} ({p.models.join(', ')})</span>
                                                    <span>{p.requests} reqs</span>
                                                </div>
                                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-purple-500 rounded-full"
                                                        style={{ width: `${(p.requests / data.summary.totalSpans) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Span Waterfall / List */}
                            <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50">
                                    <h3 className="text-sm font-medium text-slate-300">Trace Spans</h3>
                                </div>
                                <div className="divide-y divide-slate-700">
                                    {data.spans.map((span, i) => (
                                        <div key={i} className="p-4 hover:bg-slate-800/50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    <StatusBadge status={span.status} />
                                                    <span className="font-medium text-slate-200">{span.name}</span>
                                                    {span.cached && (
                                                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                            CACHED
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-mono text-slate-500">
                                                    {span.duration}ms
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-sm mt-2 pl-2 border-l-2 border-slate-700 ml-1">
                                                <div>
                                                    <span className="text-slate-500 text-xs block">Input</span>
                                                    <div className="text-slate-300 font-mono text-xs bg-black/20 p-2 rounded mt-1 truncate">
                                                        {span.attributes?.prompt?.slice(0, 100) || 'No prompt data'}...
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 text-xs block">Output</span>
                                                    <div className="text-slate-300 font-mono text-xs bg-black/20 p-2 rounded mt-1 truncate">
                                                        {span.attributes?.completion?.slice(0, 100) || 'No output data'}...
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon, color }) {
    return (
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-md bg-slate-800 ${color}`}>
                    {icon}
                </div>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
        </div>
    );
}

function StatusBadge({ status }) {
    if (status === 'success') {
        return <Check size={16} className="text-emerald-400" />;
    }
    return <AlertTriangle size={16} className="text-red-400" />;
}
