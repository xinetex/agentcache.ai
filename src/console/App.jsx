import React, { useState, useEffect } from 'react';
import CommandRail from './components/CommandRail.jsx';
import HUD from './components/HUD.jsx';
import Overview from './views/Overview.jsx';
import PipelineStudio from './views/PipelineStudio.jsx';
import Swarm from './views/Swarm.jsx';
import Observability from './views/Observability.jsx';
import Lab from './views/Lab.jsx';
import DataExplorer from './views/DataExplorer.jsx';
import Governance from './views/Governance.jsx';
import Settings from './views/Settings.jsx';
import Admin from './views/Admin.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginOverlay from './components/LoginOverlay.jsx';
import RegisterOverlay from './components/RegisterOverlay.jsx';
import WelcomeTour from './components/WelcomeTour.jsx';

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
        if (path.includes('admin')) return 'admin';
        if (path.includes('register')) return 'register';
        return 'swarm';
    };
    const [activeView, setActiveView] = useState(getInitialView());
    const [showTour, setShowTour] = useState(false);
    const { user, loading } = useAuth();

    useEffect(() => {
        // Show tour on first visit (mock logic using localStorage)
        const hasSeenTour = localStorage.getItem('ac_has_seen_tour');
        if (!hasSeenTour && !loading && user) {
            setShowTour(true);
        }
    }, [user, loading]);

    if (loading) return <div className="h-screen flex items-center justify-center text-[var(--hud-accent)] font-mono">INITIALIZING...</div>;

    // Explicit register view (prioritize over login overlay)
    if (activeView === 'register') {
        return <RegisterOverlay />;
    }

    // Demo Mode Logic - FORCED ON by default until auth stabilizes
    const isDemo = true; // new URLSearchParams(window.location.search).get('demo') === 'true';
    const DEMO_USER = {
        id: 'demo-guest',
        name: 'Guest User',
        email: 'guest@agentcache.ai',
        role: 'viewer',
        organizationId: 'org_demo'
    };

    const effectiveUser = user || (isDemo ? DEMO_USER : null);

    if (!effectiveUser) return <LoginOverlay />;

    const renderView = () => {
        switch (activeView) {
            case 'overview': return <Overview />;
            case 'swarm': return <Swarm />;
            case 'pipeline': return <PipelineStudio />;
            case 'lab': return <Lab />;
            case 'observability': return <Observability />;
            case 'data': return <DataExplorer />;
            case 'governance': return <Governance />;
            case 'settings': return <Settings />;
            case 'admin': return <Admin />;
            default: return <Swarm />;
        }
    };

    return (
        <div className="flex h-screen bg-[var(--hud-bg)] text-[var(--hud-text)] overflow-hidden font-sans selection:bg-[var(--hud-accent)] selection:text-black">
            {/* Fixed Command Rail (Left) */}
            <CommandRail activeView={activeView} setActiveView={setActiveView} user={effectiveUser} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col pl-16 transition-all duration-300">
                {/* Demo Mode Banner */}
                {isDemo && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center">
                        <p className="text-xs font-mono text-amber-400">
                            ⚡ PREVIEW MODE: Registration is temporarily disabled for maintenance.
                            <span className="ml-2 font-bold text-amber-300">System is Open.</span>
                        </p>
                    </div>
                )}

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

            {/* Onboarding Tour */}
            {showTour && (
                <WelcomeTour
                    onClose={() => {
                        setShowTour(false);
                        localStorage.setItem('ac_has_seen_tour', 'true');
                    }}
                    isDemo={isDemo}
                />
            )}
        </div>
    );
};

const App = () => (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
);

export default App;
