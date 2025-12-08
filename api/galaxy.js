
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    // Generate mock 3D graph data
    const nodes = [];
    const links = [];
    const groups = ['core', 'sector', 'agent', 'knowledge'];

    // Core Node
    nodes.push({ id: 'core', name: 'System Prime', group: 'core', val: 20 });

    // Generate sectors
    for (let i = 0; i < 5; i++) {
        const sectorId = `sector_${i}`;
        nodes.push({ id: sectorId, name: `Sector ${i + 1}`, group: 'sector', val: 10 });
        links.push({ source: 'core', target: sectorId });

        // Generate agents per sector
        for (let j = 0; j < 3; j++) {
            const agentId = `agent_${i}_${j}`;
            nodes.push({ id: agentId, name: `Agent ${i + 1}-${j + 1}`, group: 'agent', val: 5 });
            links.push({ source: sectorId, target: agentId });
        }
    }

    const data = {
        nodes,
        links,
        stats: {
            cache_efficiency: '99.2%',
            total_memories: 14052,
            active_agents: 15
        },
        simulation: false
    };

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
}
