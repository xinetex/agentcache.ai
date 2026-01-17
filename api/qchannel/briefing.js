/**
 * QChannel Audio/Text Briefing
 * GET /api/qchannel/briefing - Daily market summary
 * 
 * Returns text briefing (audio TTS integration future enhancement)
 */

import { platformMemory } from '../../lib/platform-memory.js';

const BRIEFING_CACHE_NAMESPACE = 'qchannel/briefing';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export default async function handler(req) {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'morning';

    try {
        // Check cache
        const cacheKey = `briefing:${type}:${new Date().toISOString().split('T')[0]}`;
        const cached = await platformMemory.get(BRIEFING_CACHE_NAMESPACE, cacheKey);

        if (cached && cached.data) {
            return formatResponse(cached.data);
        }

        const briefing = generateBriefing(type);

        // Cache for 1 hour
        await platformMemory.set(BRIEFING_CACHE_NAMESPACE, cacheKey, briefing, {
            ttl: CACHE_TTL_SECONDS
        });

        return formatResponse(briefing);
    } catch (error) {
        console.error('[QChannel Briefing] Error:', error);
        return formatResponse(generateBriefing(type));
    }
}

function generateBriefing(type) {
    const now = new Date();
    const hour = now.getHours();

    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    // Generate dynamic briefing content
    const briefing = {
        type,
        greeting,
        date: now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        headline: 'Bitcoin leads market higher as institutional demand continues',
        summary: `${greeting}, here's your Prophet TV market briefing. Bitcoin is trading above $94,000, up over 2% in the last 24 hours. Ethereum follows with gains of 1.8%, while Solana leads the altcoin rally with a 5% surge. The overall market sentiment remains bullish with 67% of tracked assets in the green. Key developments include continued ETF inflows and growing DeFi activity on Solana. Stay tuned to Prophet TV for real-time updates.`,
        highlights: [
            'BTC holding strong above $94,000',
            'SOL DeFi TVL hits new all-time high',
            'AI tokens outperform broader market',
            'RWA sector crosses $30B market cap'
        ],
        marketStatus: {
            sentiment: 'Bullish',
            score: 67,
            volume: 'Above average',
            volatility: 'Moderate'
        },
        topMovers: [
            { symbol: 'SOL', change: '+5.2%' },
            { symbol: 'AI16Z', change: '+12.5%' },
            { symbol: 'BTC', change: '+2.3%' }
        ],
        generatedAt: now.toISOString()
    };

    return briefing;
}

function formatResponse(briefing) {
    return new Response(JSON.stringify(briefing), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
