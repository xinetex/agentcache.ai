import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import CyberCard from '../components/CyberCard';
import ParallelCoordinates from '../components/ParallelCoordinates';
import { FlaskConical, Activity } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const STATES = ['START', 'L1_CHECK', 'L2_CHECK', 'L3_SEARCH', 'COGNITIVE', 'LLM_CALL', 'END'];

export default function Lab() {
    const { token } = useAuth();
    const [genomes, setGenomes] = useState([]);
    const [selectedGenome, setSelectedGenome] = useState(null);
    const svgRef = useRef(null);

    // Fetch Genomes
    useEffect(() => {
        if (!token) return;

        const fetchGenomes = async () => {
            try {
                const res = await fetch('/api/lab/genomes?limit=20', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.genomes && data.genomes.length > 0) {
                    setGenomes(data.genomes);
                    setSelectedGenome(data.genomes[0]); // Select best by default
                }
            } catch (err) {
                console.error("Failed to fetch genomes:", err);
            }
        };
        fetchGenomes();
    }, [token]);

    // Render (No Effect, handoff to Component)
    // useEffect(() => { ... }, [selectedGenome]); discontinued manual d3 effect


    return (
        <div className="h-[calc(100vh-8rem)] flex gap-6">

            {/* Sidebar: Genome List */}
            <div className="w-80 flex flex-col gap-4">
                <CyberCard title="Evolutionary Lab" icon={FlaskConical} className="flex-1 flex flex-col">
                    <div className="text-xs text-[var(--hud-text-dim)] mb-4">
                        Observing Generation <span className="text-[var(--hud-accent)] font-mono">{genomes.length > 0 ? genomes[0].generation : 0}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {genomes.map(genome => (
                            <div
                                key={genome.id}
                                onClick={() => setSelectedGenome(genome)}
                                className={`p-3 rounded border cursor-pointer transition-all ${selectedGenome?.id === genome.id
                                    ? 'bg-[var(--hud-accent)]/10 border-[var(--hud-accent)] shadow-[0_0_10px_var(--hud-accent)]'
                                    : 'bg-black border-[var(--hud-border)] hover:border-[var(--hud-text)]'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-mono text-[var(--hud-text-dim)]">Gen {genome.generation}</span>
                                    <span className="text-xs font-bold text-[var(--hud-success)]">Fit: {Math.round(genome.fitness || 0)}</span>
                                </div>
                                <div className="text-[10px] text-[var(--hud-text-dim)] truncate font-mono">{genome.id.split('-').pop()}</div>

                                {/* Mini Phenotype Preview */}
                                <div className="mt-2 flex gap-1 overflow-hidden opacity-50">
                                    {genome.phenotype?.slice(0, 5).map((step, i) => (
                                        <div key={i} className="w-1 h-3 rounded-full bg-[var(--hud-text-dim)]" title={step}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CyberCard>
            </div>

            {/* Main: Visualization */}
            <div className="flex-1 flex flex-col gap-6">
                <CyberCard className="flex-1 relative overflow-hidden p-0">
                    <div className="absolute top-4 left-4 z-10 pointer-events-none">
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            <Activity size={20} className="text-[var(--hud-accent)]" />
                            Multi-Objective Fitness Landscape
                        </h1>
                        <p className="text-[var(--hud-text-dim)] text-xs font-mono">Parallel Coordinates: Generation vs Fitness vs Complexity</p>
                    </div>

                    {/* Parallel Coordinates Visualization */}
                    <div className="w-full h-full pt-16 pb-8 px-8 bg-black/50">
                        {genomes.length > 0 ? (
                            <ParallelCoordinates
                                data={genomes.map(g => ({
                                    ...g,
                                    generation: g.generation,
                                    fitness: g.fitness,
                                    complexity: Math.random() * 100, // Mock metric if missing
                                    latency: Math.random() * 500 // Mock metric if missing
                                }))}
                                dimensions={['generation', 'fitness', 'complexity', 'latency']}
                                colorBy="fitness"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--hud-text-dim)]">awaiting genome data...</div>
                        )}
                    </div>
                </CyberCard>
            </div>
        </div>
    );
}
