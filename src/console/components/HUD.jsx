import React, { useState, useEffect } from 'react';
import { Bell, Search, Wifi } from 'lucide-react';

const HUD = () => {
    const [time, setTime] = useState(new Date());
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => {
            clearInterval(timer);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 h-16 z-50 transition-all duration-300 ${scrolled
                ? 'bg-[rgba(3,5,8,0.9)] backdrop-blur-md border-b border-[rgba(0,243,255,0.2)]'
                : 'bg-transparent border-b border-transparent'
            }`}>
            <div className="h-full px-6 flex items-center justify-between">

                {/* Left: Brand */}
                <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--hud-accent)] to-[var(--hud-accent-secondary)] rounded-lg blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                        <div className="relative w-10 h-10 bg-black border border-[var(--hud-accent)] rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-[var(--hud-accent)] rotate-45 group-hover:rotate-90 transition-transform duration-500"></div>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-['Rajdhani'] font-bold tracking-widest text-white">
                            AGENT<span className="text-[var(--hud-accent)]">CACHE</span>
                        </h1>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--hud-text-dim)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            SYSTEM ONLINE
                        </div>
                    </div>
                </div>

                {/* Center: Ticker */}
                <div className="hidden md:flex items-center gap-8 px-8 py-2 bg-[rgba(255,255,255,0.03)] rounded-full border border-[rgba(255,255,255,0.05)]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--hud-text-dim)] uppercase tracking-wider">Grid Status</span>
                        <span className="text-xs font-mono text-[var(--hud-success)]">OPTIMAL</span>
                    </div>
                    <div className="w-px h-4 bg-[rgba(255,255,255,0.1)]"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--hud-text-dim)] uppercase tracking-wider">Latency</span>
                        <span className="text-xs font-mono text-[var(--hud-accent)]">42ms</span>
                    </div>
                    <div className="w-px h-4 bg-[rgba(255,255,255,0.1)]"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--hud-text-dim)] uppercase tracking-wider">Active Agents</span>
                        <span className="text-xs font-mono text-white">8,492</span>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <button className="text-[var(--hud-text-dim)] hover:text-white transition-colors">
                            <Search size={20} />
                        </button>
                        <button className="relative text-[var(--hud-text-dim)] hover:text-white transition-colors">
                            <Bell size={20} />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--hud-accent)] rounded-full animate-pulse"></span>
                        </button>
                    </div>

                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-mono font-bold text-white">
                            {time.toLocaleTimeString([], { hour12: false })}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--hud-text-dim)]">UTC</div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default HUD;
