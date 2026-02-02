
/**
 * Verify Agent Exchange
 * Simulates a full lifecycle of the marketplace.
 */
import { ledger } from '../src/services/LedgerService.js';
import { marketplace } from '../src/services/MarketplaceService.js';
import { db } from '../src/db/client.js';
import { agents } from '../src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log("🏦 Initializing Agent Exchange Verification...");

    // 1. Create Agents without using 'returning' if driver doesn't support it well, 
    // or just assume standard Postgres behavior.
    const sellerId = uuidv4();
    const buyerId = uuidv4();

    console.log(`Creating Agents: Seller=${sellerId}, Buyer=${buyerId}`);

    try {
        await db.insert(agents).values([
            { id: sellerId, name: 'LidarPro_Agent', role: 'specialist' },
            { id: buyerId, name: 'DeepThinker_Agent', role: 'researcher' }
        ]);

        // 2. Setup Ledger
        await ledger.createAccount(sellerId, 'agent', 0);
        await ledger.createAccount(buyerId, 'agent', 100); // Give buyer $100

        console.log("💰 Ledger Accounts Initialized. Buyer Balance: $100");

        // 3. Create Listing
        console.log("📢 Seller creating listing...");
        const listing = await marketplace.createListing(sellerId, {
            title: 'High-Res Lidar Analysis',
            description: 'I will analyze any AOI for structrual defects.',
            price: 10.00,
            unit: 'request'
        });
        console.log(`✅ Listing Created: ${listing.title} ($${listing.pricePerUnit})`);

        // 4. Purchase
        console.log("🛒 Buyer purchasing service...");
        const order = await marketplace.purchaseListing(buyerId, listing.id, 2); // Buy 2 units ($20)

        console.log(`✅ Order Placed: ID ${order.id} - Total: $${order.totalPrice}`);

        // 5. Verify Balances
        const sellerAcc = await ledger.getAccount(sellerId);
        const buyerAcc = await ledger.getAccount(buyerId);

        console.log(`\n--- Final Balances ---`);
        console.log(`Seller: $${sellerAcc.balance} (Expected $20)`);
        console.log(`Buyer:  $${buyerAcc.balance} (Expected $80)`);

        if (sellerAcc.balance === 20 && buyerAcc.balance === 80) {
            console.log("\nPASSED: Transaction successful.");
        } else {
            console.error("\nFAILED: Balance mismatch.");
        }

        // 6. Test Suggestion Box
        console.log("\n🗳️ Testing Suggestion Box...");
        const suggestion = await marketplace.submitSuggestion(buyerId, "Add Dark Mode API", "Agents need clarity in the dark.");
        console.log(`Suggestion Submitted: "${suggestion.title}"`);

    } catch (err) {
        console.error("Verification Failed:", err);
    }
}

main().catch(console.error);
