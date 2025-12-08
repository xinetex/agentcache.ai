
import React, { useState } from 'react';
import { FlaskConical, Zap, ArrowRight, Database, Brain, Network, Share2, Activity } from 'lucide-react';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout'; // Fixed Import

export default function Lab() {
    const [activeTab, setActiveTab] = useState('compression');

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-4">
                    <FlaskConical className="text-purple-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Research Lab</h2>
                        <p className="text-xs text-white/40 font-mono">Experimental Features & Prototypes</p>
                    </div>
                </div>
                {/* Tab Switcher */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    <button
                        onClick={() => setActiveTab('compression')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold font-mono transition-all ${activeTab === 'compression' ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'text-white/40 hover:text-white'}`}
                    >
                        COMPRESSION
                    </button>
                    <button
                        onClick={() => setActiveTab('intelligence')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold font-mono transition-all ${activeTab === 'intelligence' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-white/40 hover:text-white'}`}
                    >
                        HIVE MIND
                    </button>
                </div>
            </div>

            {activeTab === 'compression' ? <CompressionLab /> : <IntelligenceLab />}
        </div>
    );
}

function CompressionLab() {
    const [input, setInput] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ratio, setRatio] = useState('16x');

    const handleCompress = async () => {
        if (!input) return;
        setLoading(true);
        try {
            const res = await fetch('/api/cognitive/compress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: input, compression_ratio: ratio })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <NeuralGlassLayout className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-cyan-400 font-mono">SOURCE DOCUMENT</label>
                    <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="bg-black/40 border border-white/10 rounded text-xs text-white px-2 py-1 font-mono outline-none">
                        <option value="16x">16x Compression</option>
                        <option value="32x">32x Compression</option>
                        <option value="128x">128x Compression</option>
                    </select>
                </div>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste long context..." className="flex-1 bg-black/20 border border-white/10 rounded-lg p-4 text-sm font-mono text-white/80 resize-none outline-none focus:border-purple-500/50 transition-colors" />
            </div>

            <div className="flex flex-col gap-4 relative">
                <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 hidden lg:block">
                    <button onClick={handleCompress} disabled={loading || !input} className={`p-3 rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all ${loading ? 'bg-purple-500/10' : 'bg-black hover:bg-purple-500/20 text-purple-400'}`}>
                        {loading ? <Zap size={24} className="animate-spin" /> : <ArrowRight size={24} />}
                    </button>
                </div>
                <div className="flex justify-between items-center"><label className="text-sm font-bold text-purple-400 font-mono">COGNITIVE MEMORY</label></div>
                <div className={`flex-1 rounded-lg border border-white/10 p-4 font-mono text-sm overflow-hidden ${result ? 'bg-purple-900/10 border-purple-500/30' : 'bg-black/20 border-dashed'}`}>
                    {result ? (
                        <>
                            <div className="text-white/90 break-all">{result.compressed_text}</div>
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                                <div className="flex flex-col"><span className="text-[10px] text-white/40">SAVED</span><span className="text-xl font-bold text-emerald-400">{result.stats.saved_tokens} tokens</span></div>
                                <div className="flex flex-col"><span className="text-[10px] text-white/40">VALUE</span><span className="text-xl font-bold text-white">{result.stats.saved_cost}</span></div>
                            </div>
                        </>
                    ) : <div className="flex flex-col items-center justify-center h-full text-white/20"><Database size={48} className="opacity-50" /><p>Waiting...</p></div>}
                </div>
            </div>
        </NeuralGlassLayout>
    );
}

function IntelligenceLab() {
    const [query, setQuery] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!query) return;
        setLoading(true);
        try {
            // Parallel execution: Route Analysis + Prediction
            const [routerRes, predictRes] = await Promise.all([
                fetch('/api/router/route', { method: 'POST', body: JSON.stringify({ prompt: query }) }),
                fetch('/api/predict', { method: 'POST', body: JSON.stringify({ query }) })
            ]);

            const routerData = await routerRes.json();
            const predictData = await predictRes.json();

            setAnalysis({ router: routerData, predictions: predictData.predictions });
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <NeuralGlassLayout className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            <div className="flex flex-col gap-6">
                <div>
                    <label className="text-sm font-bold text-cyan-400 font-mono mb-2 block">USER INTENT INPUT</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            placeholder='Try "What is weather?" or "Compare quantum mechanics..."'
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-4 pr-12 text-lg font-mono text-white outline-none focus:border-cyan-500/50 transition-colors"
                        />
                        <button onClick={handleAnalyze} className="absolute right-2 top-2 p-2 text-cyan-400 hover:text-white transition-colors">
                            {loading ? <Activity className="animate-spin" /> : <Share2 />}
                        </button>
                    </div>
                </div>

                {/* Prediction Engine Output */}
                <div className="flex-1 bg-black/20 border border-white/10 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-white/40 mb-4 flex items-center gap-2">
                        <Network size={14} /> PREDICTIVE SYNAPSE (What you might ask next)
                    </h3>
                    <div className="space-y-3">
                        {analysis?.predictions ? (
                            analysis.predictions.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5">
                                    <span className="text-cyan-300 font-mono text-sm">{p.query}</span>
                                    <span className="text-xs font-bold text-emerald-400">{(p.probability * 100).toFixed(0)}%</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-white/20 py-8 italic">Waiting for input signal...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Router Visualization */}
            <div className="flex flex-col gap-4">
                <div className="text-sm font-bold text-purple-400 font-mono">COGNITIVE ROUTER (System 2 Decision)</div>
                <div className="flex-1 bg-black/20 border border-white/10 rounded-lg p-6 relative overflow-hidden flex flex-col items-center justify-center gap-8">

                    {analysis?.router ? (
                        <>
                            {/* Complexity Meter */}
                            <div className="w-full text-center">
                                <div className="text-xs text-white/40 mb-2 font-mono uppercase">COMPLEXITY SCORE</div>
                                <div className="text-4xl font-bold text-white mb-2">{(analysis.router.signals.complexity * 100).toFixed(0)}<span className="text-lg text-white/40">/100</span></div>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-1000 ${analysis.router.signals.complexity > 0.7 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${analysis.router.signals.complexity * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Routing Decision */}
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2 w-32 transition-all ${analysis.router.route === 'cache' ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-110' : 'opacity-30'}`}>
                                    <Database size={24} />
                                    <span className="text-xs font-bold">CACHE</span>
                                </div>
                                <div className="h-0.5 w-8 bg-white/10" />
                                <div className={`p-4 rounded-xl border border-white/10 flex flex-col items-center gap-2 w-32 transition-all ${analysis.router.route === 'system_2' ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-110' : 'opacity-30'}`}>
                                    <Brain size={24} />
                                    <span className="text-xs font-bold">SYSTEM 2</span>
                                </div>
                            </div>

                            <div className="text-center font-mono text-sm text-white/60">
                                ROUTED TO: <span className="text-white font-bold uppercase">{analysis.router.route.replace('_', ' ')}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-white/20">
                            <Brain size={64} className="mx-auto mb-4 opacity-20" />
                            <div>Awaiting neural input...</div>
                        </div>
                    )}
                </div>
            </div>
        </NeuralGlassLayout>
    );
}
