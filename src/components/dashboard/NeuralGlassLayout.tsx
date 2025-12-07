import React from 'react';

export function NeuralGlassLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30 overflow-hidden relative font-sans">
            {/* Ambient Background Mesh */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)]" />
            </div>

            {/* Grid Pattern */}
            <div className="fixed inset-0 z-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
            }} />

            {/* Content Container */}
            <div className="relative z-10 p-6 md:p-10 max-w-[1600px] mx-auto flex flex-col gap-8 h-screen">
                <header className="flex justify-between items-end border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
                            Neural Ops Center
                        </h1>
                        <p className="text-white/40 font-mono text-sm mt-1 uppercase tracking-widest">
                            System State: <span className="text-emerald-400">Optimal</span>
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-xs text-white/30 uppercase">Region</div>
                            <div className="font-mono text-sm text-cyan-400">US-EAST-1</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-white/30 uppercase">Uptime</div>
                            <div className="font-mono text-sm text-emerald-400">99.99%</div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col gap-8 min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
