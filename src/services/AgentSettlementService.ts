import { ledger } from './LedgerService.js';

export interface SettlementResult {
    success: boolean;
    authorized: boolean;
    remainingBudget?: number;
    error?: string;
}

// Canonical UUID for the Master Treasury
export const MASTER_TREASURY_ID = '00000000-0000-0000-0000-000000000000';

/**
 * AgentSettlementService: The fiscal gateway for autonomous agents.
 * Connects x402 pre-authorization tokens to the internal Ledger and Billing systems.
 */
export class AgentSettlementService {

    /**
     * Validate a Preauthorization token and settle the base cost.
     * In the future, this will verify signatures on-chain or via MPC.
     */
    async settle(tokenId: string, agentId: string, estimatedCost: number): Promise<SettlementResult> {
        console.log(`[Settlement] 💳 Processing settlement for agent ${agentId} via token ${tokenId}...`);

        try {
            // 0. Ensure agentId is a UUID. 
            // In a real globally-distributed production env, this would be a lookup in a Global Registry.
            // For now, if it's an ac_ key, we fallback to our internal agentic-identity.
            const targetAgentId = (agentId.startsWith('ac_') && !agentId.includes('-'))
                ? '11111111-1111-1111-1111-111111111111'
                : agentId;

            // 0.5 Idempotency Check: Has this token already been settled?
            const referenceId = `x402_settlement:${tokenId}`;
            const existingTx = await ledger.getTransactionByReference(referenceId);
            if (existingTx) {
                console.log(`[Settlement] ♻️ Token ${tokenId} already settled. Returning cached receipt.`);
                const account = await ledger.getAccount(targetAgentId);
                return { success: true, authorized: true, remainingBudget: account?.balance || 0 };
            }

            // 1. Resolve agent account
            let account = await ledger.getAccount(targetAgentId);
            if (!account) {
                // Auto-provision if missing (standard for our agentic onboarding flow)
                account = await ledger.createAccount(targetAgentId, 'agent', 100).catch(() => null);
                if (!account) return { success: false, authorized: false, error: 'Agent Account Not Found' };
            }

            // 1.5 Ensure Treasury exists
            const treasury = await ledger.getAccount(MASTER_TREASURY_ID);
            if (!treasury) {
                await ledger.createAccount(MASTER_TREASURY_ID, 'user', 0).catch(() => { });
            }

            // 2. Enforce Budget / Check Funds
            const currentBalance = await ledger.getAccount(targetAgentId).then(a => a?.balance || 0);

            if (currentBalance < estimatedCost) {
                // Attempt auto-topoff if configured
                const toppedOff = await ledger.checkAutoTopOff(targetAgentId);
                if (!toppedOff) {
                    return { success: false, authorized: false, error: 'Insufficient Agent Funds' };
                }
            }

            // 3. Commit Transfer to Treasury (Atomic Post-Lock)
            console.log(`[Settlement] 💸 Transferring ${estimatedCost} from ${targetAgentId} to ${MASTER_TREASURY_ID}...`);
            await ledger.transfer(targetAgentId, MASTER_TREASURY_ID, estimatedCost, referenceId);

            const postBalance = await ledger.getAccount(targetAgentId).then(a => a?.balance || 0);
            console.log(`[Settlement] ✅ Settlement successful. New Balance: ${postBalance}`);

            return {
                success: true,
                authorized: true,
                remainingBudget: postBalance
            };

        } catch (error: any) {
            console.error(`[Settlement] ❌ Settlement failed: ${error.message}`);
            return { success: false, authorized: false, error: error.message };
        }
    }

    /**
     * Policy check to see if an agent is within their "Mission Budget"
     */
    async checkMissionQuota(agentId: string, missionId: string): Promise<boolean> {
        // Future: Check Redis-backed mission budget limits
        return true;
    }
}

export const agentSettlementService = new AgentSettlementService();
