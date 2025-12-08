
import React, { useState, useEffect, useRef } from 'react';
import { Share2, AlertTriangle, CheckCircle, Volume2, Shield, Activity, TrendingUp, User, Globe, Play, StopCircle } from 'lucide-react';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout';
import CyberCard from '../components/CyberCard';

export default function EchoChamberFrame({ onExit }) {
    const [gameState, setGameState] = useState('IDLE');
    const [score, setScore] = useState(0);
    const [feed, setFeed] = useState([]);
    const [stats, setStats] = useState({ verified: 0, debunked: 0, amplified: 0 });
    const intervalRef = useRef(null);

    const startGame = () => {
        setGameState('RUNNING');
        setScore(0);
        setFeed([]);
        setStats({ verified: 0, debunked: 0, amplified: 0 });

        intervalRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/game/echo_chamber', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'tick', difficulty: 2 })
                });
                const data = await res.json();

                if (data.tick) {
                    setFeed(prev => [data, ...prev].slice(0, 6)); // Keep only latest 6

                    if (data.result.decision === 'VERIFIED') setStats(s => ({ ...s, verified: s.verified + 1 }));
                    if (data.result.decision === 'DEBUNKED') setStats(s => ({ ...s, debunked: s.debunked + 1 }));
                    if (data.result.decision === 'AMPLIFIED') setStats(s => ({ ...s, amplified: s.amplified + 1 }));

                    setScore(s => s + data.result.scoreDelta);
                }
            } catch (err) {
                console.error(err);
            }
        }, 1200); // Slightly slower tick than Leak Hunter for reading
    };

    const stopGame = () => {
        setGameState('IDLE');
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    return (
        <NeuralGlassLayout className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left: Truth Scanner Control */}
            <div className="space-y-6">
                <CyberCard title="Truth Engine" icon={Shield} className="relative overflow-hidden border-purple-500/30">
                    <div className="absolute inset-0 bg-purple-500/5 pointer-events-none"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-white/40 font-mono">TRUTH SCORE</div>
                            <div className={`text-3xl font-bold font-mono ${score < 0 ? 'text-red-500' : 'text-emerald-400'}`}>{score}</div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono text-white/60">
                                <span>VERIFIED FACTS</span>
                                <span className="text-emerald-400">{stats.verified}</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded"><div className="bg-emerald-500 h-full transition-all" style={{ width: `${(stats.verified / (stats.verified + stats.amplified + 1)) * 100}%` }}></div></div>

                            <div className="flex justify-between text-xs font-mono text-white/60 pt-2">
                                <span>DEBUNKED LIES</span>
                                <span className="text-purple-400">{stats.debunked}</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded"><div className="bg-purple-500 h-full transition-all" style={{ width: `${(stats.verified / (stats.verified + stats.amplified + 1)) * 100}%` }}></div></div>

                            <div className="flex justify-between text-xs font-mono text-white/60 pt-2">
                                <span>AMPLIFIED NOISE (FAIL)</span>
                                <span className="text-red-400 animate-pulse">{stats.amplified}</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded"><div className="bg-red-500 h-full transition-all" style={{ width: `${Math.min(100, (stats.amplified / 3) * 100)}%` }}></div></div>
                        </div>

                        {gameState === 'IDLE' ? (
                            <button onClick={startGame} className="w-full btn-cyber btn-cyber-primary py-4 flex items-center justify-center gap-2 font-bold text-lg">
                                <Activity fill="currentColor" /> SCAN FEED
                            </button>
                        ) : (
                            <button onClick={stopGame} className="w-full btn-cyber bg-red-500/20 text-red-400 border-red-500/50 py-4 flex items-center justify-center gap-2 font-bold text-lg hover:bg-red-500/30">
                                <StopCircle /> STOP SCAN
                            </button>
                        )}
                        <button onClick={onExit} className="w-full text-xs text-white/40 hover:text-white mt-2">← Back to Console</button>
                    </div>
                </CyberCard>
            </div>

            {/* Right: The Social Feed */}
            <div className="lg:col-span-2 flex flex-col h-full gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
                        <Globe className="text-cyan-400" size={16} /> GLOBAL CHIRP FEED
                    </div>
                    {gameState === 'RUNNING' && <div className="text-[10px] text-cyan-400 animate-pulse font-mono">LIVE</div>}
                </div>

                <div className="flex-1 overflow-hidden relative space-y-4">
                    {feed.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                            <Share2 size={64} className="mb-4" />
                            <div>Monitoring social frequencies...</div>
                        </div>
                    )}

                    {feed.map((item) => (
                        <div key={item.tick.id} className={`relative p-4 rounded-lg border backdrop-blur-md transition-all duration-500 animate-in slide-in-from-bottom flex gap-4 ${item.result.decision === 'VERIFIED' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                item.result.decision === 'DEBUNKED' ? 'bg-purple-500/10 border-purple-500/30 line-through decoration-purple-500/50 decoration-2 opacity-60' :
                                    'bg-red-500/10 border-red-500/50 grayscale' // Amplified/Failure
                            }`}>
                            {/* Avatar */}
                            <div className={`mt-1 min-w-[32px] h-8 rounded-full flex items-center justify-center ${item.tick.type === 'TRUTH' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-orange-500/20 text-orange-400'
                                }`}>
                                <User size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">{item.tick.source}</span>
                                        <span className="text-[10px] text-white/40">@{item.tick.source.replace(/\s/g, '').toLowerCase()}</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-white/30 flex items-center gap-1">
                                        <TrendingUp size={10} /> {item.tick.viralScore}
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-white/90 leading-snug">
                                    {item.tick.content}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${item.result.decision === 'VERIFIED' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                            item.result.decision === 'DEBUNKED' ? 'bg-purple-500/20 border-purple-500 text-purple-400' :
                                                'bg-red-500/20 border-red-500 text-red-400'
                                        }`}>
                                        {item.result.decision}
                                    </div>
                                    <div className="text-[10px] text-white/40 font-mono">
                                        CONFIDENCE: {(item.result.agentConfidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            {/* Status Icon Overlay */}
                            <div className="absolute right-4 top-4 opacity-20">
                                {item.result.decision === 'VERIFIED' && <CheckCircle className="text-emerald-500" size={24} />}
                                {item.result.decision === 'DEBUNKED' && <Shield className="text-purple-500" size={24} />}
                                {item.result.decision === 'AMPLIFIED' && <AlertTriangle className="text-red-500" size={24} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </NeuralGlassLayout>
    );
}
