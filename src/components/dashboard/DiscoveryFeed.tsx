
import React, { useState, useEffect } from 'react';
import { Lightbulb, Database, Globe, Cpu, Network } from 'lucide-react';
import CyberCard from '../../console/components/CyberCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function DiscoveryFeed() {
    const [discoveries, setDiscoveries] = useState([]);

    const fetchDiscoveries = async () => {
        try {
            const res = await fetch('/api/observability/discoveries');
            const data = await res.json();
            // dedupe logic effectively handled by just replacing for this simple view, 
            // or merging if we want a long history. For "Live Feed", replacing with latest is okay for demo.
            if (Array.isArray(data)) setDiscoveries(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchDiscoveries();
        const interval = setInterval(fetchDiscoveries, 8000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'tool': return <Cpu size={14} className="text-purple-400" />;
            case 'domain': return <Globe size={14} className="text-blue-400" />;
            case 'pattern': return <Lightbulb size={14} className="text-amber-400" />;
            case 'cache': return <Database size={14} className="text-emerald-400" />;
            default: return <Network size={14} className="text-white/50" />;
        }
    };

    return (
        <CyberCard title="Live Swarm Discoveries" icon={Lightbulb} className="h-full overflow-hidden">
            <div className="flex flex-col gap-2 relative h-full">
                <AnimatePresence mode="popLayout">
                    {discoveries.map((item) => (
                        <motion.a
                            key={item.id}
                            href={item.value.startsWith('http') ? item.value : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer group"
                        >
                            <div className="p-2 bg-black/40 rounded-md border border-white/5 text-indigo-400 group-hover:text-white transition-colors">
                                {getIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-bold truncate group-hover:text-cyan-400 transition-colors">{item.label}</div>
                                <div className="text-[10px] text-white/40 font-mono truncate">
                                    via <span className="text-white/70">{item.agent}</span>
                                </div>
                            </div>
                            <div className="text-[9px] text-white/20 font-mono">
                                LIVE
                            </div>
                        </motion.a>
                    ))}
                </AnimatePresence>

                {discoveries.length === 0 && (
                    <div className="text-center text-white/20 text-xs py-10 font-mono">
                        LISTENING FOR NOVELTY...
                    </div>
                )}
            </div>
        </CyberCard>
    );
}
