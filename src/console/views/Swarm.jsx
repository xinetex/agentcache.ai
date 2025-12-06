import React, { useState, useEffect } from 'react';
import { Hexagon, Trophy, Radio, Zap } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import DataGrid from '../components/DataGrid';
import NeuralGalaxy from '../components/NeuralGalaxy';
import { useAuth } from '../auth/AuthContext';

export default function Swarm() {
    const { token } = useAuth();
    const [leaderboard, setLeaderboard] = useState([]);
    const [discoveries, setDiscoveries] = useState([]);
    const [session, setSession] = useState(null);

    useEffect(() => {
        if (!token) return;

        // Fetch Leaderboard (Top Users)
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/admin-stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data && data.top_users) {
                    const topAgents = data.top_users.map((u, i) => ({
                        rank: i + 1,
                        name: u.email.split('@')[0] || 'Unknown Agent',
                        score: u.requests,
                        sector: 'General'
                    }));
                    setLeaderboard(topAgents);
                } else {
                    // Fallback if no data
                    setLeaderboard([
                        { rank: 1, name: 'System-Prime', score: 1000, sector: 'Core' }
                    ]);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard:", err);
            }
        };

        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 60000); // Refresh every minute

        // Connect to Event Stream for "Discoveries"
        const eventSource = new EventSource('/api/events/stream');

        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
            if (event.type === 'sys:connected') return;

            // Simulate a "discovery" on cache hits or optimizations
            if (event.type === 'CACHE_HIT' || event.type === 'OPTIMIZATION' || Math.random() > 0.7) {
                const newDiscovery = {
                    id: Date.now(),
                    agent: event.agentId || 'Swarm-Node',
                    pattern: event.type === 'CACHE_HIT' ? 'Pattern Match' : 'Optimization Found',
                    improvement: Math.floor(Math.random() * 20) + 5, // Simulating efficiency gain
                    time: new Date().toLocaleTimeString()
                };
                setDiscoveries(prev => [newDiscovery, ...prev].slice(0, 8));
            }
        };

        // Mock Session Status
        setSession({
            status: 'Running Experiment #8492',
            progress: 45,
            target: 'Global Latency Optimization'
        });

        const progressInterval = setInterval(() => {
            setSession(prev => ({
                ...prev,
                progress: prev.progress >= 100 ? 0 : prev.progress + 1
            }));
        }, 1000);

        return () => {
            clearInterval(interval);
            clearInterval(progressInterval);
            eventSource.close();
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
                    <NeuralGalaxy />

                    {/* Active Session Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[rgba(0,0,0,0.8)] backdrop-blur p-4 border-t border-[var(--hud-border)] pointer-events-none">
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
