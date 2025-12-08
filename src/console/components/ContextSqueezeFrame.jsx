
import React, { useState, useEffect } from 'react';
import { Database, Zap, Activity, Hexagon, StopCircle, Play } from 'lucide-react';
import { NeuralGlassLayout } from '../../components/dashboard/NeuralGlassLayout';
import CyberCard from '../components/CyberCard';

export default function ContextSqueezeFrame({ onExit }) {
    const [gameState, setGameState] = useState('IDLE'); // IDLE, CHALLENGE, PROCESSING, RESULT
    const [challenge, setChallenge] = useState(null);
    const [result, setResult] = useState(null);
    const [difficulty, setDifficulty] = useState(1);
    const [progress, setProgress] = useState(0);

    const startChallenge = async () => {
        setGameState('LOADING');
        setResult(null);
        try {
            const res = await fetch('/api/game/context_squeeze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_challenge', difficulty })
            });
            const data = await res.json();
            setChallenge(data);
            setGameState('CHALLENGE');
        } catch (err) {
            console.error(err);
        }
    };

    const runCompression = async () => {
        setGameState('PROCESSING');
        setProgress(0);

        // Fake Progress Bar simulating "Reading" -> "Vectorizing" -> "Compressing"
        let p = 0;
        const interval = setInterval(() => {
            p += Math.random() * 5;
            if (p > 100) p = 100;
            setProgress(p);
        }, 100);

        // Actual API Call
        try {
            const res = await fetch('/api/game/context_squeeze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'submit_attempt',
                    challengeId: challenge.challengeId,
                    difficulty
                })
            });
            const data = await res.json();

            setTimeout(() => {
                clearInterval(interval);
                setResult(data.result);
                setGameState('RESULT');
            }, 2500); // Add fake delay for drama
        } catch (err) {
            clearInterval(interval);
            console.error(err);
        }
    };

    return (
        <NeuralGlassLayout className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Left: Challenge Packet (Holographic Folder) */}
            <div className="flex flex-col gap-6 relative">
                <div className="absolute -inset-4 bg-cyan-500/5 blur-xl pointer-events-none"></div>
                <CyberCard title="Incoming Data Field" icon={Database} className="z-10 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    {challenge ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left duration-500">
                            {/* Header HUD */}
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <div>
                                    <div className="text-[10px] font-black tracking-widest text-[var(--hud-text-dim)] mb-1">DATA_OBJECT_ID: {challenge.document.id}</div>
                                    <div className="text-xl font-bold text-white font-[Rajdhani]">{challenge.document.title}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-cyan-400 font-mono animate-pulse">LIVE FEED</div>
                                </div>
                            </div>

                            {/* Data Stats HUD */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/5 p-2 rounded border border-white/5">
                                    <div className="text-[8px] text-white/40">SIZE</div>
                                    <div className="font-mono text-cyan-300">{challenge.document.size}</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded border border-white/5">
                                    <div className="text-[8px] text-white/40">TARGET</div>
                                    <div className="font-mono text-purple-300">&lt;{(challenge.targetCompression * 100).toFixed(0)}%</div>
                                </div>
                                <div className="bg-white/5 p-2 rounded border border-white/5">
                                    <div className="text-[8px] text-white/40">TYPE</div>
                                    <div className="font-mono text-white/60">TXT/SEC</div>
                                </div>
                            </div>

                            {/* Matrix Rain / Content Preview */}
                            <div className="p-4 bg-black/60 rounded border border-cyan-500/30 font-mono text-[10px] text-green-500/80 leading-relaxed overflow-hidden h-64 relative font-medium">
                                <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/dummy/giphy.gif')] opacity-5 pointer-events-none"></div> {/* Placeholder for noise texture */}
                                {challenge.document.content}
                                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
                            </div>

                            {gameState === 'CHALLENGE' ? (
                                <button
                                    onClick={runCompression}
                                    className="w-full group relative overflow-hidden rounded bg-cyan-500/20 border border-cyan-500/50 p-4 transition-all hover:bg-cyan-500/30 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                                >
                                    <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                    <div className="relative flex items-center justify-center gap-3 font-bold text-lg font-[Rajdhani] text-cyan-100">
                                        <Zap className="group-hover:text-yellow-300 transition-colors" />
                                        INITIATE HYDRAULIC PRESS
                                    </div>
                                </button>
                            ) : (
                                <div className="text-center font-mono text-xs text-white/30 animate-pulse">
                                    {gameState === 'PROCESSING' ? 'PRESSURIZING...' : 'CYCLE COMPLETE'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-80 text-white/20 relative group cursor-pointer" onClick={startChallenge}>
                            <div className="absolute inset-0 bg-cyan-500/5 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full blur-3xl"></div>
                            <Database size={64} className="mb-4 group-hover:text-cyan-400 transition-colors duration-300" />
                            <div className="font-[Rajdhani] font-bold text-xl mb-2 group-hover:text-white transition-colors">AWAITING DATA PACKET</div>
                            <div className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors text-white text-xs font-mono">
                                [FETCH NEXT DOCUMENT]
                            </div>
                        </div>
                    )}
                </CyberCard>
            </div>

            {/* Right: The Hydraulic Press (Visual Engine) */}
            <div className="flex flex-col gap-6 relative">
                <CyberCard title="Compression Chamber" icon={Activity} className="h-full relative overflow-hidden bg-black/60 border-purple-500/20">

                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'linear-gradient(rgba(168, 85, 247, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    ></div>

                    {gameState === 'PROCESSING' && (
                        <div className="flex flex-col items-center justify-center h-full gap-8 relative z-10">
                            {/* The Press Visual */}
                            <div className="relative h-64 w-32 bg-black/40 border-x border-white/20 overflow-hidden flex flex-col justify-end">
                                {/* Top Plate (Moving Down) */}
                                <div className="absolute top-0 left-0 right-0 h-4 bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear animate-pulse"
                                    style={{ top: `${progress}%` }}
                                ></div>

                                {/* The "Goop" (Content) using a shrinking div */}
                                <div className="w-full bg-cyan-500/20 backdrop-blur-sm transition-all duration-300 border-t border-cyan-400/50"
                                    style={{ height: `${100 - progress}%` }}
                                >
                                    <div className="w-full h-full flex items-center justify-center opacity-50">
                                        <div className="w-16 h-full border-x border-cyan-500/20"></div>
                                    </div>
                                </div>

                                {/* Bottom Plate */}
                                <div className="h-4 w-full bg-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]"></div>
                            </div>

                            <div className="text-center">
                                <div className="text-4xl font-black font-mono text-purple-400 mb-1 tracking-tighter">
                                    {(progress * 1350).toFixed(0)} <span className="text-base text-white/40">PSI</span>
                                </div>
                                <div className="text-[10px] font-mono text-white/40 tracking-widest">
                                    COMPRESSION RATIO: {(100 / (100 - progress + 1)).toFixed(2)}x
                                </div>
                            </div>
                        </div>
                    )}

                    {gameState === 'RESULT' && result && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-20 animate-in zoom-in duration-300 p-8">
                            {/* Result Hex */}
                            <div className="relative mb-6">
                                <Hexagon size={120} className={`stroke-2 ${result.success ? 'text-emerald-500 fill-emerald-500/10' : 'text-red-500 fill-red-500/10'}`} />
                                <div className={`absolute inset-0 flex items-center justify-center text-3xl font-black ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {result.success ? 'PASS' : 'FAIL'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full mb-6">
                                <div className="bg-white/5 p-4 rounded text-center border border-white/10 backdrop-blur">
                                    <div className="text-[10px] text-white/40 mb-1">RECALL</div>
                                    <div className={`text-3xl font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'} font-mono`}>{result.recallScore}%</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded text-center border border-white/10 backdrop-blur">
                                    <div className="text-[10px] text-white/40 mb-1">COMPRESSION</div>
                                    <div className="text-3xl font-bold text-cyan-400 font-mono">{result.compressionRatio}</div>
                                </div>
                            </div>

                            <div className="bg-black/40 px-6 py-3 rounded-full border border-white/10 text-xs font-mono text-emerald-300 mb-8">
                                <span className="opacity-50">VALUE GENERATED:</span> {result.costSavings}
                            </div>

                            <button
                                onClick={startChallenge}
                                className="px-8 py-3 rounded bg-white hover:bg-emerald-400 hover:text-black text-black font-bold transition-all text-sm font-[Rajdhani] tracking-widest transform hover:scale-105"
                            >
                                NEXT BATCH
                            </button>
                        </div>
                    )}

                    {gameState === 'IDLE' && !result && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none">
                            <Activity size={120} className="text-white mb-4 animate-pulse" />
                            <div className="text-4xl font-black font-[Rajdhani] text-white tracking-widest uppercase">Idle</div>
                        </div>
                    )}
                </CyberCard>
            </div>

            <button onClick={onExit} className="absolute top-4 right-4 text-[10px] font-bold text-white/20 hover:text-white z-50 flex items-center gap-1 hover:bg-red-500/20 px-2 py-1 rounded transition-colors">
                <StopCircle size={10} /> ABORT SIMULATION
            </button>
        </NeuralGlassLayout>
    );
}
