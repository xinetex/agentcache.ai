/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * VacuumRadar: 3D-inspired visualization of market gaps.
 */

import React from 'react';
import { Target } from 'lucide-react';

interface VacuumRadarProps {
    vacuums: {
        id: string;
        sector: string;
        revenue_potential: number;
        demand_signal: number;
        service_intensity: number;
    }[];
}

export function VacuumRadar({ vacuums }: VacuumRadarProps) {
    if (!vacuums || vacuums.length === 0) return null;

    return (
        <div className="relative h-64 w-full bg-black/20 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
            {/* Radar Background Rings */}
            <div className="absolute w-48 h-48 border border-white/5 rounded-full animate-ping" style={{ animationDuration: '4s' }} />
            <div className="absolute w-32 h-32 border border-white/10 rounded-full" />
            <div className="absolute w-16 h-16 border border-white/20 rounded-full" />
            
            {/* Axis lines */}
            <div className="absolute w-full h-[1px] bg-white/5" />
            <div className="absolute h-full w-[1px] bg-white/5" />

            {/* Scanning Beam */}
            <div className="absolute w-1/2 h-1/2 bg-gradient-to-tr from-red-500/20 to-transparent origin-bottom-left rotate-45 animate-spin" style={{ animationDuration: '6s', left: '50%', bottom: '50%' }} />

            {/* Vacuum Points */}
            {vacuums.map((v, i) => {
                // Stochastic spread for visualization
                const angle = (i * 137.5) % 360;
                const distance = 40 + (v.demand_signal * 40);
                
                return (
                    <div 
                        key={v.id}
                        className="absolute group"
                        style={{
                            transform: `rotate(${angle}deg) translateY(-${distance}px)`,
                            transition: 'all 1s ease-out'
                        }}
                    >
                        <div className="relative">
                            <Target className={`w-4 h-4 ${v.service_intensity < 0.3 ? 'text-red-500' : 'text-amber-500'} animate-pulse`} />
                            
                            {/* Hover Tooltip */}
                            <div className="absolute left-6 top-0 hidden group-hover:block bg-black/80 backdrop-blur-md border border-white/10 p-2 rounded text-[8px] whitespace-nowrap z-50">
                                <div className="font-bold text-white uppercase">{v.sector}</div>
                                <div className="text-white/60">${v.revenue_potential.toLocaleString()} Potential</div>
                            </div>
                        </div>
                    </div>
                );
            })}

            <div className="absolute bottom-2 right-2 text-[8px] font-mono text-white/20 uppercase tracking-widest">
                Stochastic Sentry Active
            </div>
        </div>
    );
}
