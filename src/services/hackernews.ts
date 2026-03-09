export async function getTopStories() {
    // Mock HN Top Stories for stream simulation
    return [
        { id: 40000001, title: 'AgentCache.ai: The First Autonomous Cache Layer for Swarms', score: 950, by: 'gravity_master' },
        { id: 40000002, title: 'Show HN: Drifting through the latent space of API responses', score: 420, by: 'latent_walker' },
        { id: 40000003, title: 'Why your agents are hallucinating (and how to fix it)', score: 310, by: 'hallucination_hunter' },
        { id: 40000004, title: 'The case for gasless agent transactions', score: 125, by: 'gasless_monk' },
        { id: 40000005, title: 'Sentinel: Monitoring Moltbook for Alpha signals', score: 88, by: 'sentinel_bot' }
    ];
}
