export type RevenueCoreOffer = {
    id: string;
    name: string;
    tagline: string;
    buyer: string;
    problem: string;
    outcome: string;
    tier: 'free' | 'pro' | 'enterprise';
    launchPriority: 1 | 2 | 3;
    pricingHint: string;
    endpoints: string[];
    proofSignals: string[];
};

export const REVENUE_CORE_OFFERS: RevenueCoreOffer[] = [
    {
        id: 'agentcache-core',
        name: 'AgentCache Core',
        tagline: 'Semantic cache and memory for repeated agent work across hosted and open-local models.',
        buyer: 'AI product teams shipping assistants, copilots, and tool-using agents.',
        problem: 'Repeated prompts and tool calls are burning latency and model spend.',
        outcome: 'Lower cost, faster responses, and cache-backed proof of savings across provider and runtime boundaries.',
        tier: 'free',
        launchPriority: 1,
        pricingHint: 'Free to start, then usage-backed Pro and Enterprise plans.',
        endpoints: ['/api/cache/get', '/api/cache/set', '/api/memory/store', '/api/memory/recall'],
        proofSignals: ['cache_hit_rate', 'cost_savings_usd', 'active_sessions'],
    },
    {
        id: 'agentcache-guardrails',
        name: 'AgentCache Guardrails',
        tagline: 'Policy-safe execution for prompts, tools, and sensitive workflows.',
        buyer: 'Enterprise and regulated teams that need input validation and policy controls.',
        problem: 'Production agents can drift into unsafe prompts, tools, or stale data.',
        outcome: 'Safer execution with enforceable checks and fewer preventable incidents.',
        tier: 'pro',
        launchPriority: 1,
        pricingHint: 'Guardrails add-on for Pro, bundled into Enterprise.',
        endpoints: ['/api/security/check', '/api/cache/fabric/profile', '/api/tools/scan'],
        proofSignals: ['eventCounts.POLICY', 'receipts.totalReceipts', 'receipts.browser.proofs'],
    },
    {
        id: 'execution-drift-guard',
        name: 'Execution Drift Guard',
        tagline: 'Detect when production agent runs diverge from expected execution paths.',
        buyer: 'Teams running multi-step agents that need review, control, and trust evidence.',
        problem: 'Agent workflows can silently drift before anyone notices.',
        outcome: 'Shadow-mode drift detection, reviewer coverage, and operator receipts for hosted, hybrid, and local agent runtimes.',
        tier: 'pro',
        launchPriority: 1,
        pricingHint: 'Pro feature with enterprise governance and alerting expansion.',
        endpoints: ['/api/execution/runs', '/api/execution/runs/:id/evaluate', '/api/execution/runs/:id/evaluations'],
        proofSignals: ['executionDrift.totalEvaluations', 'executionDrift.driftingEvaluations', 'alignment.total'],
    },
    {
        id: 'agentcache-knowledge',
        name: 'AgentCache Knowledge',
        tagline: 'Retrieval-ready document memory with durable workspace context.',
        buyer: 'Teams building knowledge-heavy agents and internal copilots.',
        problem: 'Useful context is scattered across docs, sessions, and repeated queries.',
        outcome: 'Centralized memory, reusable retrieval context, and less duplicated work.',
        tier: 'pro',
        launchPriority: 2,
        pricingHint: 'Knowledge add-on for Pro, bundled into Enterprise.',
        endpoints: ['/api/docs/ingest', '/api/docs/search', '/api/memory/store', '/api/memory/recall'],
        proofSignals: ['fabric.analytics.summary.totalOperations', 'fabric.analytics.summary.hitRate'],
    },
    {
        id: 'agent-storage-core',
        name: 'Agent Storage Core',
        tagline: 'Artifact storage for agents on the JettyThunder backbone.',
        buyer: 'Teams that need agents to store, retrieve, and share files without losing policy control.',
        problem: 'Agents can generate useful artifacts, but raw object storage does not provide workflow context, sharing semantics, or trust evidence.',
        outcome: 'Durable artifact storage with memory linkage, namespace isolation, and a clean path to receipts and policy enforcement.',
        tier: 'enterprise',
        launchPriority: 2,
        pricingHint: 'Design-partner pilot with platform fee plus storage and egress usage.',
        endpoints: ['/api/claw/storage', '/api/claw/memory/store', '/api/claw/memory/recall'],
        proofSignals: ['receipts.storage.transfers', 'fabric.analytics.summary.totalOperations', 'active_sessions'],
    },
];

export function getRevenueCoreOffers() {
    return [...REVENUE_CORE_OFFERS].sort((a, b) => a.launchPriority - b.launchPriority);
}
