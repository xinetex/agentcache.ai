
import { useState, useEffect } from 'react';

/**
 * useAgentSystem Hook
 * 
 * Provides a unified interface to explore and integrate with the Agent Ecosystem.
 * Connects to /api/intelligence, /api/decisions, and potentially /api/marketplace (if added).
 */
export function useAgentSystem() {
    const [agents, setAgents] = useState([]);
    const [decisions, setDecisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSystemState = async () => {
        setLoading(true);
        try {
            // Parallel Fetch
            const [agentsRes, decisionsRes] = await Promise.all([
                fetch('/api/intelligence'),
                fetch('/api/decisions')
            ]);

            if (agentsRes.ok) {
                const data = await agentsRes.json();
                setAgents(data.agents || []);
            }

            if (decisionsRes.ok) {
                const logData = await decisionsRes.json();
                setDecisions(logData.decisions || []);
            }

        } catch (err) {
            console.error("Failed to fetch Agent System state:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchSystemState();

        // Optional: Poll every 10s for "Live" feel
        const interval = setInterval(fetchSystemState, 10000);
        return () => clearInterval(interval);
    }, []);

    return {
        agents,
        decisions,
        loading,
        error,
        refresh: fetchSystemState,

        // Helper to find specific agent capability
        findAgentByRole: (role) => agents.find(a => a.role === role),

        // Helper to get recent logs for an agent
        getLogsForAgent: (agentId) => decisions.filter(d => d.agentId === agentId)
    };
}
