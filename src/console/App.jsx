import React, { useState, useEffect } from 'react';
import CommandRail from './components/CommandRail';
import HUD from './components/HUD';
import Overview from './views/Overview';
import PipelineStudio from './views/PipelineStudio';
import Swarm from './views/Swarm';
import Observability from './views/Observability';
import Lab from './views/Lab';
import DataExplorer from './views/DataExplorer';
import Governance from './views/Governance';
import Settings from './views/Settings';

const AppContent = () => {
    // "Neural Ops" (swarm) is default, unless URL specifies otherwise
    const getInitialView = () => {
        const path = window.location.pathname;
        if (path.includes('observability')) return 'observability';
        if (path.includes('pipeline')) return 'pipeline';
        if (path.includes('lab')) return 'lab';
        if (path.includes('data')) return 'data';
        if (path.includes('governance')) return 'governance';
        if (path.includes('settings')) return 'settings';
        return 'swarm';
    };
    const [activeView, setActiveView] = useState(getInitialView());
    const { user, loading } = useAuth();

    if (loading) return <div className="h-screen flex items-center justify-center text-[var(--hud-accent)] font-mono">INITIALIZING...</div>;
    if (!user) return <LoginOverlay />;

    const renderView = () => {
        switch (activeView) {
            case 'overview': return <Overview />;
            case 'pipeline': return <PipelineStudio />;
            case 'swarm': return <Swarm />;
            case 'observability': return <Observability />;
            case 'lab': return <Lab />;
            case 'data': return <DataExplorer />;
            case 'governance': return <Governance />;
            case 'settings': return <Settings />;
            default: return <Overview />;
        }
    };

    return (
        <SectorProvider>
            <div className="flex h-screen bg-[var(--hud-bg)] text-[var(--hud-text)] overflow-hidden font-sans selection:bg-[var(--hud-accent)] selection:text-black">
                {/* Fixed Command Rail (Left) */}
                <CommandRail activeView={activeView} setActiveView={setActiveView} user={user} />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col pl-16 transition-all duration-300">
                    {/* Fixed HUD (Top) */}
                    <HUD />

                    {/* Scrollable Viewport */}
                    <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 p-6 relative">
                        {/* Grid Background Overlay */}
                        <div className="fixed inset-0 pointer-events-none z-0 opacity-20"
                            style={{
                                backgroundImage: 'linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px)',
                                backgroundSize: '40px 40px'
                            }}>
                        </div>

                        {/* View Content */}
                        <div className="relative z-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderView()}
                        </div>
                    </main>
                </div>
            </div>
        </SectorProvider>
    );
};

const App = () => (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
);

export default App;
