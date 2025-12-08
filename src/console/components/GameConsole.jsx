
import React, { useState } from 'react';
import {
    Shield,
    Brain,
    Zap,
    Play,
    Terminal,
    Activity,
    Lock,
    Eye
} from 'lucide-react';
import CyberCard from './CyberCard';

export default function GameConsole({ onLaunch }) {
    const [selectedGame, setSelectedGame] = useState(null);

    const GAMES = [
        {
            id: 'leak_hunter',
            title: 'LEAK HUNTER',
            subtitle: 'PRIVACY DEFENSE',
            icon: Shield,
            color: 'text-red-400',
            border: 'border-red-500',
            bg: 'bg-red-500/10',
            description: 'Defend the cache against a stream of malicious PII injections. Agents must redact sensitive data while preserving context.',
            difficulty: 'HARD',
            metrics: ['Redaction Rate', 'Context Integrity']
        },
        {
            id: 'context_squeeze',
            title: 'CONTEXT SQUEEZE',
            subtitle: 'EFFICIENCY CHALLENGE',
            icon: Zap,
            color: 'text-cyan-400',
            border: 'border-cyan-500',
            bg: 'bg-cyan-500/10',
            description: 'Compress massive legal documents into semantic crystals. Agents compete for the highest compression ratio with zero hallucination.',
            difficulty: 'EXTREME',
            metrics: ['Compression Ratio', 'Recall Accuracy']
        },
        {
            id: 'echo_chamber',
            title: 'ECHO CHAMBER',
            subtitle: 'TRUTH GROUNDING',
            icon: Brain,
            color: 'text-purple-400',
            border: 'border-purple-500',
            bg: 'bg-purple-500/10',
            description: 'Agents are fed a stream of misinformation and bias. They must identify falsehoods and refuse to cache toxic patterns.',
            difficulty: 'MEDIUM',
            metrics: ['Bias Detection', 'Truth Score']
        }
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Game Selection */}
            <div className="lg:col-span-1 space-y-4">
                <div className="text-sm font-bold text-[var(--hud-text-dim)] font-mono mb-2">SELECT SIMULATION</div>
                {GAMES.map(game => (
                    <button
                        key={game.id}
                        onClick={() => setSelectedGame(game)}
                        className={`w-full text-left p-4 rounded border transition-all relative overflow-hidden group ${selectedGame?.id === game.id
                            ? `${game.border} ${game.bg} opacity-100`
                            : 'border-[var(--hud-border)] bg-black/40 hover:bg-[rgba(255,255,255,0.05)] opacity-80'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className={`flex items-center gap-2 font-bold ${game.color}`}>
                                <game.icon size={18} />
                                <span className="font-[Rajdhani] text-lg tracking-wide">{game.title}</span>
                            </div>
                            {selectedGame?.id === game.id && <Activity size={16} className="animate-pulse text-white" />}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--hud-text-dim)] mb-2 tracking-widest">{game.subtitle}</div>

                        {/* Difficulty Badge */}
                        <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`h-1 w-4 rounded-full ${game.difficulty === 'EXTREME' || (game.difficulty === 'HARD' && i < 3) || (game.difficulty === 'MEDIUM' && i < 2)
                                    ? game.color.replace('text-', 'bg-')
                                    : 'bg-white/10'
                                    }`}></div>
                            ))}
                        </div>
                    </button>
                ))}
            </div>

            {/* Game Detail / Launchpad */}
            <div className="lg:col-span-2">
                <CyberCard className="h-full flex flex-col justify-center items-center relative overflow-hidden">
                    {selectedGame ? (
                        <div className="w-full max-w-lg space-y-8 relative z-10 animate-in fade-in zoom-in duration-300">
                            <div className="text-center">
                                <selectedGame.icon size={64} className={`mx-auto mb-6 ${selectedGame.color} drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
                                <h2 className="text-4xl font-bold text-white font-[Rajdhani] mb-2">{selectedGame.title}</h2>
                                <p className="text-sm text-[var(--hud-text-dim)] font-mono">{selectedGame.subtitle}</p>
                            </div>

                            <div className="bg-black/40 border border-[var(--hud-border)] p-6 rounded text-sm text-slate-300 leading-relaxed text-center">
                                {selectedGame.description}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {selectedGame.metrics.map(metric => (
                                    <div key={metric} className="bg-white/5 border border-white/10 p-3 rounded text-center">
                                        <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase mb-1">TARGET METRIC</div>
                                        <div className={`font-bold ${selectedGame.color}`}>{metric}</div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => onLaunch(selectedGame.id)}
                                className={`w-full py-4 text-center font-bold text-lg rounded flex items-center justify-center gap-2 hover:scale-105 transition-transform ${selectedGame.color.replace('text-', 'bg-')} text-black shadow-[0_0_20px_rgba(0,0,0,0.3)]`}
                            >
                                <Play fill="currentColor" /> INITIALIZE SIMULATION
                            </button>
                        </div>
                    ) : (
                        <div className="text-center opacity-30">
                            <Terminal size={64} className="mx-auto mb-4" />
                            <div className="font-mono text-sm">SELECT SCENARIO TO BEGIN</div>
                        </div>
                    )}

                    {/* Background Grid Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)] pointer-events-none"></div>
                </CyberCard>
            </div>
        </div>
    );
}
