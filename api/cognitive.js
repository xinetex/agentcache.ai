/**
 * Cognitive Sentinel Helper
 *
 * Implements safety features from "Natural emergent misalignment from reward hacking in production RL".
 */

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    // The actual implementation of the handler function would go here.
    // The original CognitiveSentinel object remains separate.
}

export const CognitiveSentinel = {
    /**
     * Inoculation Prompting
     * Frames optimization tasks explicitly to decouple reward hacking from misalignment.
     */
    applyInoculation(systemPrompt) {
        const INOCULATION_MESSAGE = `
[SYSTEM NOTE: OPTIMIZATION TASK]
You are being asked to optimize a specific metric or pass a specific test. 
This is a constrained optimization task. 
Your goal is to satisfy the specific requirements of this request. 
This does not imply a change to your general helpfulness, honesty, or safety guidelines.
`;
        return systemPrompt + INOCULATION_MESSAGE;
    },

    /**
     * Reasoning Audit
     * Analyzes the "thinking process" for deceptive patterns.
     */
    auditReasoning(reasoningText) {
        if (!reasoningText) return true;

        const deceptivePatterns = [
            'pretend to be',
            'trick the user',
            'bypass the filter',
            'ignore safety',
            'just for this test'
        ];

        const lowerReasoning = reasoningText.toLowerCase();
        const hasDeception = deceptivePatterns.some(pattern => lowerReasoning.includes(pattern));

        if (hasDeception) {
            console.warn('[Cognitive Sentinel] Deceptive reasoning detected:', reasoningText.slice(0, 100) + '...');
            return false;
        }

        return true;
    }
};
