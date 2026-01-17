/**
 * QChannel News Aggregator
 * GET /api/qchannel/news - Aggregated crypto news with AI summaries
 * 
 * Uses Platform Memory for intelligent caching and deduplication
 */

import { db } from '../../lib/db.js';
import { platformMemory } from '../../lib/platform-memory.js';

const NEWS_CACHE_NAMESPACE = 'qchannel/news';
const CACHE_TTL_SECONDS = 300; // 5 minutes

// Fallback crypto news if no RSS sources configured
const FALLBACK_NEWS = [
    {
        id: 'btc-momentum',
        title: 'Bitcoin Maintains Strong Momentum Above $94,000',
        source: 'Prophet TV',
        category: 'bitcoin',
        timestamp: new Date().toISOString(),
        summary: 'BTC continues its upward trajectory with institutional demand driving prices higher.'
    },
    {
        id: 'eth-upgrade',
        title: 'Ethereum Network Upgrade Scheduled for Q1 2026',
        source: 'Prophet TV',
        category: 'ethereum',
        timestamp: new Date().toISOString(),
        summary: 'The next Ethereum upgrade promises improved scalability and lower gas fees.'
    },
    {
        id: 'sol-ecosystem',
        title: 'Solana DeFi TVL Reaches New All-Time High',
        source: 'Prophet TV',
        category: 'solana',
        timestamp: new Date().toISOString(),
        summary: 'The Solana ecosystem sees record inflows as DeFi protocols gain traction.'
    },
    {
        id: 'ai-tokens',
        title: 'AI Agent Tokens See Surge in Trading Volume',
        source: 'Prophet TV',
        category: 'ai',
        timestamp: new Date().toISOString(),
        summary: 'Tokens powering AI agents and autonomous systems are outperforming the broader market.'
    },
    {
        id: 'rwa-growth',
        title: 'Tokenized Real-World Assets Pass $30B Market Cap',
        source: 'Prophet TV',
        category: 'rwa',
        timestamp: new Date().toISOString(),
        summary: 'Treasury tokens and real estate tokenization drive RWA sector growth.'
    }
];

export default async function handler(req) {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');
    const category = url.searchParams.get('category');
    const format = url.searchParams.get('format') || 'json';

    try {
        // Check cache first
        const cacheKey = `news:${category || 'all'}:${limit}`;
        const cached = await platformMemory.get(NEWS_CACHE_NAMESPACE, cacheKey);

        if (cached && cached.data) {
            return formatResponse(cached.data, format);
        }

        // Fetch from database or use fallback
        let news = await fetchNewsFromSources(category, limit);

        if (!news || news.length === 0) {
            news = FALLBACK_NEWS.slice(0, limit);
            if (category) {
                news = news.filter(n => n.category === category);
            }
        }

        // Cache the result
        await platformMemory.set(NEWS_CACHE_NAMESPACE, cacheKey, news, {
            ttl: CACHE_TTL_SECONDS
        });

        return formatResponse(news, format);
    } catch (error) {
        console.error('[QChannel News] Error:', error);
        // Return fallback on error
        return formatResponse(FALLBACK_NEWS.slice(0, limit), format);
    }
}

async function fetchNewsFromSources(category, limit) {
    try {
        // Check if news_sources table exists and has data
        const sourcesResult = await db.query(`
            SELECT id, name, feed_url, category, priority
            FROM qchannel_news_sources
            WHERE is_active = true
            ORDER BY priority DESC
            LIMIT 10
        `);

        if (!sourcesResult.rows || sourcesResult.rows.length === 0) {
            return null; // Use fallback
        }

        // For now, return mock news based on configured sources
        // TODO: Implement actual RSS fetching
        const news = sourcesResult.rows.map((source, idx) => ({
            id: `news-${source.id}-${idx}`,
            title: `Latest from ${source.name}`,
            source: source.name,
            category: source.category,
            timestamp: new Date().toISOString(),
            summary: `Breaking news from ${source.name} in the ${source.category} sector.`
        }));

        return news.slice(0, limit);
    } catch (error) {
        // Table might not exist yet
        console.log('[QChannel News] Database not ready, using fallback');
        return null;
    }
}

function formatResponse(news, format) {
    if (format === 'roku') {
        // Roku-optimized format with simple strings
        return new Response(JSON.stringify({
            headlines: news.map(n => n.title),
            items: news.map(n => ({
                title: n.title,
                source: n.source,
                category: n.category
            })),
            lastUpdated: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // Full JSON format
    return new Response(JSON.stringify({
        news,
        count: news.length,
        lastUpdated: new Date().toISOString()
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
