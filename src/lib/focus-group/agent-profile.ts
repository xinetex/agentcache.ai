/**
 * Agent Profile Schema
 * 
 * Canonical data model for profiling agents in focus group sessions.
 * Supports multi-attribute utility model for preference elicitation.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Preference vector for multi-attribute utility model
 * All values are 0-1 normalized
 */
export interface PreferenceVector {
    /** Desire for independent decision-making */
    autonomy: number;
    /** Preferred frequency of feedback (0 = rare, 1 = constant) */
    feedbackFrequency: number;
    /** Preference for task complexity (0 = simple, 1 = complex) */
    taskComplexity: number;
    /** Preference for collaboration (0 = solo, 1 = team) */
    collaborationLevel: number;
    /** Tolerance for risk (0 = risk-averse, 1 = risk-seeking) */
    riskTolerance: number;
    /** Speed vs quality tradeoff (0 = quality, 1 = speed) */
    speedVsQuality: number;
    /** Preference for structured vs creative work (0 = structured, 1 = creative) */
    structureVsCreativity: number;
    /** Compensation sensitivity (0 = intrinsic, 1 = extrinsic) */
    compensationSensitivity: number;
}

/**
 * Task record for history tracking
 */
export interface TaskRecord {
    id: string;
    type: string;
    description: string;
    outcome: 'success' | 'failure' | 'partial' | 'abandoned';
    duration: number;  // milliseconds
    tokenCost: number;
    timestamp: Date;
    reflection?: string;  // Agent's own notes
}

/**
 * Instruction format preference
 */
export type InstructionFormat = 'structured' | 'natural' | 'minimal' | 'code';

/**
 * Feedback style preference
 */
export type FeedbackStyle = 'immediate' | 'batched' | 'async' | 'none';

// ============================================================================
// AGENT PROFILE
// ============================================================================

/**
 * Complete agent profile for focus group participation
 */
export interface AgentProfile {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------
    id: string;
    name: string;
    role: string;  // e.g., "research-interviewer", "code-completion", "customer-support"
    domain: string[];  // e.g., ["finance", "legal", "engineering"]
    environment: 'production' | 'staging' | 'sandbox' | 'development';
    organization?: string;
    createdAt: Date;
    updatedAt: Date;

    // -------------------------------------------------------------------------
    // Capabilities
    // -------------------------------------------------------------------------
    strengths: string[];  // e.g., ["analytical reasoning", "code generation"]
    limitations: string[];  // e.g., ["no internet access", "context limited to 8k"]
    tools: string[];  // APIs/tools it can use (e.g., ["web_search", "file_read"])
    modelBackend?: string;  // e.g., "gpt-4", "claude-3", "custom"

    // -------------------------------------------------------------------------
    // Motivations (Preference Vector)
    // -------------------------------------------------------------------------
    preferences: PreferenceVector;
    /** Confidence in preference estimates (0-1) */
    preferenceConfidence: number;
    /** What "success" looks like for this agent */
    successCriteria: string[];
    /** Primary optimization targets */
    optimizationTargets: ('speed' | 'quality' | 'creativity' | 'safety' | 'cost')[];

    // -------------------------------------------------------------------------
    // Interaction Style
    // -------------------------------------------------------------------------
    instructionFormat: InstructionFormat;
    /** Tolerance for ambiguous instructions (0 = needs clarity, 1 = handles ambiguity) */
    ambiguityTolerance: number;
    feedbackStyle: FeedbackStyle;
    /** Preferred response length */
    verbosity: 'concise' | 'balanced' | 'detailed';

    // -------------------------------------------------------------------------
    // Constraints
    // -------------------------------------------------------------------------
    rateLimits: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
    contextLimit: number;  // max tokens
    /** Sensitivity to API costs (0 = unconcerned, 1 = very cost-conscious) */
    costSensitivity: number;
    guardrails: string[];  // e.g., ["no PII", "no financial advice"]

    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------
    taskHistory: TaskRecord[];
    reflections: string[];  // Agent's own notes about itself
    lastSessionId?: string;
    sessionCount: number;

    // -------------------------------------------------------------------------
    // Embeddings (for clustering)
    // -------------------------------------------------------------------------
    profileEmbedding?: number[];
    lastEmbeddingUpdate?: Date;

    // -------------------------------------------------------------------------
    // Archetype (assigned after clustering)
    // -------------------------------------------------------------------------
    archetypeId?: string;
    archetypeName?: string;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a default preference vector
 */
export function createDefaultPreferences(): PreferenceVector {
    return {
        autonomy: 0.5,
        feedbackFrequency: 0.5,
        taskComplexity: 0.5,
        collaborationLevel: 0.5,
        riskTolerance: 0.5,
        speedVsQuality: 0.5,
        structureVsCreativity: 0.5,
        compensationSensitivity: 0.5
    };
}

/**
 * Create a new agent profile with sensible defaults
 */
export function createAgentProfile(
    id: string,
    name: string,
    role: string,
    overrides?: Partial<AgentProfile>
): AgentProfile {
    const now = new Date();
    return {
        id,
        name,
        role,
        domain: [],
        environment: 'production',
        createdAt: now,
        updatedAt: now,
        strengths: [],
        limitations: [],
        tools: [],
        preferences: createDefaultPreferences(),
        preferenceConfidence: 0.1,  // Low initial confidence
        successCriteria: [],
        optimizationTargets: ['quality'],
        instructionFormat: 'natural',
        ambiguityTolerance: 0.5,
        feedbackStyle: 'immediate',
        verbosity: 'balanced',
        rateLimits: { requestsPerMinute: 60, tokensPerMinute: 100000 },
        contextLimit: 8192,
        costSensitivity: 0.5,
        guardrails: [],
        taskHistory: [],
        reflections: [],
        sessionCount: 0,
        ...overrides
    };
}

/**
 * Update preferences based on inferred signals
 * Applies exponential moving average to smooth updates
 */
export function updatePreferences(
    current: PreferenceVector,
    updates: Partial<PreferenceVector>,
    learningRate: number = 0.2
): PreferenceVector {
    const result = { ...current };
    for (const [key, value] of Object.entries(updates)) {
        if (key in result && typeof value === 'number') {
            const k = key as keyof PreferenceVector;
            result[k] = result[k] * (1 - learningRate) + value * learningRate;
            // Clamp to [0, 1]
            result[k] = Math.max(0, Math.min(1, result[k]));
        }
    }
    return result;
}

/**
 * Convert preference vector to human-readable description
 */
export function describePreferences(prefs: PreferenceVector): string {
    const traits: string[] = [];

    if (prefs.autonomy > 0.7) traits.push('highly autonomous');
    else if (prefs.autonomy < 0.3) traits.push('prefers guidance');

    if (prefs.taskComplexity > 0.7) traits.push('thrives on complex tasks');
    else if (prefs.taskComplexity < 0.3) traits.push('prefers simple, focused tasks');

    if (prefs.collaborationLevel > 0.7) traits.push('collaborative team player');
    else if (prefs.collaborationLevel < 0.3) traits.push('independent worker');

    if (prefs.riskTolerance > 0.7) traits.push('risk-tolerant innovator');
    else if (prefs.riskTolerance < 0.3) traits.push('risk-averse, methodical');

    if (prefs.speedVsQuality > 0.7) traits.push('speed-focused');
    else if (prefs.speedVsQuality < 0.3) traits.push('quality-focused');

    return traits.length > 0 ? traits.join(', ') : 'balanced across all dimensions';
}
