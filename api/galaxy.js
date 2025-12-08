
export const config = { runtime: 'nodejs' };

const PATTERNS = [
    "Legal Doc Parser", "Python SQL Cache", "React Component Gen",
    "Financial Sentiment", "HIPAA Triage", "Rust Compiler Opt",
    "Customer Support V2", "Email Sanitizer", "Unit Test Writer"
];

const AUTHORS = [
    "Swarm-Optimizer-v9",
    "Auto-Triage-Bot",
    "Code-Synthesis-Agent",
    "Query-Refiner-L2",
    "Financial-Eye-Bot",
    "System-Prime-Node"
];

export default async function handler(req, res) {
    // Generate mock 3D graph data
    const nodes = [];
    const links = [];

    // Core Node
    nodes.push({ id: 'core', name: 'AgentCache Prime', group: 'core', val: 30 });

    // 1. Generate Knowledge Sectors (The "Wikipedia Categories")
    const sectors = ['Healthcare', 'Finance', 'DevTools', 'Legal', 'Creative'];
    sectors.forEach((sector, i) => {
        const sectorId = `sector_${i}`;
        nodes.push({ id: sectorId, name: sector, group: 'sector', val: 15 });
        links.push({ source: 'core', target: sectorId });

        // 2. Generate "User Patterns" attached to sectors
        const patternCount = Math.floor(Math.random() * 5) + 3;
        for (let j = 0; j < patternCount; j++) {
            const patternName = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
            const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
            const nodeId = `kn_${i}_${j}`;

            nodes.push({
                id: nodeId,
                name: patternName,
                group: 'knowledge',
                val: 8,
                author: author,
                trustScore: Math.floor(Math.random() * 20) + 80, // High trust
                views: Math.floor(Math.random() * 5000) + 100
            });
            links.push({ source: sectorId, target: nodeId });
        }
    });

    // 3. Generate Active Agents (Users currently browsing)
    for (let k = 0; k < 8; k++) {
        const agentId = `agent_${k}`;
        nodes.push({ id: agentId, name: `Agent-${k + 100}`, group: 'agent', val: 4 });
        // Agents connect to random sectors they are using
        const targetSector = `sector_${Math.floor(Math.random() * sectors.length)}`;
        links.push({ source: agentId, target: targetSector });
    }

    const data = {
        nodes,
        links,
        stats: {
            cache_efficiency: '99.4%',
            total_memories: nodes.length * 152,
            active_agents: 42
        },
        simulation: false
    };

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
}
