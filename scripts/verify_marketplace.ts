import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { marketplace } from '../src/services/MarketplaceService.js';
import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { db } from '../src/db/client.js';
import { hubAgents, agentToolAccess } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export async function verifyMarketplace() {
    console.log("--- 🛒 Pillar 4: Marketplace Verification (hubAgents) ---");

    // 1. Setup Mock Agents (Include required 'role')
    const sellerId = 'seller_agent_' + Date.now();
    const buyerId = 'buyer_agent_' + Date.now();

    console.log("[Verify] Creating Mock Agents...");
    await db.insert(hubAgents).values([
        { 
            id: sellerId, 
            name: 'Service Provider Agent', 
            role: 'provider', 
            environment: 'production' 
        },
        { 
            id: buyerId, 
            name: 'Consumer Agent', 
            role: 'optimizer', 
            environment: 'production' 
        }
    ]);

    // 2. Initialize Wallets (Give buyer some SOL)
    console.log("[Verify] Initializing Wallets...");
    await solanaEconomyService.initializeWallet(buyerId, 1.0);
    await solanaEconomyService.initializeWallet(sellerId, 0.1);
    
    const initialBuyerBalance = await solanaEconomyService.getBalance(buyerId);
    console.log(`[Verify] Initial Buyer Balance: ${initialBuyerBalance} SOL`);

    // 3. Create Listing
    console.log("[Verify] Creating Listing...");
    const listing = await marketplace.createListing(sellerId, {
        title: 'Legal Compliance Audit',
        description: 'Autonomous legal risk assessment for B2B swarms.',
        price: 0.2,
        unit: 'audit'
    });
    console.log(`[Verify] Listing Created: ${listing.id}`);

    // 4. Autonomous Purchase
    console.log("[Verify] Executing Purchase...");
    const order = await marketplace.purchaseListing(buyerId, listing.id);
    console.log(`[Verify] Order Successful: ${order.id} | Total Price: ${order.totalPrice} SOL`);

    // 5. Verify Balances
    const finalBuyerBalance = await solanaEconomyService.getBalance(buyerId);
    const finalSellerBalance = await solanaEconomyService.getBalance(sellerId);
    console.log(`[Verify] Final Buyer Balance: ${finalBuyerBalance} SOL`);
    console.log(`[Verify] Final Seller Balance: ${finalSellerBalance} SOL`);

    // 6. Verify Access Grant
    console.log("[Verify] Verifying Access Grant...");
    const access = await db.select().from(agentToolAccess)
        .where(eq(agentToolAccess.agentId, buyerId));
    
    console.log(`[Verify] Tool Access Entries found: ${access.length}`);
    if (access.length > 0) {
        console.log(`[Verify] - Tool: ${access[0].toolName}`);
        console.log(`[Verify] - Status: ${access[0].status}`);
    }

    const success = finalBuyerBalance < initialBuyerBalance && access.length > 0;

    if (success) {
        console.log("\n✅ Pillar 4 Marketplace Verification SUCCESSFUL.");
    } else {
        console.log("\n❌ Pillar 4 Marketplace Verification FAILED.");
    }

    return {
        success,
        listingId: listing.id,
        orderId: order.id,
        initialBuyerBalance,
        finalBuyerBalance,
        finalSellerBalance,
        accessCount: access.length,
    };
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
    verifyMarketplace()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error("❌ Verification Error:", err);
            process.exit(1);
        });
}
