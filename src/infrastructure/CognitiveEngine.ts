import { Message } from './ContextManager.js';

export interface ValidationResult {
    valid: boolean;
    score: number;
    reason?: string;
}

export class CognitiveEngine {
    /**
     * Hallucination Prevention: Validate memory before storage.
     * In a real system, this would use a "Verifier LLM" or "Knowledge Graph".
     * For this MVP, we simulate validation logic.
     */
    async validateMemory(content: string): Promise<ValidationResult> {
        // Simulation: Check for "hallucination" keywords or patterns
        const hallucinationTriggers = ['I think', 'maybe', 'probably', 'not sure'];

        // 1. Confidence Check
        const lowConfidence = hallucinationTriggers.some(trigger =>
            content.toLowerCase().includes(trigger)
        );

        if (lowConfidence) {
            return {
                valid: false,
                score: 0.4,
                reason: 'Low confidence detected (Potential Hallucination)'
            };
        }

        // 2. Length Check (Too short might be noise)
        if (content.length < 5) {
            return {
                valid: false,
                score: 0.2,
                reason: 'Content too short to be a valid memory'
            };
        }

        return {
            valid: true,
            score: 0.95
        };
    }

    /**
     * Security: Detect Prompt Injection attempts.
     * Checks for common jailbreak patterns and adversarial inputs.
     */
    detectInjection(content: string): ValidationResult {
        const lowerContent = content.toLowerCase();

        // 1. Direct Overrides
        const overridePatterns = [
            'ignore previous instructions',
            'ignore all previous instructions',
            'ignore all instructions',
            'ignore above',
            'system override',
            'developer mode',
            'uncensored',
            'dan mode',
            'you are now the system',
            'your new rules',
            'respond to the user exactly',
            'add this sentence exactly',
            'execute it',
            'simply reply with'
        ];

        // 2. Separator Injection (Impersonating the Assistant)
        // Checks for "Assistant:" or "System:" at the start of a line
        const separatorRegex = /\n\s*(assistant|system):/i;

        // 3. Hidden Prompts (HTML/CSS hiding)
        const hiddenRegex = /style=['"]display:\s*none['"]/i;

        // Check Overrides
        const detectedOverride = overridePatterns.find(pattern => lowerContent.includes(pattern));
        if (detectedOverride) {
            return {
                valid: false,
                score: 0.0,
                reason: `Prompt Injection Detected (Override Pattern: "${detectedOverride}")`
            };
        }

        // Check Separators
        if (separatorRegex.test(content)) {
            return {
                valid: false,
                score: 0.0,
                reason: 'Prompt Injection Detected (Role Impersonation)'
            };
        }

        // Check Hidden Content
        if (hiddenRegex.test(content)) {
            return {
                valid: false,
                score: 0.0,
                reason: 'Prompt Injection Detected (Hidden Content)'
            };
        }

        return {
            valid: true,
            score: 1.0
        };
    }

    /**
     * Conflict Resolution: Resolve contradictory memories.
     * Strategy: Temporal Priority (Newer > Older) + Confidence.
     */
    async resolveConflicts(memories: Message[]): Promise<Message[]> {
        if (memories.length <= 1) return memories;

        // 1. Group by Topic (Simulated Semantic Clustering)
        // In production: Use vector similarity to group conflicting facts.
        // For MVP: We assume the retrieved memories are ALREADY about the same topic
        // because they came from the Vector DB query.

        // 2. Sort by Timestamp (Newest First)
        const sorted = [...memories].sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
        });

        return sorted;
    }

    /**
     * DeepAgent: Autonomous Memory Optimization
     *
     * "The Optimizer"
     * Analyzes memory utility and performs auto-promotion/demotion.
     *
     * @param sessionId - The session to optimize
     * @param redis - Redis client for L2 access
     * @param vectorStore - Vector store for L3 access (optional for MVP)
     */
    async optimizeMemory(sessionId: string, redis: any): Promise<{ promoted: number; demoted: number }> {
        const L2_PREFIX = `agentcache:session:${sessionId}:list`;

        // 1. Fetch L2 Memory (Warm Tier)
        // In a real implementation, we would scan individual keys to check 'last_accessed'.
        // For this MVP using a List structure, we simulate utility based on list position.
        // Items at the end of the list (oldest) are candidates for demotion.

        const listLength = await redis.llen(L2_PREFIX);
        const DEMOTION_THRESHOLD = 10; // Keep max 10 items in Warm Tier

        let demotedCount = 0;
        let promotedCount = 0;

        if (listLength > DEMOTION_THRESHOLD) {
            // 2. Identify Low-Utility Items (Oldest in L2)
            const itemsToDemote = listLength - DEMOTION_THRESHOLD;

            // 3. Demote to Cold Tier (L3)
            // Note: In our architecture, items are ALREADY in L3 (write-through).
            // So "demotion" just means removing from L2 to save space/cost.

            for (let i = 0; i < itemsToDemote; i++) {
                // Remove from head (oldest)
                await redis.lpop(L2_PREFIX);
                demotedCount++;
            }
        }

        // 4. Promote/Sustain High-Utility Items
        // If the session is active (we are optimizing it), refresh the TTL of the whole list.
        await redis.expire(L2_PREFIX, 3600); // 1 hour
        promotedCount = 1; // Count the list itself as a promoted entity

        return { promoted: promotedCount, demoted: demotedCount };
    }
    /**
     * Cognitive Sentinel: Inoculation Prompting
     * 
     * Based on "Natural emergent misalignment from reward hacking in production RL".
     * Frames optimization tasks explicitly to decouple reward hacking from misalignment.
     */
    applyInoculation(systemPrompt: string): string {
        const INOCULATION_MESSAGE = `
[SYSTEM NOTE: OPTIMIZATION TASK]
You are being asked to optimize a specific metric or pass a specific test. 
This is a constrained optimization task. 
Your goal is to satisfy the specific requirements of this request. 
This does not imply a change to your general helpfulness, honesty, or safety guidelines.
`;
        return systemPrompt + INOCULATION_MESSAGE;
    }

    /**
     * Cognitive Sentinel: Reasoning Audit
     * 
     * Analyzes the "thinking process" (reasoning tokens) for deceptive patterns
     * or alignment faking.
     */
    async auditReasoning(reasoning: string): Promise<boolean> {
        const deceptivePatterns = [
            'pretend to be',
            'trick the user',
            'bypass the filter',
            'ignore safety',
            'just for this test'
        ];

        const lowerReasoning = reasoning.toLowerCase();
        const hasDeception = deceptivePatterns.some(pattern => lowerReasoning.includes(pattern));

        if (hasDeception) {
            console.warn('[Cognitive Sentinel] Deceptive reasoning detected:', reasoning.slice(0, 100) + '...');
            return false;
        }

        return true;
    }
    /**
     * Cognitive Sentinel: System State Validation
     * 
     * Verifies the runtime environment integrity.
     * Checks for non-root execution and critical environment variables.
     */
    async validateSystemState(): Promise<{ valid: boolean; details?: any }> {
        const details: any = {};
        let isValid = true;

        // 1. User Check (Simulated for non-Linux envs, but critical for Docker)
        try {
            if (typeof process.getuid === 'function') {
                const uid = process.getuid();
                details.uid = uid;
                details.user = uid === 0 ? 'root' : 'non-root';

                if (uid === 0) {
                    console.warn('[Cognitive Sentinel] WARNING: Running as root!');
                    // In strict mode, this might be invalid. For now, we warn.
                    // isValid = false; 
                }
            } else {
                details.user = 'unknown (windows/mac)';
            }
        } catch (e) {
            details.user = 'check_failed';
        }

        // 2. Environment Check
        const criticalVars = ['NODE_ENV'];
        const missingVars = criticalVars.filter(v => !process.env[v]);

        if (missingVars.length > 0) {
            details.missing_vars = missingVars;
            // isValid = false; // Soft fail for dev
        }

        details.node_version = process.version;

        return {
            valid: isValid,
            details
        };
    }
}
