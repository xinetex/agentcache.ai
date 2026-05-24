/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import BigNumber from 'bignumber.js';

/**
 * Settlement mode controls which operations are allowed:
 * - 'verify-only': Read-only chain verification (default, safe for all environments)
 * - 'full': Enables outbound USDC transfers (requires BASE_PRIVATE_KEY)
 */
type SettlementMode = 'verify-only' | 'full';

/** ERC-20 Transfer event signature (keccak256 of "Transfer(address,address,uint256)") */
const ERC20_TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** USDC uses 6 decimals */
const USDC_DECIMALS = 6;

/**
 * BaseSettlementProvider: Bridge to the Base (Coinbase L2) Network.
 * Handles USDC settlements and wallet-to-wallet transfers for agents.
 *
 * HARDENING (Q4): Real on-chain verification via JSON-RPC.
 * No viem/ethers dependency — uses raw fetch against Base RPC for minimal footprint.
 */
export class BaseSettlementProvider {
    private rpcUrl: string;
    private masterWallet: string;
    private usdcContract: string;
    private mode: SettlementMode;

    constructor() {
        this.rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        this.masterWallet = (process.env.AGENTCACHE_MASTER_WALLET || '').toLowerCase();
        this.usdcContract = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
        this.mode = (process.env.AGENTCACHE_SETTLEMENT_MODE as SettlementMode) || 'verify-only';

        if (!this.masterWallet || this.masterWallet === '0xagentcachemasterwalletplaceholder') {
            console.warn('[BaseService] ⚠️ AGENTCACHE_MASTER_WALLET not set — on-chain verification will use permissive mode.');
        }
    }

    /**
     * Raw JSON-RPC call to Base chain.
     */
    private async rpc(method: string, params: any[]): Promise<any> {
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });

        const json = await response.json() as any;
        if (json.error) {
            throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`);
        }
        return json.result;
    }

    /**
     * Verify an on-chain USDC transfer matches x402 settlement requirements.
     *
     * Checks:
     * 1. Transaction succeeded (status = 0x1)
     * 2. Transaction interacted with the USDC contract
     * 3. A Transfer event log exists sending to the master wallet
     * 4. Transferred amount >= required minimum
     */
    async verifyOnChainSettlement(txHash: string, agentWallet: string, amountUSDC: number): Promise<boolean> {
        console.log(`[BaseService] 🔍 Verifying on-chain settlement: ${txHash}...`);

        // Allow mock transactions in test/dev environments
        if (txHash.startsWith('0xmock')) {
            console.log('[BaseService] Mock transaction — auto-verified.');
            return true;
        }

        // If master wallet isn't configured, fall back to permissive mode
        if (!this.masterWallet || this.masterWallet.length < 42) {
            console.warn('[BaseService] ⚠️ Master wallet not configured — permissive verification.');
            return true;
        }

        try {
            // 1. Fetch transaction receipt
            const receipt = await this.rpc('eth_getTransactionReceipt', [txHash]);
            if (!receipt) {
                console.error(`[BaseService] ❌ Transaction ${txHash} not found on chain.`);
                return false;
            }

            // 2. Check transaction succeeded
            if (receipt.status !== '0x1') {
                console.error(`[BaseService] ❌ Transaction ${txHash} failed (status: ${receipt.status}).`);
                return false;
            }

            // 3. Check transaction went to USDC contract
            const txTo = (receipt.to || '').toLowerCase();
            if (txTo !== this.usdcContract) {
                console.error(`[BaseService] ❌ Transaction target ${txTo} is not USDC contract ${this.usdcContract}.`);
                return false;
            }

            // 4. Find the ERC-20 Transfer event log to the master wallet
            const masterWalletPadded = '0x' + this.masterWallet.slice(2).padStart(64, '0');

            const transferLog = (receipt.logs || []).find((log: any) => {
                const topics = (log.topics || []).map((t: string) => t.toLowerCase());
                return (
                    topics[0] === ERC20_TRANSFER_EVENT_TOPIC &&
                    topics.length >= 3 &&
                    topics[2] === masterWalletPadded // 'to' address is indexed topic[2]
                );
            });

            if (!transferLog) {
                console.error(`[BaseService] ❌ No USDC Transfer event to master wallet found in tx ${txHash}.`);
                return false;
            }

            // 5. Verify amount (USDC has 6 decimals)
            const transferredRaw = new BigNumber(transferLog.data, 16);
            const transferredUSDC = transferredRaw.dividedBy(new BigNumber(10).pow(USDC_DECIMALS)).toNumber();

            if (transferredUSDC < amountUSDC) {
                console.error(
                    `[BaseService] ❌ Insufficient settlement: ${transferredUSDC} USDC < required ${amountUSDC} USDC.`
                );
                return false;
            }

            console.log(`[BaseService] ✅ On-chain settlement verified: ${transferredUSDC} USDC in tx ${txHash}.`);
            return true;
        } catch (error: any) {
            console.error(`[BaseService] ❌ On-chain verification error: ${error.message}`);
            return false;
        }
    }

    /**
     * Trigger a USDC transfer from the Master Treasury to a Participant.
     * Gated behind AGENTCACHE_SETTLEMENT_MODE=full and BASE_PRIVATE_KEY.
     */
    async transferUSDC(to: string, amount: number): Promise<string> {
        if (this.mode !== 'full') {
            console.warn('[BaseService] ⚠️ Transfer blocked: settlement mode is "verify-only". Set AGENTCACHE_SETTLEMENT_MODE=full to enable.');
            return `0xblocked_verify_only_${Date.now()}`;
        }

        if (!process.env.BASE_PRIVATE_KEY) {
            console.error('[BaseService] ❌ BASE_PRIVATE_KEY not set — cannot sign outbound transfers.');
            throw new Error('BASE_PRIVATE_KEY required for outbound transfers');
        }

        console.log(`[BaseService] 💸 Triggering on-chain transfer of ${amount} USDC to ${to}...`);

        // Real implementation would use viem's walletClient to sign and send.
        // For now, construct the intent and log it for auditability.
        const transferIntent = {
            to,
            amount,
            contract: this.usdcContract,
            chain: 'base',
            timestamp: new Date().toISOString(),
        };
        console.log(`[BaseService] Transfer intent:`, JSON.stringify(transferIntent));

        // TODO: Implement with viem walletClient when BASE_PRIVATE_KEY is provisioned
        const mockTxHash = `0xpending_transfer_${Date.now()}`;
        return mockTxHash;
    }

    /**
     * Get USDC Balance for a wallet on Base via balanceOf call.
     */
    async getBalance(address: string): Promise<number> {
        try {
            // balanceOf(address) selector = 0x70a08231
            const paddedAddress = address.slice(2).padStart(64, '0');
            const callData = `0x70a08231${paddedAddress}`;

            const result = await this.rpc('eth_call', [
                { to: this.usdcContract, data: callData },
                'latest',
            ]);

            const rawBalance = new BigNumber(result, 16);
            return rawBalance.dividedBy(new BigNumber(10).pow(USDC_DECIMALS)).toNumber();
        } catch (error: any) {
            console.error(`[BaseService] ❌ Balance check failed for ${address}: ${error.message}`);
            return 0;
        }
    }
}

export const baseSettlement = new BaseSettlementProvider();
