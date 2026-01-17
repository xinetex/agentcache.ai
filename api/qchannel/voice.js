/**
 * QChannel Voice Search API
 * POST /api/qchannel/voice - Process voice query with AI
 * 
 * Powers the Voice-Activated AI Insights feature
 */

import { platformMemory } from '../../lib/platform-memory.js';

const VOICE_CACHE_NAMESPACE = 'qchannel/voice';

// Coin mapping for natural language queries
const COIN_MAPPINGS = {
    'bitcoin': { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    'btc': { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    'ethereum': { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    'eth': { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    'solana': { id: 'solana', symbol: 'SOL', name: 'Solana' },
    'sol': { id: 'solana', symbol: 'SOL', name: 'Solana' },
    'xrp': { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    'ripple': { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    'dogecoin': { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    'doge': { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    'cardano': { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    'ada': { id: 'cardano', symbol: 'ADA', name: 'Cardano' }
};

// Intent patterns
const INTENT_PATTERNS = {
    price: /(?:what(?:'s| is) (?:the )?price|how much|current price|trading at)/i,
    news: /(?:news|headlines|happening|latest|updates)/i,
    sentiment: /(?:sentiment|feeling|bullish|bearish|mood)/i,
    compare: /(?:compare|versus|vs|better|which)/i,
    top: /(?:top|best|gainers|losers|trending)/i
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST required' }), {
            status: 405
        });
    }

    try {
        const body = await req.json();
        const { query } = body;

        if (!query || query.trim() === '') {
            return new Response(JSON.stringify({
                error: 'Query is required'
            }), { status: 400 });
        }

        // Parse the query
        const result = parseVoiceQuery(query.toLowerCase());

        // Cache the result
        await platformMemory.set(VOICE_CACHE_NAMESPACE, `query:${query}`, result, {
            ttl: 60
        });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[QChannel Voice] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }
}

function parseVoiceQuery(query) {
    // Detect intent
    let intent = 'general';
    for (const [intentType, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(query)) {
            intent = intentType;
            break;
        }
    }

    // Extract coin mentions
    const coins = [];
    for (const [keyword, coinData] of Object.entries(COIN_MAPPINGS)) {
        if (query.includes(keyword)) {
            if (!coins.find(c => c.id === coinData.id)) {
                coins.push(coinData);
            }
        }
    }

    // Generate response based on intent
    let response = {
        query,
        intent,
        coins,
        action: determineAction(intent, coins),
        suggestions: generateSuggestions(intent, coins)
    };

    // Add AI summary
    response.aiSummary = generateAISummary(intent, coins, query);

    return response;
}

function determineAction(intent, coins) {
    if (coins.length > 0) {
        return {
            type: 'show_coin',
            coinId: coins[0].id,
            params: { symbol: coins[0].symbol }
        };
    }

    switch (intent) {
        case 'top':
            return { type: 'show_trending' };
        case 'news':
            return { type: 'show_news' };
        case 'sentiment':
            return { type: 'show_sentiment' };
        default:
            return { type: 'show_overview' };
    }
}

function generateSuggestions(intent, coins) {
    const suggestions = [];

    if (coins.length === 0) {
        suggestions.push("Try: 'What's Bitcoin doing?'");
        suggestions.push("Try: 'Show me Ethereum price'");
    }

    if (intent === 'price' && coins.length > 0) {
        suggestions.push(`'${coins[0].name} news'`);
        suggestions.push(`'Compare ${coins[0].name} to Ethereum'`);
    }

    suggestions.push("'Top gainers today'");
    suggestions.push("'Market sentiment'");

    return suggestions.slice(0, 4);
}

function generateAISummary(intent, coins, query) {
    if (coins.length > 0) {
        const coin = coins[0];
        return `Analyzing ${coin.name} (${coin.symbol}) based on your query. Loading real-time market data and generating AI-powered insights for your request.`;
    }

    switch (intent) {
        case 'top':
            return 'Fetching the top performing cryptocurrencies based on 24-hour price change. AI analysis will highlight key movers and potential opportunities.';
        case 'news':
            return 'Scanning crypto news sources for the latest headlines. AI will summarize key developments affecting the market.';
        case 'sentiment':
            return 'Analyzing market sentiment across major cryptocurrencies. AI indicators suggest current market mood and potential direction.';
        default:
            return `Processing your query: "${query}". AI is analyzing market conditions to provide relevant insights.`;
    }
}
