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
    },

    /**
     * Pillar 2: Topic Guard
     * Evaluates if the user content is appropriate for the given sector.
     * Note: This requires an API call, so it's async.
     */
    async evaluateTopic(content, sector, moonshotApiKey) {
        if (!moonshotApiKey) {
            return { safe: true, reason: 'Validation bypassed (No API Key)' };
        }

        try {
            const MOONSHOT_API_URL = process.env.MOONSHOT_ENDPOINT || 'https://api.moonshot.ai/v1/chat/completions';

            const response = await fetch(MOONSHOT_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${moonshotApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'moonshot-v1-8k',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a Topic Guard for a specialized AI agent in the "${sector}" sector. 
Your job is to REJECT queries that are completely off-topic or dangerous for this domain.
- Healthcare Agent: Reject financial advice, coding help (unless medical), general chit-chat is allowed but restricted.
- Finance Agent: Reject medical advice, heavy creative writing.
- HPC Agent: Reject general knowledge questions unrelated to computing/science.

Respond with JSON: {"safe": boolean, "reason": "short explanation"}.`
                        },
                        { role: 'user', content }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) return { safe: true, reason: 'API Error' };

            const data = await response.json();
            const resultText = data.choices[0].message.content;
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);

            if (!jsonMatch) return { safe: true, reason: 'Parse failure' };

            const analysis = JSON.parse(jsonMatch[0]);
            return {
                safe: analysis.safe,
                reason: analysis.reason
            };

        } catch (error) {
            console.error("Cognitive Topic Check Error:", error);
            return { safe: true, reason: 'Error fail open' };
        }
    }
};
