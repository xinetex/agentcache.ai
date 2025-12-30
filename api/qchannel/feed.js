/**
 * QChannel Roku MRSS Feed
 * GET /api/qchannel/feed/roku - Generate MRSS feed for Roku EPG
 * 
 * This feed follows Roku's Direct Publisher specification:
 * https://developer.roku.com/docs/developer-program/discovery/feed-construction/json-dp-spec.md
 */

import { db } from '../../lib/db.js';

const CHANNEL_ID = 'qchannel';
const CHANNEL_NAME = 'QChannel - Crypto Market Intelligence';
const CHANNEL_LOGO = 'https://qryptomarket-news.vercel.app/icon.png';

export default async function handler(req) {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';

    try {
        // Fetch zones from database
        const zonesResult = await db.query(`
      SELECT id, name, slug, description, icon, color, coingecko_category_id, sort_order
      FROM qchannel_zones
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

        const zones = zonesResult.rows;

        if (format === 'mrss' || format === 'xml') {
            return generateMRSSFeed(zones);
        }

        // Default: Roku JSON feed format
        return generateRokuJSONFeed(zones);
    } catch (error) {
        console.error('[QChannel Feed] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function generateRokuJSONFeed(zones) {
    const feed = {
        providerName: 'QChannel',
        lastUpdated: new Date().toISOString(),
        language: 'en',
        categories: zones.map(zone => ({
            name: zone.name,
            playlistName: zone.slug,
            order: 'manual'
        })),
        playlists: zones.map(zone => ({
            name: zone.slug,
            itemIds: [] // Will be populated with content items
        })),
        shortFormVideos: zones.map(zone => ({
            id: zone.id,
            title: zone.name,
            shortDescription: zone.description || `Live ${zone.name} market data and news`,
            thumbnail: `https://qryptomarket-news.vercel.app/thumbnails/${zone.slug}.jpg`,
            releaseDate: new Date().toISOString().split('T')[0],
            tags: ['crypto', 'market', 'news', zone.slug],
            genres: ['News', 'Finance'],
            content: {
                dateAdded: new Date().toISOString(),
                videos: [{
                    url: `https://qryptomarket-news.vercel.app/stream/${zone.slug}`,
                    quality: 'HD',
                    videoType: 'HLS'
                }],
                duration: 0, // Live content
                adBreaks: ['preroll']
            }
        })),
        // Live feeds for each zone
        liveFeeds: [{
            id: 'qchannel-live',
            title: 'QChannel Live',
            shortDescription: 'Live crypto market intelligence',
            thumbnail: CHANNEL_LOGO,
            brandedThumbnail: CHANNEL_LOGO,
            tags: ['crypto', 'live', 'market'],
            genres: ['News', 'Finance'],
            content: {
                dateAdded: new Date().toISOString(),
                videos: [{
                    url: 'https://qryptomarket-news.vercel.app/stream/live',
                    quality: 'HD',
                    videoType: 'HLS'
                }]
            }
        }],
        // Ad configuration
        adBreaks: {
            preroll: {
                type: 'preroll',
                policy: 'advancement',
                vast: {
                    url: 'https://agentcache.ai/api/qchannel/ads/vast/preroll'
                }
            }
        }
    };

    return new Response(JSON.stringify(feed, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
    });
}

function generateMRSSFeed(zones) {
    const items = zones.map(zone => `
    <item>
      <title>${escapeXml(zone.name)}</title>
      <link>https://qryptomarket-news.vercel.app/zone/${zone.slug}</link>
      <description>${escapeXml(zone.description || `Live ${zone.name} market data`)}</description>
      <guid isPermaLink="false">${zone.id}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <media:content 
        url="https://qryptomarket-news.vercel.app/stream/${zone.slug}"
        type="application/x-mpegURL"
        medium="video"
        isDefault="true">
        <media:title>${escapeXml(zone.name)}</media:title>
        <media:thumbnail url="https://qryptomarket-news.vercel.app/thumbnails/${zone.slug}.jpg" />
        <media:category>${zone.slug}</media:category>
      </media:content>
    </item>
  `).join('\n');

    const mrss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:roku="http://developer.roku.com/rokuspec">
  <channel>
    <title>${CHANNEL_NAME}</title>
    <link>https://qryptomarket-news.vercel.app</link>
    <description>Real-time cryptocurrency market data, news, and insights</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${CHANNEL_LOGO}</url>
      <title>${CHANNEL_NAME}</title>
      <link>https://qryptomarket-news.vercel.app</link>
    </image>
    ${items}
  </channel>
</rss>`;

    return new Response(mrss, {
        status: 200,
        headers: {
            'Content-Type': 'application/rss+xml',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
    });
}

function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
