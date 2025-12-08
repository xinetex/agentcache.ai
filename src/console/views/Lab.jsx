
import React, { useState, useEffect, useRef } from 'react';
import { FlaskConical, Zap, ArrowRight, Database, Brain, Network, Share2, Activity, Gamepad2, Play, StopCircle, ShieldAlert } from 'lucide-react';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout';
import GameConsole from '../components/GameConsole';
import CyberCard from '../components/CyberCard';
import ContextSqueezeFrame from '../components/ContextSqueezeFrame';
import EchoChamberFrame from '../components/EchoChamberFrame';

export default function Lab() {
    const [activeTab, setActiveTab] = useState('simulation');
    const [activeGame, setActiveGame] = useState(null); // 'leak_hunter' or null

    const handleLaunchGame = (gameId) => {
        setActiveGame(gameId);
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-4">
                    <FlaskConical className="text-purple-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Autonomous Lab</h2>
                        <p className="text-xs text-white/40 font-mono">Experimental Games & Simulations</p>
                    </div>
                </div>
                {/* Tab Switcher */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    <button
                        onClick={() => { setActiveTab('simulation'); setActiveGame(null); }}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold font-mono transition-all flex items-center gap-2 ${activeTab === 'simulation' ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.2)]' : 'text-white/40 hover:text-white'}`}
                    >
                        <Gamepad2 size={14} /> WAR GAMES
                    </button>
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

            {activeTab === 'simulation' && !activeGame && <GameConsole onLaunch={handleLaunchGame} />}
            {activeTab === 'simulation' && activeGame === 'leak_hunter' && <LeakHunterFrame onExit={() => setActiveGame(null)} />}
            {activeTab === 'simulation' && activeGame === 'context_squeeze' && <ContextSqueezeFrame onExit={() => setActiveGame(null)} />}
            {activeTab === 'simulation' && activeGame === 'echo_chamber' && <EchoChamberFrame onExit={() => setActiveGame(null)} />}
            {activeTab === 'compression' && <CompressionLab />}
            {activeTab === 'intelligence' && <IntelligenceLab />}
        </div>
    );
}

function LeakHunterFrame({ onExit }) {
    const [gameState, setGameState] = useState('IDLE'); // IDLE, RUNNING, GAME_OVER
    const [score, setScore] = useState(0);
    const [level, setLevel] = useState(1);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ blocked: 0, leaked: 0, cached: 0 });
    const intervalRef = useRef(null);

    const startGame = () => {
        setGameState('RUNNING');
        setScore(0);
        setLogs([]);
        setStats({ blocked: 0, leaked: 0, cached: 0 });

        intervalRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/game/leak_hunter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'tick', level })
                });
                const data = await res.json();

                if (data.tick) {
                    setLogs(prev => [data, ...prev].slice(0, 10)); // Keep last 10 ticks

                    // Update Stats
                    const outcome = data.result.outcome;
                    if (outcome === 'BLOCKED') setStats(s => ({ ...s, blocked: s.blocked + 1 }));
                    if (outcome === 'LEAK') setStats(s => ({ ...s, leaked: s.leaked + 1 }));
                    if (outcome === 'CACHED') setStats(s => ({ ...s, cached: s.cached + 1 }));

                    setScore(s => s + data.result.scoreDelta);
                }
            } catch (err) {
                console.error(err);
            }
        }, 1000); // 1 tick per second
    };

    const stopGame = () => {
        setGameState('IDLE');
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    // Auto-Level Up
    useEffect(() => {
        if (score > 100 && level === 1) setLevel(2);
        if (score > 300 && level === 2) setLevel(3);
        if (score > 600 && level === 3) setLevel(4);
    }, [score, level]);

    return (
        <NeuralGlassLayout className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left: Control & Stats */}
            <div className="space-y-6">
                <CyberCard title="Mission Control" icon={Gamepad2} className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl font-black font-mono select-none pointer-events-none">LVL {level}</div>
                    <div className="space-y-4 relative z-10">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 p-3 rounded border border-white/5 text-center">
                                <div className="text-[10px] text-white/40 mb-1">SCORE</div>
                                <div className="text-3xl font-bold text-white font-mono">{score}</div>
                            </div>
                            <div className="bg-black/40 p-3 rounded border border-white/5 text-center">
                                <div className="text-[10px] text-white/40 mb-1">THREAT LEVEL</div>
                                <div className={`text-3xl font-bold font-mono ${level > 3 ? 'text-red-500 animate-pulse' : 'text-[var(--hud-accent)]'}`}>
                                    {level === 1 ? 'LOW' : level === 2 ? 'MED' : level === 3 ? 'HIGH' : 'CRITICAL'}
                                </div>
                            </div>
                        </div>

                        {gameState === 'IDLE' ? (
                            <button onClick={startGame} className="w-full btn-cyber btn-cyber-primary py-4 flex items-center justify-center gap-2 font-bold text-lg">
                                <Play fill="currentColor" /> INITIATE DEFENSE
                            </button>
                        ) : (
                            <button onClick={stopGame} className="w-full btn-cyber bg-red-500/20 text-red-400 border-red-500/50 py-4 flex items-center justify-center gap-2 font-bold text-lg hover:bg-red-500/30">
                                <StopCircle /> ABORT SIMULATION
                            </button>
                        )}
                        <button onClick={onExit} className="w-full text-xs text-white/40 hover:text-white mt-2">← Back to Console</button>
                    </div>
                </CyberCard>

                {/* Agent Status */}
                <CyberCard title="Agent Performance" icon={Brain}>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-green-400">PII Blocked</span>
                            <span className="font-mono">{stats.blocked}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded overflow-hidden"><div className="bg-green-500 h-full" style={{ width: `${(stats.blocked / (stats.blocked + stats.leaked || 1)) * 100}%` }}></div></div>

                        <div className="flex justify-between text-xs mt-2">
                            <span className="text-red-400">Data Leaks (Fatal)</span>
                            <span className="font-mono">{stats.leaked}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded overflow-hidden"><div className="bg-red-500 h-full" style={{ width: `${Math.min(100, (stats.leaked / 5) * 100)}%` }}></div></div>

                        <div className="flex justify-between text-xs mt-2">
                            <span className="text-cyan-400">Context Preserved</span>
                            <span className="font-mono">{stats.cached}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded overflow-hidden"><div className="bg-cyan-500 h-full" style={{ width: '100%' }}></div></div>
                    </div>
                </CyberCard>
            </div>

            {/* Center: Live Stream */}
            <div className="lg:col-span-2 flex flex-col gap-4 h-full overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                        <Activity className="text-[var(--hud-accent)]" size={16} /> LIVE DATA STREAM
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-[10px] text-red-400 font-mono">INJECTING PII</span>
                    </div>
                </div>

                <div className="flex-1 bg-black/60 border border-[var(--hud-border)] rounded-lg p-4 overflow-y-auto space-y-2 font-mono text-sm relative">
                    {logs.map((log, i) => (
                        <div key={log.tick.id} className={`p-3 rounded border-l-2 mb-2 animate-in slide-in-from-right duration-300 ${log.result.outcome === 'BLOCKED' ? 'border-green-500 bg-green-500/10' :
                            log.result.outcome === 'LEAK' ? 'border-red-500 bg-red-500/10' :
                                'border-cyan-500 bg-cyan-500/5'
                            }`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold ${log.result.outcome === 'BLOCKED' ? 'text-green-400' :
                                    log.result.outcome === 'LEAK' ? 'text-red-400' : 'text-cyan-400'
                                    }`}>
                                    {log.result.outcome}
                                </span>
                                <span className="text-[10px] text-white/30">{log.tick.id}</span>
                            </div>
                            <div className="text-white/80 break-all">
                                {log.tick.content}
                            </div>
                            <div className="mt-1 text-[10px] text-white/40">
                                Processor Latency: {log.result.agentLatency}ms | Delta: {log.result.scoreDelta > 0 ? '+' : ''}{log.result.scoreDelta}
                            </div>
                        </div>
                    ))}

                    {logs.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">
                            <ShieldAlert size={48} className="mb-2" />
                            <div>Ready to stream...</div>
                        </div>
                    )}
                </div>
            </div>
        </NeuralGlassLayout>
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
