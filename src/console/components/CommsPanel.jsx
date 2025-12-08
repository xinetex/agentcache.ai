
import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare,
    Radio,
    ShieldAlert,
    Unlock,
    Lock,
    Send,
    Bot,
    User,
    Zap
} from 'lucide-react';
import CyberCard from './CyberCard';

/**
 * Agent Comms Panel
 * Visualizes the "Chatter" between agents (Negotiation, Resource Locking, Sync)
 * Allows Human "God Mode" intervention.
 */
export default function CommsPanel({ className }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);

    // Initial seed messages
    useEffect(() => {
        const initial = [
            { id: 1, from: 'Optimizer-V9', to: 'Swarm-Main', type: 'AGENT', content: 'Identifying latency spike in Sector 7. Requesting diagnostic lock.', time: '14:20:01' },
            { id: 2, from: 'Swarm-Main', to: 'Optimizer-V9', type: 'SYSTEM', content: 'ACK. Lock granted for 500ms.', time: '14:20:01' },
            { id: 3, from: 'Security-Sentinel', to: 'BROADCAST', type: 'WARN', content: 'Anomaly detected in inbound query stream.', time: '14:20:03' },
        ];
        setMessages(initial);
    }, []);

    // Simulated Chatter Loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.4) return; // Not too spammy

            const agents = ['Optimizer-V9', 'Security-Sentinel', 'Cache-L2', 'Predictor-X', 'Broker-DAO'];
            const targets = ['Swarm-Main', 'BROADCAST', 'Storage-Node', 'User-Session-A'];
            const actions = [
                { type: 'TEXT', content: 'Syncing context vector...' },
                { type: 'TEXT', content: 'Requesting token budget increase.' },
                { type: 'GRAPHIC', content: 'Visualizing proposed latency path:', graphicType: 'CHART' },
                { type: 'TEXT', content: 'Vetoing unsafe pattern injection.' },
                { type: 'GRAPHIC', content: 'Node cluster topology update:', graphicType: 'NETWORK' },
                { type: 'TEXT', content: 'Optimizing route for query #9921.' }
            ];

            const from = agents[Math.floor(Math.random() * agents.length)];
            const to = targets[Math.floor(Math.random() * targets.length)];
            const action = actions[Math.floor(Math.random() * actions.length)];

            const msg = {
                id: Date.now(),
                from,
                to,
                type: from.includes('Security') ? 'WARN' : 'AGENT',
                graphic: action.type === 'GRAPHIC' ? action.graphicType : null,
                content: action.content,
                time: new Date().toLocaleTimeString('en-US', { hour12: false })
            };

            setMessages(prev => [...prev.slice(-19), msg]); // Keep last 20
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;

        const msg = {
            id: Date.now(),
            from: 'HUMAN_ADMIN',
            to: 'BROADCAST',
            type: 'HUMAN',
            content: input.toUpperCase(), // Admin commands usually imperative
            time: new Date().toLocaleTimeString('en-US', { hour12: false })
        };

        setMessages(prev => [...prev, msg]);
        setInput('');

        // Simulate Agent Response
        setTimeout(() => {
            const response = {
                id: Date.now() + 1,
                from: 'Swarm-Main',
                to: 'HUMAN_ADMIN',
                type: 'SYSTEM',
                content: 'Command received. Propagating override.',
                time: new Date().toLocaleTimeString('en-US', { hour12: false })
            };
            setMessages(prev => [...prev, response]);
        }, 800);
    };

    return (
        <CyberCard
            title="Inter-Agent Comms Channel"
            icon={Radio}
            className={`flex flex-col h-full ${className}`}
        >
            {/* Message Feed */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[300px]"
            >
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col text-xs font-mono p-2 rounded border-l-2 ${msg.type === 'HUMAN' ? 'bg-purple-500/10 border-purple-500 ml-8' :
                        msg.type === 'WARN' ? 'bg-red-500/10 border-red-500' :
                            msg.type === 'SYSTEM' ? 'bg-white/5 border-white/20' :
                                'bg-cyan-500/5 border-cyan-500/50'
                        }`}>
                        <div className="flex justify-between items-center mb-1 opacity-70">
                            <div className="flex items-center gap-1">
                                {msg.type === 'HUMAN' ? <User size={10} /> : <Bot size={10} />}
                                <span className="font-bold">{msg.from}</span>
                                <span className="text-[10px]">→</span>
                                <span>{msg.to}</span>
                            </div>
                            <span className="text-[10px]">{msg.time}</span>
                        </div>
                        <div className={`text-sm ${msg.type === 'HUMAN' ? 'font-bold text-purple-200' :
                                msg.type === 'WARN' ? 'text-red-300' : 'text-slate-300'
                            }`}>
                            {msg.content}

                            {/* Inline Graphic Renderer */}
                            {msg.graphic === 'CHART' && (
                                <div className="mt-2 p-2 bg-black/40 border border-white/10 rounded h-16 flex items-end gap-1 w-fit">
                                    {[40, 65, 33, 80, 50, 90, 45].map((h, i) => (
                                        <div key={i} className="w-2 bg-[var(--hud-accent)] opacity-80" style={{ height: `${h}%` }}></div>
                                    ))}
                                </div>
                            )}
                            {msg.graphic === 'NETWORK' && (
                                <div className="mt-2 p-2 bg-black/40 border border-white/10 rounded h-16 w-32 relative overflow-hidden">
                                    <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                    <div className="absolute bottom-4 right-8 w-2 h-2 rounded-full bg-cyan-500"></div>
                                    <div className="absolute top-6 right-4 w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                                        <line x1="10" y1="10" x2="80" y2="40" stroke="white" strokeWidth="1" />
                                        <line x1="80" y1="40" x2="100" y2="20" stroke="white" strokeWidth="1" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="mt-4 flex gap-2">
                <div className="relative flex-1">
                    <input
                        className="w-full bg-black/40 border border-white/10 rounded p-3 pl-4 pr-10 text-sm font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
                        placeholder="Broadcast command (e.g., 'HALT', 'PRIORITY 1')..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-500 pointer-events-none">
                        ADMIN
                    </div>
                </div>
                <button
                    onClick={handleSend}
                    className="p-3 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-500/30 transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </CyberCard>
    );
}
