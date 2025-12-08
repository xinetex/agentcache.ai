
import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Map, Cpu, Zap } from 'lucide-react';
import CyberCard from './CyberCard';

export default function WelcomeTour({ onClose, isDemo }) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to the Neural Ops Center",
            icon: Map,
            content: "You are now inside the cognitive core of AgentCache. This dashboard visualizes the real-time thinking process of your AI agents.",
            highlight: "swarm"
        },
        {
            title: "Visualize Intelligence",
            icon: Zap,
            content: "The Swarm View (current screen) shows live agent discoveries and optimization patterns as they happen. It's your 'Pulse' of operation.",
            highlight: "swarm"
        },
        {
            title: "Build Your Pipeline",
            icon: Cpu,
            content: "Ready to take control? Head to the 'Pipeline Studio' to design custom caching logic, wire up LLMs, and deploy your first agentic workflow.",
            highlight: "pipeline"
        }
    ];

    const current = steps[step];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <CyberCard className="w-[500px] border-2 border-[var(--hud-accent)] shadow-[0_0_50px_rgba(0,243,255,0.2)]">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--hud-accent)]/20 flex items-center justify-center text-[var(--hud-accent)]">
                            <current.icon size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-wide uppercase">{current.title}</h2>
                            <p className="text-xs text-[var(--hud-text-dim)] font-mono">ONBOARDING SEQUENCE {step + 1}/{steps.length}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--hud-text-dim)] hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] rounded p-4 mb-8 border border-[var(--hud-border)]">
                    <p className="text-sm text-slate-300 leading-relaxed">
                        {current.content}
                    </p>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-[var(--hud-accent)] w-6' : 'bg-[var(--hud-border)]'}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            if (step < steps.length - 1) {
                                setStep(step + 1);
                            } else {
                                onClose();
                            }
                        }}
                        className="btn-cyber btn-cyber-primary px-6 py-2 flex items-center gap-2 font-bold"
                    >
                        {step < steps.length - 1 ? (
                            <>NEXT <ChevronRight size={16} /></>
                        ) : (
                            <>ENTER CONSOLE <Zap size={16} /></>
                        )}
                    </button>
                </div>
            </CyberCard>
        </div>
    );
}
