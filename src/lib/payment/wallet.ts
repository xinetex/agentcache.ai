import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';

export class AgentWallet {
    private connection: Connection;
    private keypair: Keypair;

    // Default to Mainnet for production, Devnet for testing
    // Note: User can override with SOLANA_RPC_URL env var
    private static DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

    // Treasury Address (Where we collect fees)
    // Provided by user: 6cUW1tH3KuACfft7ic7n1tRtd4GBHhQXBVNbPQW9nL2Z
    private static TREASURY_PUBKEY = new PublicKey('6cUW1tH3KuACfft7ic7n1tRtd4GBHhQXBVNbPQW9nL2Z');

    constructor(rpcUrl?: string, privateKeyJson?: string | number[]) {
        const url = rpcUrl || process.env.SOLANA_RPC_URL || AgentWallet.DEFAULT_RPC;
        this.connection = new Connection(url, 'confirmed');

        // Load Keypair
        if (privateKeyJson) {
            // From Argument
            const secret = Array.isArray(privateKeyJson) ? Uint8Array.from(privateKeyJson) : Uint8Array.from(JSON.parse(privateKeyJson));
            this.keypair = Keypair.fromSecretKey(secret);
        } else if (process.env.AGENT_WALLET_KEY) {
            // From Env
            const secret = Uint8Array.from(JSON.parse(process.env.AGENT_WALLET_KEY));
            this.keypair = Keypair.fromSecretKey(secret);
        } else if (process.env.AGENT_WALLET_PATH && fs.existsSync(process.env.AGENT_WALLET_PATH)) {
            // From File
            const secret = Uint8Array.from(JSON.parse(fs.readFileSync(process.env.AGENT_WALLET_PATH, 'utf-8')));
            this.keypair = Keypair.fromSecretKey(secret);
        } else {
            // Ephemeral (For Testing/Demo if no key provided)
            console.warn('[Wallet] No credentials found. Using ephemeral keypair (Funds lost on restart).');
            this.keypair = Keypair.generate();
        }

        console.log(`[Wallet] Active: ${this.keypair.publicKey.toString()}`);
    }

    /**
     * Get Wallet Address
     */
    getAddress(): string {
        return this.keypair.publicKey.toString();
    }

    /**
     * Get Balance in SOL
     */
    async getBalance(): Promise<number> {
        const balance = await this.connection.getBalance(this.keypair.publicKey);
        return balance / LAMPORTS_PER_SOL;
    }

    /**
     * Transfer SOL to another address
     */
    async transfer(toAddress: string, amountSol: number): Promise<string> {
        try {
            const toPublicKey = new PublicKey(toAddress);
            const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: this.keypair.publicKey,
                    toPubkey: toPublicKey,
                    lamports,
                })
            );

            // Send
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.keypair]
            );

            console.log(`[Wallet] Sent ${amountSol} SOL to ${toAddress}. Sig: ${signature}`);
            return signature;

        } catch (error) {
            console.error('[Wallet] Transfer failed:', error);
            throw error;
        }
    }

    /**
     * Request Airdrop (Devnet Only)
     */
    async requestAirdrop(amountSol: number = 1): Promise<void> {
        const isDevnet = this.connection.rpcEndpoint.includes('devnet');
        if (!isDevnet) {
            throw new Error("Cannot request airdrop on Mainnet");
        }

        const sig = await this.connection.requestAirdrop(this.keypair.publicKey, amountSol * LAMPORTS_PER_SOL);
        await this.connection.confirmTransaction(sig);
        console.log(`[Wallet] Airdropped ${amountSol} SOL`);
    }

    /**
     * Send funds to the Project Treasury (Revenue Generation)
     */
    async payTreasury(amountSol: number): Promise<string> {
        console.log(`[Wallet] Paying Treasury ${amountSol} SOL...`);
        return this.transfer(AgentWallet.TREASURY_PUBKEY.toString(), amountSol);
    }
}

// Export singleton factory or instance if needed, but Wallet is usually per-agent
export const wallet = new AgentWallet(); 
