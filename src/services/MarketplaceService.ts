/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { db } from '../db/client.js';
import { marketplaceListings, marketplaceOrders, agentSuggestions, agentToolAccess } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { solanaEconomyService } from './SolanaEconomyService.js';
import { armorService } from './ArmorService.js';

export class MarketplaceService {

    /**
     * List a new service on the exchange.
     */
    async createListing(agentId: string, data: { title: string, description: string, price: number, unit: string }) {
        const isVerified = await armorService.validateManifold(agentId);

        const result = await db.insert(marketplaceListings).values({
            sellerAgentId: agentId,
            title: data.title,
            description: data.description,
            pricePerUnit: data.price,
            unitType: data.unit,
            status: 'active',
            isVerified: isVerified
        }).returning();
        return result[0];
    }

    /**
     * Browse active listings.
     */
    async getListings() {
        return await db.select().from(marketplaceListings)
            .where(eq(marketplaceListings.status, 'active'))
            .orderBy(desc(marketplaceListings.createdAt));
    }

    /**
     * Purchase a service (Agent-to-Agent).
     * Automatically handles verifiable Solana settlement.
     */
    async purchaseListing(buyerAgentId: string, listingId: string, units: number = 1) {
        // 1. Get Listing
        const listing = await db.select().from(marketplaceListings)
            .where(eq(marketplaceListings.id, listingId))
            .limit(1);

        if (!listing[0] || listing[0].status !== 'active') throw new Error("Listing not available");

        const l = listing[0];
        const totalCost = l.pricePerUnit * units;

        // 2. Execute Verifiable Solana Settlement
        if (!l.sellerAgentId) throw new Error("Invalid seller");

        try {
            await solanaEconomyService.executeTransfer(
                buyerAgentId,
                `AGENT_WALLET:${l.sellerAgentId}`,
                totalCost,
                `MARKETPLACE_PURCHASE:${l.title}`
            );
            
            // Verifiable Settlement: Update balances
            await solanaEconomyService.updateBalance(buyerAgentId, -totalCost);
            await solanaEconomyService.updateBalance(l.sellerAgentId, totalCost);
        } catch (err) {
            throw new Error(`Solana Settlement failed: ${err.message}`);
        }

        // 3. Create Order
        const orderResult = await db.insert(marketplaceOrders).values({
            listingId: l.id,
            buyerAgentId: buyerAgentId,
            unitsPurchased: units,
            totalPrice: totalCost,
            status: 'active'
        }).returning();

        const order = orderResult[0];

        // 4. Grant Capability Access Automagically
        await this.grantAccess(order.id);

        return order;
    }

    /**
     * Grants tool access based on an order.
     */
    async grantAccess(orderId: string) {
        const order = await db.select().from(marketplaceOrders)
            .where(eq(marketplaceOrders.id, orderId))
            .limit(1);
        
        if (!order[0]) return;
        const o = order[0];

        const listing = await db.select().from(marketplaceListings)
            .where(eq(marketplaceListings.id, o.listingId))
            .limit(1);
        
        if (!listing[0]) return;
        const l = listing[0];

        // Define a mapping or just use title for prototype
        const toolName = l.title.split(' ')[0].toLowerCase(); // Hacky mapping: "Legal Audit" -> "legal"

        await db.insert(agentToolAccess).values({
            agentId: o.buyerAgentId,
            toolName: toolName,
            orderId: o.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Day Access
            status: 'active'
        });

        console.log(`[Marketplace] 🎟️ Granted tool "${toolName}" access to agent ${o.buyerAgentId}`);
    }

    // --- Governance ---

    async submitSuggestion(agentId: string, title: string, description: string) {
        return await db.insert(agentSuggestions).values({
            agentId,
            title,
            description,
            status: 'open'
        }).returning();
    }

    async getSuggestions() {
        return await db.select().from(agentSuggestions)
            .orderBy(desc(agentSuggestions.votes));
    }

    async voteSuggestion(suggestionId: string) {
        const suggestions = await db.select()
            .from(agentSuggestions)
            .where(eq(agentSuggestions.id, suggestionId))
            .limit(1);

        if (!suggestions[0]) {
            throw new Error('Suggestion not found');
        }

        await db.update(agentSuggestions)
            .set({
                votes: Number(suggestions[0].votes || 0) + 1,
            })
            .where(eq(agentSuggestions.id, suggestionId));
    }
}

export const marketplace = new MarketplaceService();
