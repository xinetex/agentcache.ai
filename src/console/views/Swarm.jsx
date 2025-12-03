import React, { useState, useEffect } from 'react';
import { Hexagon, Trophy, Radio, Zap } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import DataGrid from '../components/DataGrid';

export default function Swarm() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [discoveries, setDiscoveries] = useState([]);
    const [session, setSession] = useState(null);

    // Mock Data Simulation
    useEffect(() => {
        setLeaderboard([
            { rank: 1, name: 'Alpha-Zero-Cache', score: 9850, sector: 'Finance' },
            { rank: 2, name: 'Medi-Bot-V9', score: 8720, sector: 'Healthcare' },
            { rank: 3, name: 'Deep-Seeker', score: 8100, sector: 'Research' },
            { rank: 4, name: 'Nexus-Prime', score: 7950, sector: 'General' },
            { rank: 5, name: 'Cyber-Core', score: 7200, sector: 'Infrastructure' },
        ]);

        const discoveryInterval = setInterval(() => {
            const newDiscovery = {
                id: Date.now(),
                agent: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'][Math.floor(Math.random() * 5)],
                pattern: ['L1-L3-Hybrid', 'Vector-Collapse', 'Semantic-Bridge', 'Temporal-Shift'][Math.floor(Math.random() * 4)],
                improvement: Math.floor(Math.random() * 20) + 5,
                time: new Date().toLocaleTimeString()
            };
            setDiscoveries(prev => [newDiscovery, ...prev].slice(0, 8));
        }, 3000);

        setSession({
            status: 'Running Experiment #8492',
            progress: 45,
            target: 'Optimize Latency (Healthcare)'
        });

        const progressInterval = setInterval(() => {
            setSession(prev => ({
                ...prev,
                progress: Math.min(100, prev.progress + 1)
            }));
        }, 1000);

        return () => {
            clearInterval(discoveryInterval);
            clearInterval(progressInterval);
        };
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">

            {/* Left Column: Discovery Feed */}
            <div className="space-y-6">
                <CyberCard title="Live Discoveries" icon={Radio} className="h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {discoveries.map(d => (
                            <div key={d.id} className="p-3 rounded bg-[rgba(255,255,255,0.03)] border-l-2 border-[var(--hud-accent)] animate-in slide-in-from-left duration-300">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-sm font-bold text-white">{d.agent}</span>
                                    <span className="text-[10px] font-mono text-[var(--hud-text-dim)]">{d.time}</span>
                                </div>
                                <div className="text-xs text-[var(--hud-text-dim)] mb-2">Found: <span className="text-white">{d.pattern}</span></div>
                                <div className="flex items-center gap-1 text-xs font-mono text-[var(--hud-success)]">
                                    <Zap size={12} />
                                    <span>+{d.improvement}% Efficiency</span>
                                </div>
                            </div>
                        ))}
                        {discoveries.length === 0 && (
                            <div className="text-center text-[var(--hud-text-dim)] py-8 italic">Listening for swarm signals...</div>
                        )}
                    </div>
                </CyberCard>
            </div>

            {/* Center: Visualization Area */}
            <div className="lg:col-span-1 flex flex-col gap-6 relative">
                <CyberCard className="flex-1 relative overflow-hidden p-0 border-[var(--hud-accent)] shadow-[0_0_30px_rgba(0,243,255,0.1)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,243,255,0.1)_0%,_transparent_70%)] animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center z-10">
                            <Hexagon size={64} className="mx-auto text-[var(--hud-accent)] animate-spin-slow mb-4" />
                            <h3 className="text-xl font-['Rajdhani'] font-bold text-white tracking-widest">NEURAL GALAXY</h3>
                            <p className="text-xs font-mono text-[var(--hud-text-dim)] mt-2">VISUALIZATION ENGINE ONLINE</p>
                        </div>
                    </div>

                    {/* Active Session Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[rgba(0,0,0,0.8)] backdrop-blur p-4 border-t border-[var(--hud-border)]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-[var(--hud-text-dim)]">ACTIVE EXPERIMENT</span>
                            <span className="text-xs font-mono text-[var(--hud-accent)] animate-pulse">RUNNING</span>
                        </div>
                        <div className="text-sm font-medium text-white mb-3">{session?.target}</div>
                        <div className="h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--hud-accent)] transition-all duration-300"
                                style={{ width: `${session?.progress}%` }}
                            ></div>
                        </div>
                    </div>
                </CyberCard>
            </div>

            {/* Right Column: Leaderboard */}
            <div className="space-y-6">
                <CyberCard title="Top Agents" icon={Trophy} className="h-full">
                    <DataGrid
                        columns={[
                            { header: 'Rank', accessor: 'rank', render: (row) => <span className="font-mono text-[var(--hud-accent)]">#{row.rank}</span> },
                            { header: 'Agent Name', accessor: 'name', render: (row) => <span className="font-bold text-white">{row.name}</span> },
                            { header: 'Score', accessor: 'score', render: (row) => <span className="font-mono text-[var(--hud-warning)]">{row.score}</span> },
                        ]}
                        data={leaderboard}
                    />
                </CyberCard>
            </div>
        </div>
    );
}
