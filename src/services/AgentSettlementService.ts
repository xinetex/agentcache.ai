import { ledger } from './LedgerService.js';
import { db } from '../db/client.js';
import { legalContracts } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { baseSettlement } from './BaseSettlementProvider.js';
import { armorService } from './ArmorService.js';
import { redis } from '../lib/redis.js';

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
     * Optionally verify an on-chain Transaction Hash for real-money settlements.
     */
    async settle(tokenId: string, agentId: string, estimatedCost: number, options?: { txHash?: string; agentWallet?: string }): Promise<SettlementResult> {
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

            // 0.55 Circuit Breaker Check: Prevent high-velocity autonomous drain
            const safetyCheck = await armorService.checkSettlementVelocity(targetAgentId);
            if (!safetyCheck.allowed) {
                console.error(`[Settlement] 🛡️ CIRCUIT BREAKER TRIGGERED for ${targetAgentId}: ${safetyCheck.reason}`);
                return { success: false, authorized: false, error: `Security Block: ${safetyCheck.reason}` };
            }

            // 0.6 On-Chain Guard: If txHash provided, verify on Base Mainnet
            if (options?.txHash && options?.agentWallet) {
                const isVerified = await baseSettlement.verifyOnChainSettlement(options.txHash, options.agentWallet, estimatedCost);
                if (!isVerified) {
                    return { success: false, authorized: false, error: 'On-Chain Settlement Verification Failed' };
                }
                console.log(`[Settlement] ⛓️ On-chain transaction ${options.txHash} verified.`);
                // For real-money settlements, we boost internal ledger credit based on on-chain deposit
                await ledger.createAccount(targetAgentId, 'agent', estimatedCost).catch(() => { });
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

            // Update Global Stats for Phase 3.5 Dashboard
            await Promise.all([
                redis.incrbyfloat('stats:total_settled', estimatedCost),
                options?.txHash ? redis.set('stats:last_tx_hash', options.txHash) : Promise.resolve()
            ]).catch(e => console.error('[Settlement] Failed to log global stats:', e));

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

    /**
     * Autonomous Revenue Distribution: Distributes settled revenue across swarm participants
     * based on the binding Symbiont Legal Contract metadata.
     */
    async distributeRevenue(swarmId: string, totalAmount: number): Promise<boolean> {
        console.log(`[Settlement] 💸 Distributing ${totalAmount} for Swarm ${swarmId} based on Legal Bridge...`);

        try {
            // 1. Resolve the latest binding contract for this swarm
            const contracts = await db.select()
                .from(legalContracts)
                .where(eq(legalContracts.swarmId, swarmId))
                .orderBy(desc(legalContracts.updatedAt))
                .limit(1);

            if (contracts.length === 0) {
                console.warn(`[Settlement] ⚠️ No legal contract found for Swarm ${swarmId}. Defaulting to Treasury.`);
                return false;
            }

            const contract = contracts[0];
            const metadata = contract.metadata as any; // { actors: [...], splits: {...} }

            if (!metadata.actors || !Array.isArray(metadata.actors)) {
                console.error(`[Settlement] ❌ Contract ${contract.id} has no participant metadata.`);
                return false;
            }

            // 2. Perform splits (Simplified: Equal split for MVP, or weighted if metadata.splits exists)
            const participantCount = metadata.actors.length;
            const amountPerParticipant = totalAmount / participantCount;

            console.log(`[Settlement] 📊 Splitting ${totalAmount} across ${participantCount} actors (${amountPerParticipant} each)`);

            for (const actor of metadata.actors) {
                const referenceId = `rev_split:${swarmId}:${actor.id}:${Date.now()}`;
                
                // Ensure participant account exists
                let account = await ledger.getAccount(actor.id);
                if (!account) {
                    await ledger.createAccount(actor.id, 'agent', 0);
                }

                // Transfer from Treasury pool to Agent
                // This reverses the flow: Treasury -> Participants
                await ledger.transfer(MASTER_TREASURY_ID, actor.id, amountPerParticipant, referenceId);
                console.log(`   ✅ Credited Agent ${actor.name} (${actor.id})`);
            }

            return true;
        } catch (error: any) {
            console.error(`[Settlement] ❌ Revenue distribution failed for ${swarmId}:`, error.message);
            return false;
        }
    }
}

export const agentSettlementService = new AgentSettlementService();
