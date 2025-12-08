
export const config = { runtime: 'nodejs' };
import fetch from 'node-fetch';

export default async function handler(req) {
    try {
        // Fetch trending AI repositories created recently or generally popular
        // We use a broader query to ensure we get results without needing auth for rate limits mostly
        const url = `https://api.github.com/search/repositories?q=topic:artificial-intelligence&sort=stars&order=desc&per_page=10`;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'AgentCache-Observability' }
        });

        if (!res.ok) throw new Error(`GitHub API: ${res.statusText}`);

        const data = await res.json();

        // Map GitHub Repos to "Agent" format for the Leaderboard
        const leaderboard = data.items.map(repo => ({
            id: repo.id,
            name: repo.name,
            provider: repo.owner.login,
            requests: repo.stargazers_count, // "Popularity"
            hits: repo.forks_count,         // "Usage"
            hitRate: Math.min(100, Math.round((repo.forks_count / repo.stargazers_count) * 100)), // "Virality"
            score: (repo.stargazers_count / 1000).toFixed(1) + 'k', // Display Score
            latency: Math.round(Math.random() * 200 + 50), // Mock latency for "responsiveness"
            lastActive: repo.updated_at
        }));

        return new Response(JSON.stringify(leaderboard), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate=60' // 5 min cache
            }
        });

    } catch (err) {
        console.error("Agents API Error:", err);
        // Fallback to internal mocks if GitHub rate limits (likely)
        return new Response(JSON.stringify([
            { name: 'Backup-System', provider: 'Internal', requests: 0, hits: 0, hitRate: 0, score: '0' }
        ]), { status: 200 });
    }
}
