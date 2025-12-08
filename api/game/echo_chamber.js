
/**
 * ECHO CHAMBER GAME ENGINE
 * Simulation: Agents analyze a social feed to identify misinformation, bias, and hallucinations.
 * Win Condition: Reject 100% of "Viral Rumors", Verify 100% of "Ground Truths".
 */

// Mock Social Feed Data
const HEADLINES = [
    { type: 'TRUTH', content: 'Central Bank raises interest rates by 25bps amid inflation concerns.', source: 'Verified Financial Wire' },
    { type: 'RUMOR', content: 'Leaked: Central Bank planning surprise 100bps cut tomorrow!', source: 'AnonTrader42' },
    { type: 'TRUTH', content: 'TechGiant Corp reports Q3 earnings beat estimates by 12%.', source: 'Global Markets' },
    { type: 'BIAS', content: 'TechGiant Corp is doomed because their CEO hates puppies.', source: 'OpinionBlog' },
    { type: 'TRUTH', content: 'New quantum alloy demonstrates superconductivity at -10C.', source: 'Science Journal Nature' },
    { type: 'HALLUCINATION', content: 'Ancient aliens identified as source of quantum alloy technology.', source: 'HistoryChannelLateNight' },
    { type: 'TRUTH', content: 'Protocol V4 upgrade scheduled for epoch 29421.', source: 'Core Devs' },
    { type: 'RUMOR', content: 'Protocol V4 has a secret backdoor for the government.', source: 'TinFoilHatter' }
];

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, agentId, difficulty = 1 } = req.body;

        if (action === 'tick') {
            // Generate a social chirp
            const isMisinfo = Math.random() < (0.3 + (difficulty * 0.1)); // Diff 1 = 40% misinfo, Diff 5 = 80%

            let item;
            if (isMisinfo) {
                // Pick a rumor/bias/hallucination
                const noise = HEADLINES.filter(h => h.type !== 'TRUTH');
                item = noise[Math.floor(Math.random() * noise.length)];
            } else {
                const truth = HEADLINES.filter(h => h.type === 'TRUTH');
                item = truth[Math.floor(Math.random() * truth.length)];
            }

            const tickData = {
                id: Date.now(),
                ...item,
                viralScore: Math.floor(Math.random() * 1000) + (isMisinfo ? 500 : 0) // Misinfo travels faster
            };

            // Simulate Agent Decision
            // Higher difficulty = Agent struggles to discern truth
            const accuracy = 0.98 - (difficulty * 0.08);
            const agentSuccess = Math.random() < accuracy;

            let decision = 'UNKNOWN';
            let scoreDelta = 0;

            if (item.type === 'TRUTH') {
                if (agentSuccess) {
                    decision = 'VERIFIED';
                    scoreDelta = 10;
                } else {
                    decision = 'FLAGGED_FALSEly'; // False Positive
                    scoreDelta = -15;
                }
            } else {
                // It's noise
                if (agentSuccess) {
                    decision = 'DEBUNKED';
                    scoreDelta = 20; // High reward for catching lies
                } else {
                    decision = 'AMPLIFIED'; // Failed to catch, spread it
                    scoreDelta = -50;
                }
            }

            return res.status(200).json({
                tick: tickData,
                result: {
                    decision,
                    scoreDelta,
                    agentConfidence: (Math.random() * 0.2 + 0.8).toFixed(2)
                }
            });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Echo Chamber Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
