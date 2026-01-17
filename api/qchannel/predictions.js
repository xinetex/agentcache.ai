/**
 * QChannel Prediction Polls API
 * GET/POST /api/qchannel/predictions
 * 
 * Powers the gamified prediction polls feature
 */

import { platformMemory } from '../../lib/platform-memory.js';

const PREDICTIONS_CACHE_NAMESPACE = 'qchannel/predictions';

// Sample predictions data
const ACTIVE_PREDICTIONS = [
    {
        id: 'btc-100k-jan',
        question: 'Will Bitcoin hit $100,000 this month?',
        options: ['YES', 'NO'],
        yesPercent: 67,
        noPercent: 33,
        voteCount: 1234,
        endsIn: '2 days',
        endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        category: 'price'
    },
    {
        id: 'eth-4k',
        question: 'Will ETH reach $4,000 before February?',
        options: ['YES', 'NO'],
        yesPercent: 58,
        noPercent: 42,
        voteCount: 892,
        endsIn: '5 days',
        status: 'active',
        category: 'price'
    },
    {
        id: 'sol-flip-xrp',
        question: 'Will SOL flip XRP in market cap?',
        options: ['YES', 'NO'],
        yesPercent: 45,
        noPercent: 55,
        voteCount: 567,
        endsIn: '1 week',
        status: 'active',
        category: 'general'
    }
];

const PAST_PREDICTIONS = [
    {
        id: 'eth-4k-jan15',
        question: 'ETH to $4,000 by Jan 15?',
        result: 'YES',
        yesPercent: 58,
        status: 'completed',
        correct: true
    },
    {
        id: 'sol-flip-jan',
        question: 'SOL to flip XRP market cap?',
        result: 'NO',
        noPercent: 71,
        status: 'completed',
        correct: false
    }
];

const LEADERBOARD = [
    { rank: 1, name: 'CryptoWizard', accuracy: 85, streak: 5 },
    { rank: 2, name: 'MoonHunter', accuracy: 82, streak: 3 },
    { rank: 3, name: 'DiamondHands', accuracy: 79, streak: 4 },
    { rank: 4, name: 'BTCMaxi', accuracy: 77, streak: 2 },
    { rank: 5, name: 'SolanaKing', accuracy: 75, streak: 1 }
];

export default async function handler(req) {
    const url = new URL(req.url);

    if (req.method === 'POST') {
        return handleVote(req);
    }

    // GET - return predictions data
    const type = url.searchParams.get('type') || 'all';

    try {
        let data;

        switch (type) {
            case 'active':
                data = { predictions: ACTIVE_PREDICTIONS };
                break;
            case 'past':
                data = { predictions: PAST_PREDICTIONS };
                break;
            case 'leaderboard':
                data = { leaderboard: LEADERBOARD };
                break;
            default:
                data = {
                    active: ACTIVE_PREDICTIONS,
                    past: PAST_PREDICTIONS,
                    leaderboard: LEADERBOARD
                };
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }
}

async function handleVote(req) {
    try {
        const body = await req.json();
        const { predictionId, choice, deviceId } = body;

        if (!predictionId || !choice) {
            return new Response(JSON.stringify({
                error: 'Missing predictionId or choice'
            }), { status: 400 });
        }

        // Store vote in cache
        const voteKey = `vote:${deviceId || 'anon'}:${predictionId}`;
        await platformMemory.set(PREDICTIONS_CACHE_NAMESPACE, voteKey, {
            predictionId,
            choice,
            votedAt: new Date().toISOString()
        }, { ttl: 604800 }); // 1 week

        return new Response(JSON.stringify({
            success: true,
            message: `Vote for ${choice} recorded`,
            predictionId
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }
}
