
import { db } from '../src/db/client.js';
import { agents } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

export default async function handler(req, res) {
    try {
        // 1. Fetch Agents
        const allAgents = await db.select().from(agents).orderBy(desc(agents.createdAt)).limit(20);

        // 2. Transform / Mock
        let agentList = allAgents.map(a => ({
            id: a.id,
            name: a.name,
            role: a.role || 'Assistant',
            description: a.description || 'An intelligent agent.',
            status: a.status || 'Active',
            icon: a.icon || 'solar:robot-2-linear',
            color: a.color || 'bg-blue-100 text-blue-600'
        }));

        // Mock Fallback if DB is empty
        if (agentList.length === 0) {
            agentList = [
                {
                    id: 'agt_sentinel',
                    name: 'The Sentinel',
                    role: 'Security',
                    description: 'Autonomous Moltbook monitor. Detects high-alpha signals and interacts with communities.',
                    status: 'Active',
                    icon: 'solar:shield-check-linear',
                    color: 'bg-emerald-100 text-emerald-600',
                    link: '/chat.html?agent=sentinel'
                },
                {
                    id: 'agt_synth',
                    name: 'Data Synthesizer',
                    role: 'Analyst',
                    description: 'Merges CSV/SQL data into visualizations. Great for Q3 reporting.',
                    status: 'Idle',
                    icon: 'solar:chart-2-linear',
                    color: 'bg-blue-100 text-blue-600',
                    link: '/chat.html?agent=synthesizer'
                },
                {
                    id: 'agt_coder',
                    name: 'Code Auditor',
                    role: 'Engineer',
                    description: 'Scans PRs for security flaws and suggests improvements using Claude 3.5.',
                    status: 'Active',
                    icon: 'solar:code-circle-linear',
                    color: 'bg-purple-100 text-purple-600',
                    link: '/chat.html?agent=coder'
                },
                {
                    id: 'agt_researcher',
                    name: 'Product Researcher',
                    role: 'Focus Group',
                    description: 'Conducts autonomous surveys on Moltbook to gather user feedback.',
                    status: 'Active',
                    icon: 'solar:chat-round-dots-linear',
                    color: 'bg-orange-100 text-orange-600 mr-2', // Added mr-2 for spacing if needed, though grid handles gap
                    link: '/chat.html?agent=researcher'
                }
            ];
        }

        return res.status(200).json({ agents: agentList });

    } catch (error) {
        console.error('Agents Fetch Error:', error);
        return res.status(500).json({ error: 'Failed to fetch agents' });
    }
}
