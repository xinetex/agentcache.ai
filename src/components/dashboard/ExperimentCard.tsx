
import React, { useState, useEffect } from 'react';
import { Beaker, TrendingUp, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import CyberCard from '../../console/components/CyberCard';
import { motion } from 'framer-motion';

export default function ExperimentCard() {
    const [experiments, setExperiments] = useState([]);

    useEffect(() => {
        fetch('/api/observability/experiments')
            .then(res => res.json())
            .then(data => setExperiments(data))
            .catch(err => console.error(err));
    }, []);

    return (
        <CyberCard title="Active Experiments" icon={Beaker} className="h-full overflow-hidden">
            <div className="flex flex-col gap-4">
                {experiments.map((exp) => (
                    <div key={exp.id} className="bg-white/5 p-4 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="text-white font-bold text-sm tracking-wide">{exp.name.toUpperCase()}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1 font-mono">
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">RUNNING</span>
                                    <span>CONFIDENCE: {exp.confidence.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1 font-bold ${exp.delta.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {exp.delta.startsWith('+') ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {exp.delta}
                            </div>
                        </div>

                        {/* Bars */}
                        <div className="space-y-3">
                            {/* Treatment */}
                            <div>
                                <div className="flex justify-between text-[10px] text-white/60 mb-1 font-mono">
                                    <span className="text-cyan-400 font-bold">TREATMENT (B)</span>
                                    <span>{exp.treatment.score}% ({exp.treatment.latency}ms)</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${exp.treatment.score}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                                    />
                                </div>
                            </div>

                            {/* Control */}
                            <div>
                                <div className="flex justify-between text-[10px] text-white/60 mb-1 font-mono">
                                    <span>CONTROL (A)</span>
                                    <span>{exp.control.score}% ({exp.control.latency}ms)</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${exp.control.score}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-white/30"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </CyberCard>
    );
}
