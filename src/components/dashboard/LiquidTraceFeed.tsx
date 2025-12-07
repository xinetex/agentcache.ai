import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, ShieldAlert, Cpu, Timer, DollarSign, ArrowRight } from 'lucide-react';

export interface TraceItem {
    id: string;
    type: 'hit' | 'miss' | 'error';
    model: string;
    latency: number;
    timestamp: string;
    cost: number;
    savings: number;
}

interface LiquidTraceFeedProps {
    traces: TraceItem[];
}

export function LiquidTraceFeed({ traces }: LiquidTraceFeedProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl h-[500px] overflow-hidden flex flex-col w-full shadow-2xl">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="font-mono text-sm uppercase tracking-widest text-white/70 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Neural Feed
                </h3>
                <span className="text-xs text-white/30 font-mono">Real-time Ingestion</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative no-scrollbar">
                {/* Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_0%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />

                <AnimatePresence initial={false}>
                    {traces.map((trace) => (
                        <motion.div
                            key={trace.id}
                            initial={{ x: -20, opacity: 0, filter: 'blur(10px)' }}
                            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className={`
                group relative flex items-center gap-4 p-3 rounded-lg border 
                ${trace.type === 'hit' ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' : ''}
                ${trace.type === 'miss' ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10' : ''}
                ${trace.type === 'error' ? 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10' : ''}
                transition-colors duration-300
              `}
                        >
                            {/* Status Indicator */}
                            <div className={`
                    w-1 h-full absolute left-0 top-0 bottom-0 rounded-l-lg
                    ${trace.type === 'hit' ? 'bg-emerald-500' : ''}
                    ${trace.type === 'miss' ? 'bg-blue-500' : ''}
                    ${trace.type === 'error' ? 'bg-rose-500' : ''}
                    opacity-50 group-hover:opacity-100 transition-opacity
                `} />

                            {/* Icon */}
                            <div className="p-2 rounded-md bg-white/5">
                                {trace.type === 'hit' && <ZapIcon className="w-4 h-4 text-emerald-400" />}
                                {trace.type === 'miss' && <Cpu className="w-4 h-4 text-blue-400" />}
                                {trace.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                            </div>

                            {/* Content */}
                            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-4">
                                    <div className="text-sm font-medium text-white/90 font-mono truncate">{trace.model}</div>
                                    <div className="text-[10px] text-white/40 uppercase tracking-wide">{trace.id.slice(0, 8)}</div>
                                </div>

                                <div className="col-span-4 flex items-center gap-2">
                                    <Timer className="w-3 h-3 text-white/30" />
                                    <span className={`text-xs font-mono ${trace.latency < 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {trace.latency}ms
                                    </span>
                                </div>

                                <div className="col-span-4 flex justify-end items-center gap-1">
                                    {trace.type === 'hit' ? (
                                        <span className="text-xs font-bold text-emerald-400 flex items-center bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                            <DollarSign className="w-3 h-3" />
                                            SAVED
                                        </span>
                                    ) : (
                                        <span className="text-xs text-white/30">$ {trace.cost.toFixed(5)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Hover Glow */}
                            <div className="absolute inset-0 rounded-lg group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] pointer-events-none transition-shadow" />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {traces.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2">
                        <Box className="w-8 h-8 opacity-20" />
                        <span className="text-xs font-mono">Awaiting Neural Signals...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ZapIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
    )
}
