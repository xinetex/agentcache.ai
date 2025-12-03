import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './views/Overview';
import Swarm from './views/Swarm';
import DataExplorer from './views/DataExplorer';
import Governance from './views/Governance';
import WorkspaceDashboard from '../components/WorkspaceDashboard';
import { SectorProvider } from '../context/SectorContext';

export default function App() {
    const [activeView, setActiveView] = useState('swarm');

    const renderView = () => {
        switch (activeView) {
            case 'overview':
                return <Overview />;
            case 'pipelines':
                return (
                    <SectorProvider>
                        <WorkspaceDashboard
                            onLoadPipeline={(p) => console.log('Load', p)}
                            onNewPipeline={() => console.log('New')}
                        />
                    </SectorProvider>
                );
            case 'swarm':
                return <Swarm />;
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
            <Sidebar activeView={activeView} onViewChange={setActiveView} />
            <main className="flex-1 overflow-auto relative">
                {renderView()}
            </main>
        </div>
    );
}
