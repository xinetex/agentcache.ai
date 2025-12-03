import React from 'react';

export default function Sidebar({ activeView, onViewChange }) {
    const menuItems = [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'pipelines', label: 'Pipelines', icon: '⚡' },
        { id: 'swarm', label: 'Swarm', icon: '🌌' },
        { id: 'data', label: 'Data Explorer', icon: '💾' },
        { id: 'governance', label: 'Governance', icon: '⚖️' },
    ];

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                    AgentCache
                </h1>
                <p className="text-xs text-slate-500 mt-1">Mission Control</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeView === item.id
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                    >
                        <span>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
                <button
                    onClick={() => onViewChange('lab')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'lab'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                        }`}
                >
                    <span className="text-lg">🧬</span>
                    Lab
                </button>

                <button
                    onClick={() => onViewChange('observability')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'observability'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                        }`}
                >
                    <span className="text-lg">👁️</span>
                    Observability
                </button>

                <div className="my-4 border-t border-slate-800/50"></div>

                <button
                    onClick={() => onViewChange('governance')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'governance'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                        }`}
                >
                    <span className="text-lg">⚖️</span>
                    Governance
                </button>
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
                        AC
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white">Admin</div>
                        <div className="text-xs text-slate-500">Pro Plan</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
