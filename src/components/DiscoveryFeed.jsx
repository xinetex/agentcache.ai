
import React from 'react';
import { Shield, Radio, Activity } from 'lucide-react';

export const DiscoveryFeed = () => {
    return (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 h-full">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Radio className="w-3 h-3 text-cyan-400" /> Discovery Stream
            </h3>

            <div className="space-y-3">
                <div className="p-3 bg-slate-800/50 rounded border border-slate-700/50 flex gap-3 opacity-50">
                    <Activity className="w-4 h-4 text-slate-500 mt-1" />
                    <div>
                        <div className="text-sm text-slate-300">Awaiting Signal...</div>
                        <div className="text-[10px] text-slate-600">t-minus 0s</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
