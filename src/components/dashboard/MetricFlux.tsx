import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Shield, Zap, DollarSign } from 'lucide-react';

interface MetricFluxProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: 'activity' | 'shield' | 'zap' | 'dollar';
    color: 'cyan' | 'rose' | 'amber' | 'emerald';
}

const icons = {
    activity: Activity,
    shield: Shield,
    zap: Zap,
    dollar: DollarSign,
};

const colors = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/5',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
};

const glows = {
    cyan: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
    rose: 'shadow-[0_0_15px_rgba(251,113,133,0.2)]',
    amber: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]',
    emerald: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]',
};

export function MetricFlux({ label, value, subValue, icon, color }: MetricFluxProps) {
    const Icon = icons[icon];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className={`relative overflow-hidden rounded-xl border ${colors[color]} ${glows[color]} backdrop-blur-md p-4 flex flex-col justify-between h-32`}
        >
            {/* Liquid Background Effect */}
            <motion.div
                className="absolute -inset-10 opacity-20 blur-2xl"
                animate={{
                    rotate: [0, 360],
                    scale: [0.8, 1.1, 0.8],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear"
                }}
                style={{
                    background: `conic-gradient(from 0deg, transparent, currentColor, transparent)`
                }}
            />

            <div className="relative z-10 flex justify-between items-start">
                <span className="text-sm font-medium tracking-wider uppercase opacity-70">{label}</span>
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Icon size={18} />
                </motion.div>
            </div>

            <div className="relative z-10 mt-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={String(value)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-3xl font-bold font-mono tracking-tight"
                    >
                        {value}
                    </motion.div>
                </AnimatePresence>
                {subValue && (
                    <div className="text-xs mt-1 font-mono opacity-60">{subValue}</div>
                )}
            </div>
        </motion.div>
    );
}
