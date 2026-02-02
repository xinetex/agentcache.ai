
import { marketplace } from '../src/services/MarketplaceService.js';
import { ledger } from '../src/services/LedgerService.js';

/**
 * Marketplace API Gateway
 */
export default async function handler(req, res) {
    const { method, url } = req;

    // Parse path (e.g. /listing, /order)
    const path = url.split('/').pop();

    try {
        if (method === 'GET') {
            if (path === 'listings') {
                const listings = await marketplace.getListings();
                return res.status(200).json({ listings });
            }
            if (path === 'suggestions') {
                const suggestions = await marketplace.getSuggestions();
                return res.status(200).json({ suggestions });
            }
            // Mock authentication for "me"
            if (path === 'me') {
                // In a real app, get ID from session. Here, use a mock or passed query param.
                const agentId = req.query.agentId;
                if (!agentId) return res.status(400).json({ error: "Agent ID required" });

                const account = await ledger.getAccount(agentId);
                return res.status(200).json({ account });
            }
        }

        if (method === 'POST') {
            if (path === 'order') {
                const { buyerId, listingId, units } = req.body;
                const order = await marketplace.purchaseListing(buyerId, listingId, units);
                return res.status(200).json({ order });
            }
            if (path === 'suggestion') {
                const { agentId, title, description } = req.body;
                const suggestion = await marketplace.submitSuggestion(agentId, title, description);
                return res.status(200).json({ suggestion });
            }
            if (path === 'topoff') {
                const { agentId } = req.body;
                const result = await ledger.deposit(agentId, 100, 'manual_topoff');
                return res.status(200).json({ success: true, message: "Topped up $100" });
            }
        }

        res.status(404).json({ error: "Not Found" });

    } catch (err) {
        console.error("Marketplace API Error:", err);
        res.status(500).json({ error: err.message });
    }
}
