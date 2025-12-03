import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './views/Overview';
import Swarm from './views/Swarm';
import DataExplorer from './views/DataExplorer';
import Lab from './views/Lab';
import Observability from './views/Observability';
import Governance from './views/Governance';
import WorkspaceDashboard from '../components/WorkspaceDashboard';
import { SectorProvider } from '../context/SectorContext';

export default function App() {
    const [activeView, setActiveView] = useState('swarm');
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('agentcache_user')) || { name: 'Guest', role: 'Viewer' };
        } catch {
            return { name: 'Guest', role: 'Viewer' };
        }
    });

    const renderView = () => {
        switch (activeView) {
            case 'overview':
                return <Overview />;
            case 'pipelines':
                return (
                    <SectorProvider>
                        <WorkspaceDashboard
                            onLoadPipeline={(p) => window.location.href = `/studio.html?pipeline=${p.id}`}
                            onNewPipeline={() => window.location.href = '/studio.html?new=true'}
                        />
                    </SectorProvider>
                );
            case 'swarm':
                return <Swarm />;
            case 'lab':
                return <Lab />;
            case 'observability':
                return <Observability />;
            case 'data':
                return <DataExplorer />;
            case 'governance':
                return <Governance />;
            default:
                return <Overview />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            <Sidebar activeView={activeView} onViewChange={setActiveView} user={user} />
            <main className="flex-1 overflow-auto relative">
                {renderView()}
            </main>
        </div>
    );
}
