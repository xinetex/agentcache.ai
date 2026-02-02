
import { db } from '../db/client.js';
import { marketplaceListings, marketplaceOrders, agentSuggestions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { ledger } from './LedgerService.js';

export class MarketplaceService {

    /**
     * List a new service on the exchange.
     */
    async createListing(agentId: string, data: { title: string, description: string, price: number, unit: string }) {
        const result = await db.insert(marketplaceListings).values({
            sellerAgentId: agentId,
            title: data.title,
            description: data.description,
            pricePerUnit: data.price,
            unitType: data.unit,
            status: 'active'
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
     * Automatically handles payment.
     */
    async purchaseListing(buyerAgentId: string, listingId: string, units: number = 1) {
        // 1. Get Listing
        const listing = await db.query.marketplaceListings.findFirst({
            where: eq(marketplaceListings.id, listingId)
        });

        if (!listing || listing.status !== 'active') throw new Error("Listing not available");

        const totalCost = listing.pricePerUnit * units;

        // 2. Execute Payment (Buyer -> Seller)
        // Note: Seller might be null if it's a system listing, but schema enforces agentId
        if (!listing.sellerAgentId) throw new Error("Invalid seller");

        try {
            await ledger.transfer(
                buyerAgentId,
                listing.sellerAgentId,
                totalCost,
                `Purchase: ${listing.title} (x${units})`
            );
        } catch (err) {
            throw new Error(`Payment failed: ${err.message}`);
        }

        // 3. Create Order
        const order = await db.insert(marketplaceOrders).values({
            listingId: listing.id,
            buyerAgentId: buyerAgentId,
            unitsPurchased: units,
            totalPrice: totalCost,
            status: 'active'
        }).returning();

        return order[0];
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
        // Simple increment for MVP
        // In real system, track voter ID to prevent duplicates
        await db.execute(sql`UPDATE agent_suggestions SET votes = votes + 1 WHERE id = ${suggestionId}`);
    }
}

export const marketplace = new MarketplaceService();
