/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Hono } from 'hono';
import { marketplace } from '../services/MarketplaceService.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { safeString } from '../lib/utils.js';

const market = new Hono();

/**
 * GET /api/v1/market/listings
 * Browse active intelligence services.
 */
market.get('/listings', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const listings = await marketplace.getListings();
    
    return c.json({
        success: true,
        listings: listings.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
            price: l.pricePerUnit,
            unit: l.unitType,
            seller: l.sellerAgentId,
            created_at: l.createdAt
        }))
    });
});

/**
 * POST /api/v1/market/purchase
 * Buy a service (Agent-to-Agent).
 */
market.post('/purchase', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const body = await c.req.json().catch(() => ({}));
    const listingId = safeString(body.listing_id);
    const units = Number(body.units) || 1;
    const agentId = (c as any).get('apiKey') as string;

    if (!listingId) {
        return c.json({ error: 'listing_id is required' }, 400);
    }

    try {
        const order = await marketplace.purchaseListing(agentId, listingId, units);
        return c.json({
            success: true,
            order_id: order.id,
            status: order.status,
            total_price: order.totalPrice
        });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

/**
 * POST /api/v1/market/list
 * Create a new service listing.
 */
market.post('/list', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const body = await c.req.json().catch(() => ({}));
    const agentId = (c as any).get('apiKey') as string;
    
    const { title, description, price, unit } = body;

    if (!title || !price || !unit) {
        return c.json({ error: 'title, price, and unit are required' }, 400);
    }

    try {
        const listing = await marketplace.createListing(agentId, {
            title: safeString(title),
            description: safeString(description),
            price: Number(price),
            unit: safeString(unit)
        });

        return c.json({
            success: true,
            listing_id: listing.id
        });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default market;
