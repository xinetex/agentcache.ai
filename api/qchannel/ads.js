/**
 * QChannel Ad Server - Google Ad Manager Integration
 * GET /api/qchannel/ads/vast/:type - Get VAST tag for ad type
 * POST /api/qchannel/ads/event - Log ad event (impression, complete, etc.)
 * 
 * Supports Roku RAF (Roku Ad Framework) integration
 */

import { db } from '../../lib/db.js';

// Google Ad Manager configuration
// These would be set via environment variables in production
const GAM_NETWORK_ID = process.env.GAM_NETWORK_ID || 'DEMO';
const GAM_AD_UNIT_PREROLL = process.env.GAM_AD_UNIT_PREROLL || '/qchannel/preroll';
const GAM_AD_UNIT_MIDROLL = process.env.GAM_AD_UNIT_MIDROLL || '/qchannel/midroll';

export default async function handler(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // /api/qchannel/ads/vast/:type or /api/qchannel/ads/event
    const action = pathParts[3]; // 'vast' or 'event'
    const adType = pathParts[4]; // 'preroll', 'midroll', etc. or undefined for event

    try {
        if (action === 'vast') {
            return await getVASTTag(adType, url.searchParams);
        }

        if (action === 'event' && req.method === 'POST') {
            return await logAdEvent(await req.json());
        }

        return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[QChannel Ads] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function getVASTTag(adType, params) {
    const zoneId = params.get('zone');
    const deviceId = params.get('device_id') || '';
    const deviceType = params.get('device_type') || 'roku';

    // Check if we have a custom placement for this zone
    let placementResult;
    if (zoneId) {
        placementResult = await db.query(`
      SELECT vast_tag_url, ad_unit_id 
      FROM qchannel_ad_placements 
      WHERE zone_id = $1 AND placement_type = $2 AND is_active = true
      LIMIT 1
    `, [zoneId, adType]);
    }

    // Fall back to global placement
    if (!placementResult?.rows.length) {
        placementResult = await db.query(`
      SELECT vast_tag_url, ad_unit_id 
      FROM qchannel_ad_placements 
      WHERE zone_id IS NULL AND placement_type = $1 AND is_active = true
      LIMIT 1
    `, [adType]);
    }

    const placement = placementResult?.rows[0];

    // If there's a custom VAST tag URL, redirect to it
    if (placement?.vast_tag_url) {
        return Response.redirect(placement.vast_tag_url, 302);
    }

    // Generate Google Ad Manager VAST URL
    const adUnitId = placement?.ad_unit_id || (adType === 'preroll' ? GAM_AD_UNIT_PREROLL : GAM_AD_UNIT_MIDROLL);

    // Build GAM VAST request URL
    const gamVastUrl = buildGAMVastUrl({
        networkId: GAM_NETWORK_ID,
        adUnitId,
        deviceId,
        deviceType,
        zoneId,
        adType
    });

    // For demo/development: return a sample VAST response
    if (GAM_NETWORK_ID === 'DEMO') {
        return generateDemoVAST(adType);
    }

    // In production: Proxy the GAM request
    return Response.redirect(gamVastUrl, 302);
}

function buildGAMVastUrl({ networkId, adUnitId, deviceId, deviceType, zoneId, adType }) {
    const baseUrl = 'https://pubads.g.doubleclick.net/gampad/ads';
    const params = new URLSearchParams({
        iu: `/${networkId}${adUnitId}`,
        sz: '640x480',
        gdfp_req: '1',
        output: 'vast',
        env: 'vp',
        impl: 's',
        unviewed_position_start: '1',
        correlator: Date.now().toString(),
        // Custom targeting
        cust_params: `zone=${zoneId || 'global'}&device=${deviceType}&type=${adType}`,
        // Device ID for frequency capping
        rdid: deviceId,
        idtype: deviceType === 'roku' ? 'rida' : 'unknown',
        is_lat: '0'
    });

    return `${baseUrl}?${params.toString()}`;
}

function generateDemoVAST(adType) {
    // Demo VAST response for development/testing
    const vast = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0">
  <Ad id="demo-${adType}">
    <InLine>
      <AdSystem>QChannel Demo</AdSystem>
      <AdTitle>QChannel ${adType} Demo Ad</AdTitle>
      <Description>Demo advertisement for QChannel development</Description>
      <Impression><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=impression&ad=${adType}]]></Impression>
      <Creatives>
        <Creative id="1">
          <Linear skipoffset="00:00:05">
            <Duration>00:00:15</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" bitrate="2000" width="1280" height="720">
                <![CDATA[https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4]]>
              </MediaFile>
            </MediaFiles>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=start&ad=${adType}]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=firstQuartile&ad=${adType}]]></Tracking>
              <Tracking event="midpoint"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=midpoint&ad=${adType}]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=thirdQuartile&ad=${adType}]]></Tracking>
              <Tracking event="complete"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=complete&ad=${adType}]]></Tracking>
              <Tracking event="skip"><![CDATA[https://agentcache.ai/api/qchannel/ads/event?type=skip&ad=${adType}]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[https://qryptomarket-news.vercel.app]]></ClickThrough>
            </VideoClicks>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

    return new Response(vast, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}

async function logAdEvent(data) {
    const { event_type, placement_id, zone_id, device_type, device_id, metadata } = data;

    if (!event_type) {
        return new Response(JSON.stringify({ error: 'event_type required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Insert event
    await db.query(`
    INSERT INTO qchannel_ad_events 
      (event_type, placement_id, zone_id, device_type, device_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
        event_type,
        placement_id || null,
        zone_id || null,
        device_type || 'unknown',
        device_id || null,
        metadata ? JSON.stringify(metadata) : '{}'
    ]);

    // Update placement stats if we have a placement_id
    if (placement_id && (event_type === 'impression' || event_type === 'complete')) {
        const updateField = event_type === 'impression' ? 'total_impressions' : 'total_completions';
        await db.query(`
      UPDATE qchannel_ad_placements 
      SET ${updateField} = ${updateField} + 1
      WHERE id = $1
    `, [placement_id]);
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
