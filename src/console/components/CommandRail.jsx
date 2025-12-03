import React, { useState } from 'react';
import {
    LayoutGrid,
    Hexagon,
    Activity,
    FlaskConical,
    Database,
    Shield,
    Settings,
    LogOut,
    ChevronRight,
    Workflow
} from 'lucide-react';

const CommandRail = ({ activeView, setActiveView, user }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'pipeline', label: 'Pipeline Studio', icon: Workflow },
        { id: 'swarm', label: 'Swarm Intelligence', icon: Hexagon },
        { id: 'observability', label: 'Observability', icon: Activity },
        { id: 'lab', label: 'Research Lab', icon: FlaskConical },
        { id: 'data', label: 'Data Explorer', icon: Database },
        { id: 'governance', label: 'Governance', icon: Shield },
    ];

    return (
        <div
            className={`fixed left-0 top-16 bottom-0 z-40 flex flex-col bg-[rgba(6,11,20,0.95)] border-r border-[rgba(0,243,255,0.2)] backdrop-blur-xl transition-all duration-300 ${isExpanded ? 'w-64' : 'w-16'}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* Navigation Items */}
            <div className="flex-1 py-6 flex flex-col gap-2">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`relative flex items-center h-12 px-4 mx-2 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-[rgba(0,243,255,0.1)] text-[var(--hud-accent)] shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                                : 'text-[var(--hud-text-dim)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
                                }`}
                        >
                            <Icon size={20} className={`min-w-[20px] transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />

                            <span className={`ml-4 font-['Rajdhani'] font-semibold tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                                }`}>
                                {item.label}
                            </span>

                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--hud-accent)] rounded-r-full shadow-[0_0_10px_var(--hud-accent)]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* User Section */}
            <div className="p-2 border-t border-[rgba(0,243,255,0.1)]">
                <div className={`flex items-center p-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] ${isExpanded ? 'justify-start' : 'justify-center'}`}>
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-[var(--hud-accent)] to-[var(--hud-accent-secondary)] flex items-center justify-center text-black font-bold text-xs shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                        {user?.name?.charAt(0) || 'G'}
                    </div>

                    <div className={`ml-3 overflow-hidden transition-all duration-300 ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                        <div className="text-sm font-bold text-white truncate">{user?.name || 'Guest'}</div>
                        <div className="text-xs text-[var(--hud-accent)] font-mono">{user?.role || 'Viewer'}</div>
                    </div>
                </div>

                <button
                    onClick={() => {
                        localStorage.removeItem('agentcache_token');
                        localStorage.removeItem('agentcache_user');
                        window.location.href = '/login.html';
                    }}
                    className={`mt-2 w-full flex items-center justify-center h-10 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${!isExpanded && 'hidden'}`}
                >
                    <LogOut size={16} className="mr-2" />
                    <span className="font-['Rajdhani'] font-semibold">LOGOUT</span>
                </button>
            </div>
        </div>
    );
};

export default CommandRail;
