import React from 'react';
import NeuralGalaxy from '../../components/NeuralGalaxy';

export default function Swarm() {
    return (
        <div className="h-full flex flex-col">
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
                <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Swarm Intelligence</h2>
                <p className="text-slate-200 drop-shadow-md">Live visualization of agent coordination and semantic memory</p>
            </div>

            <div className="flex-1 bg-black relative">
                <NeuralGalaxy />
            </div>
        </div>
    );
}
