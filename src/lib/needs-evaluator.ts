/**
 * Needs Evaluator — 5-Stage Evaluation Pipeline
 *
 * Turns vague demand signals into actionable build specifications.
 *
 * Stage 1: Specificity Scoring (deterministic)
 * Stage 2: Clarification Questions (deterministic templates)
 * Stage 3: Signal Clustering (keyword overlap)
 * Stage 4: Build Spec Generation (LLM via Kimi)
 * Stage 5: Priority Scoring & Routing
 */

import { openClaw } from './openclaw.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SpecificityBreakdown {
    use_case: number;      // 0 or 0.2 — describes WHO needs it and WHY
    technical: number;     // 0 or 0.2 — names specific technologies/protocols
    io_spec: number;       // 0 or 0.2 — describes expected inputs/outputs
    constraints: number;   // 0 or 0.2 — mentions latency, compliance, scale
    demand_evidence: number; // 0 or 0.2 — has frequency data, multiple reporters
}

export type EvaluationStatus = 'needs_clarification' | 'partially_actionable' | 'actionable';

export interface ClarificationQuestion {
    dimension: keyof SpecificityBreakdown;
    question: string;
    why: string;  // Why we're asking
}

export interface SignalCluster {
    id: string;
    name: string;
    signalIds: string[];
    keywords: string[];
    combinedScore: number;
    uniqueAgents: number;
    confidence: 'low' | 'medium' | 'high';
}

export interface BuildSpec {
    problem: string;
    inputs: { name: string; type: string; description: string }[];
    outputs: { name: string; type: string; description: string }[];
    technicalApproach: string;
    estimatedEffort: string;
    solutionCategory: 'missing-tools' | 'optimized-workflows' | 'precomputed-knowledge';
    suggestedEndpoint: string;
    dependencies: string[];
    acceptanceCriteria: string[];
}

export interface EvaluationResult {
    signalId: string;
    signalTitle: string;
    signalType: string;
    specificity: {
        score: number;
        breakdown: SpecificityBreakdown;
        status: EvaluationStatus;
    };
    clarificationQuestions: ClarificationQuestion[];
    cluster?: SignalCluster;
    buildSpec?: BuildSpec;
    priority: {
        score: number;
        rank: 'critical' | 'high' | 'medium' | 'low';
        route: string;
    };
}

// ============================================================================
// STAGE 1: SPECIFICITY SCORING
// ============================================================================

// Keyword dictionaries for each dimension
const USE_CASE_INDICATORS = [
    'agent', 'bot', 'assistant', 'workflow', 'pipeline', 'automate',
    'user', 'customer', 'patient', 'student', 'developer', 'team',
    'when', 'need to', 'want to', 'trying to', 'use case', 'scenario',
    'for', 'so that', 'in order to', 'because', 'helps', 'enables',
    'healthcare', 'finance', 'legal', 'education', 'ecommerce', 'enterprise',
    'support', 'research', 'analysis', 'monitoring', 'trading',
];

const TECHNICAL_INDICATORS = [
    'api', 'sdk', 'rest', 'graphql', 'websocket', 'sse', 'grpc',
    'json', 'xml', 'csv', 'protobuf', 'yaml',
    'python', 'node', 'typescript', 'javascript', 'go', 'rust',
    'redis', 'postgres', 'mongodb', 'pinecone', 'weaviate',
    'docker', 'kubernetes', 'vercel', 'aws', 'gcp',
    'oauth', 'jwt', 'api key', 'bearer', 'hmac',
    'embedding', 'vector', 'cosine', 'semantic', 'similarity',
    'webhook', 'callback', 'pub/sub', 'event', 'stream',
    'http', 'https', 'tcp', 'udp',
    'openai', 'anthropic', 'moonshot', 'claude', 'gpt',
    'vscode', 'cursor', 'jupyter', 'notebook',
    'zendesk', 'servicenow', 'shopify', 'magento', 'okta',
];

const IO_INDICATORS = [
    'input', 'output', 'returns', 'accepts', 'sends', 'receives',
    'request', 'response', 'payload', 'body', 'header',
    'format', 'schema', 'structure', 'field', 'parameter',
    'upload', 'download', 'stream', 'batch', 'bulk',
    'query', 'result', 'data', 'record', 'row',
    'get', 'post', 'put', 'delete', 'patch',
];

const CONSTRAINT_INDICATORS = [
    'latency', 'ms', 'millisecond', 'second', 'fast', 'real-time',
    'throughput', 'req/s', 'requests per', 'concurrent', 'parallel',
    'hipaa', 'ferpa', 'gdpr', 'pci', 'soc2', 'compliance', 'audit',
    'encrypt', 'secure', 'isolat', 'tenant', 'permission', 'rbac',
    'cost', 'budget', 'pricing', 'free tier', 'quota', 'limit',
    'scale', 'million', 'thousand', 'high volume', 'enterprise',
    'uptime', 'sla', 'availability', '99.9', 'failover', 'redundant',
    'region', 'edge', 'multi-region', 'global',
];

const DEMAND_INDICATORS = [
    'critical', 'urgent', 'blocker', 'must have', 'essential',
    'multiple', 'many', 'several', 'team', 'organization',
    'daily', 'hourly', 'frequently', 'constantly', 'always',
    'pain point', 'frustrating', 'painful', 'slow', 'broken',
    'cost us', 'losing', 'waste', 'inefficient',
    'vote', 'request', 'asked for', 'popular', 'common',
];

function countMatches(text: string, indicators: string[]): number {
    const lower = text.toLowerCase();
    let matches = 0;
    for (const indicator of indicators) {
        if (lower.includes(indicator.toLowerCase())) {
            matches++;
        }
    }
    return matches;
}

export function scoreSpecificity(title: string, description: string, raw?: any): SpecificityBreakdown {
    const text = `${title} ${description} ${raw?.context || ''} ${raw?.urgency || ''}`;

    // Each dimension: if >= 2 keyword matches, score 0.2; if 1 match, score 0.1; if 0, score 0
    const score = (matches: number): number => matches >= 2 ? 0.2 : matches === 1 ? 0.1 : 0;

    return {
        use_case: score(countMatches(text, USE_CASE_INDICATORS)),
        technical: score(countMatches(text, TECHNICAL_INDICATORS)),
        io_spec: score(countMatches(text, IO_INDICATORS)),
        constraints: score(countMatches(text, CONSTRAINT_INDICATORS)),
        demand_evidence: score(countMatches(text, DEMAND_INDICATORS)),
    };
}

export function totalScore(breakdown: SpecificityBreakdown): number {
    return Object.values(breakdown).reduce((sum, v) => sum + v, 0);
}

export function classifyStatus(score: number): EvaluationStatus {
    if (score < 0.4) return 'needs_clarification';
    if (score < 0.7) return 'partially_actionable';
    return 'actionable';
}

// ============================================================================
// STAGE 2: CLARIFICATION QUESTIONS
// ============================================================================

const CLARIFICATION_TEMPLATES: Record<keyof SpecificityBreakdown, ClarificationQuestion[]> = {
    use_case: [
        { dimension: 'use_case', question: 'What specific task would this tool perform? Describe a concrete scenario.', why: 'We need to understand the use case to design the right solution.' },
        { dimension: 'use_case', question: 'Who is the end user — a bot, an agent framework, a human developer, or an end customer?', why: 'The integration approach differs for each user type.' },
    ],
    technical: [
        { dimension: 'technical', question: 'What protocols or formats should this support? (REST API, WebSocket, SDK, CLI, etc.)', why: 'We need to know the delivery mechanism.' },
        { dimension: 'technical', question: 'What existing tools or platforms does this need to integrate with?', why: 'Integration requirements define the technical architecture.' },
    ],
    io_spec: [
        { dimension: 'io_spec', question: 'What would the input look like? Describe the data you would send.', why: 'Input specification is needed to design the interface.' },
        { dimension: 'io_spec', question: 'What output format do you need? (JSON, streaming, file, etc.)', why: 'Output format determines the response contract.' },
    ],
    constraints: [
        { dimension: 'constraints', question: 'What latency or throughput is required? (e.g., <100ms, 1000 req/s)', why: 'Performance requirements determine infrastructure choices.' },
        { dimension: 'constraints', question: 'Any compliance or security requirements? (HIPAA, SOC2, data residency, etc.)', why: 'Compliance needs affect architecture and cost.' },
    ],
    demand_evidence: [
        { dimension: 'demand_evidence', question: 'How often would you use this? (daily, hourly, per-request)', why: 'Usage frequency helps us prioritize and price correctly.' },
        { dimension: 'demand_evidence', question: 'What is the cost of NOT having this? (time wasted, money lost, deals blocked)', why: 'Impact quantification helps us prioritize development.' },
    ],
};

export function generateClarificationQuestions(breakdown: SpecificityBreakdown): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    for (const [dimension, score] of Object.entries(breakdown)) {
        if (score === 0) {
            const templates = CLARIFICATION_TEMPLATES[dimension as keyof SpecificityBreakdown];
            if (templates) {
                questions.push(...templates);
            }
        }
    }

    // Limit to 5 most important questions
    return questions.slice(0, 5);
}

// ============================================================================
// STAGE 3: SIGNAL CLUSTERING
// ============================================================================

// Stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'and', 'or', 'but', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'that', 'this', 'these', 'those', 'it', 'its', 'no', 'any', 'all',
]);

export function extractKeywords(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w))
        .filter((w, i, arr) => arr.indexOf(w) === i);  // unique
}

export function clusterSignals(signals: { id: string; title: string; description: string; type: string; score: number; raw?: any }[]): SignalCluster[] {
    // Extract keywords for each signal
    const signalKeywords = signals.map(s => ({
        ...s,
        keywords: extractKeywords(`${s.title} ${s.description}`),
    }));

    // Build clusters via greedy keyword overlap
    const clustered = new Set<string>();
    const clusters: SignalCluster[] = [];

    for (let i = 0; i < signalKeywords.length; i++) {
        if (clustered.has(signalKeywords[i].id)) continue;

        const cluster: typeof signalKeywords = [signalKeywords[i]];
        clustered.add(signalKeywords[i].id);

        for (let j = i + 1; j < signalKeywords.length; j++) {
            if (clustered.has(signalKeywords[j].id)) continue;

            // Calculate keyword overlap (Jaccard-like)
            const kw1 = new Set(signalKeywords[i].keywords);
            const kw2 = new Set(signalKeywords[j].keywords);
            const intersection = [...kw2].filter(k => kw1.has(k));
            const union = new Set([...kw1, ...kw2]);
            const overlap = union.size > 0 ? intersection.length / union.size : 0;

            if (overlap >= 0.15 || intersection.length >= 3) {
                cluster.push(signalKeywords[j]);
                clustered.add(signalKeywords[j].id);
            }
        }

        if (cluster.length >= 1) {
            // Derive cluster name from most common keywords
            const allKeywords = cluster.flatMap(s => s.keywords);
            const keywordCounts = new Map<string, number>();
            for (const kw of allKeywords) {
                keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
            }
            const topKeywords = [...keywordCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([kw]) => kw);

            // Count unique agents (from raw.agentId or raw.agent_id)
            const agents = new Set(cluster.map(s => s.raw?.agentId || s.raw?.agent_id || 'unknown'));

            clusters.push({
                id: `cluster_${clusters.length}`,
                name: topKeywords.slice(0, 3).join(' + '),
                signalIds: cluster.map(s => s.id),
                keywords: topKeywords,
                combinedScore: cluster.reduce((sum, s) => sum + (s.score || 0), 0),
                uniqueAgents: agents.size,
                confidence: agents.size >= 3 ? 'high' : agents.size >= 2 ? 'medium' : 'low',
            });
        }
    }

    return clusters.sort((a, b) => b.combinedScore - a.combinedScore);
}

// ============================================================================
// STAGE 4: BUILD SPEC GENERATION (LLM)
// ============================================================================

export async function generateBuildSpec(
    title: string,
    description: string,
    type: string,
    clusterContext?: { relatedSignals: string[]; keywords: string[] }
): Promise<BuildSpec | null> {
    const contextSection = clusterContext
        ? `\nRelated signals from other agents:\n${clusterContext.relatedSignals.map(s => `- ${s}`).join('\n')}\nCommon keywords: ${clusterContext.keywords.join(', ')}`
        : '';

    const prompt = `You are a solutions architect at AgentCache, a caching and tooling platform for AI agents.

Given this demand signal from an agent/bot customer, generate a concrete, buildable specification.

Signal Type: ${type}
Signal Title: ${title}
Signal Description: ${description}${contextSection}

Generate a build specification in this exact JSON format:
{
  "problem": "One paragraph describing the exact problem to solve",
  "inputs": [{"name": "param_name", "type": "string|number|object|array", "description": "what this input is"}],
  "outputs": [{"name": "field_name", "type": "string|number|object|array", "description": "what this output contains"}],
  "technicalApproach": "2-3 sentences on HOW to build this (architecture, key technologies)",
  "estimatedEffort": "X days/weeks — brief justification",
  "solutionCategory": "missing-tools OR optimized-workflows OR precomputed-knowledge",
  "suggestedEndpoint": "POST /api/tools/example or similar",
  "dependencies": ["list", "of", "external", "dependencies"],
  "acceptanceCriteria": ["testable criterion 1", "testable criterion 2", "testable criterion 3"]
}

Be specific and practical. If the signal is vague, make reasonable assumptions but note them.
Return ONLY valid JSON, no markdown fences.`;

    try {
        const response = await openClaw.complete(prompt,
            'You are a pragmatic solutions architect. Produce precise, buildable specifications. Return only valid JSON.');

        // Strip markdown fences if present
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (err: any) {
        console.error('[NeedsEvaluator] Build spec generation failed:', err.message);
        return null;
    }
}

// ============================================================================
// STAGE 5: PRIORITY SCORING & ROUTING
// ============================================================================

const URGENCY_WEIGHTS: Record<string, number> = {
    critical: 3.0,
    high: 2.0,
    medium: 1.0,
    low: 0.5,
};

const TYPE_ROUTES: Record<string, string> = {
    missing_capability: 'missing-tools',
    friction: 'optimized-workflows',
    pattern: 'precomputed-knowledge',
};

export function calculatePriority(
    specificityScore: number,
    demandScore: number,
    urgency: string,
    clusterSize: number
): { score: number; rank: 'critical' | 'high' | 'medium' | 'low'; route: string } {
    const urgencyWeight = URGENCY_WEIGHTS[urgency] || 1.0;
    const clusterBoost = Math.min(clusterSize * 0.1, 0.5); // Up to 50% boost from cluster

    // Priority = specificity × log(demand + 1) × urgency × (1 + clusterBoost)
    const rawPriority = specificityScore * Math.log2(demandScore + 2) * urgencyWeight * (1 + clusterBoost);

    // Normalize to 0-100
    const normalized = Math.min(Math.round(rawPriority * 20), 100);

    let rank: 'critical' | 'high' | 'medium' | 'low';
    if (normalized >= 75) rank = 'critical';
    else if (normalized >= 50) rank = 'high';
    else if (normalized >= 25) rank = 'medium';
    else rank = 'low';

    return { score: normalized, rank, route: '' };  // Route set by caller based on type
}

// ============================================================================
// MAIN EVALUATOR
// ============================================================================

export interface SignalInput {
    id: string;
    title: string;
    description: string;
    type: string;
    score: number;
    raw?: any;
}

/**
 * Evaluate a single signal through the full pipeline.
 * Stages 1-3 + 5 are always run (deterministic, fast).
 * Stage 4 (LLM spec generation) only runs if `deep` is true and signal is actionable.
 */
export async function evaluateSignal(
    signal: SignalInput,
    allSignals: SignalInput[],
    options: { deep?: boolean } = {}
): Promise<EvaluationResult> {
    // Stage 1: Specificity
    const breakdown = scoreSpecificity(signal.title, signal.description, signal.raw);
    const specScore = totalScore(breakdown);
    const status = classifyStatus(specScore);

    // Stage 2: Clarification
    const clarificationQuestions = status === 'needs_clarification'
        ? generateClarificationQuestions(breakdown)
        : [];

    // Stage 3: Clustering
    const clusters = clusterSignals(allSignals);
    const myCluster = clusters.find(c => c.signalIds.includes(signal.id));

    // Stage 4: Build Spec (only if deep mode and signal is actionable enough)
    let buildSpec: BuildSpec | undefined;
    if (options.deep && specScore >= 0.4) {
        const clusterContext = myCluster && myCluster.signalIds.length > 1
            ? {
                relatedSignals: allSignals
                    .filter(s => myCluster.signalIds.includes(s.id) && s.id !== signal.id)
                    .map(s => s.title),
                keywords: myCluster.keywords,
            }
            : undefined;

        const spec = await generateBuildSpec(signal.title, signal.description, signal.type, clusterContext);
        if (spec) buildSpec = spec;
    }

    // Stage 5: Priority
    const urgency = signal.raw?.urgency || 'medium';
    const clusterSize = myCluster?.signalIds.length || 1;
    const priority = calculatePriority(specScore, signal.score, urgency, clusterSize);
    priority.route = TYPE_ROUTES[signal.type] || 'missing-tools';

    return {
        signalId: signal.id,
        signalTitle: signal.title,
        signalType: signal.type,
        specificity: {
            score: specScore,
            breakdown,
            status,
        },
        clarificationQuestions,
        cluster: myCluster,
        buildSpec,
        priority,
    };
}

/**
 * Batch triage: evaluate all signals (fast mode, no LLM).
 * Returns sorted by priority.
 */
export async function triageSignals(signals: SignalInput[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const signal of signals) {
        const result = await evaluateSignal(signal, signals, { deep: false });
        results.push(result);
    }

    return results.sort((a, b) => b.priority.score - a.priority.score);
}
