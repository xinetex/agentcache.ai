import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl, Keypair } from '@solana/web3.js';
import { encodeURL, validateTransfer, FindReferenceError, ValidateTransferError, findReference } from '@solana/pay';
import BigNumber from 'bignumber.js';

export class SolanaService {
    private static connection: Connection;
    private static merchantWallet: PublicKey;

    static initialize() {
        if (!this.connection) {
            // Default to Devnet for safety/testing. User can switch to 'mainnet-beta'.
            const endpoint = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
            this.connection = new Connection(endpoint, 'confirmed');

            // Merchant Wallet (Destination)
            // Default to a random new one if not set, just so app doesn't crash.
            const walletStr = process.env.MERCHANT_WALLET_ADDRESS || 'mvines9iiHiQTysrwkTjMcDYvOsSoFA7QvwZq3x476z'; // Solana Creator's wallet as placeholder example
            this.merchantWallet = new PublicKey(walletStr);

            console.log(`[SolanaService] Connected to ${endpoint}. Wallet: ${this.merchantWallet.toBase58()}`);
        }
    }

    /**
     * Create a Solana Pay URL (for QR Code)
     */
    static createPaymentRequest(amountSOL: number, label: string, message: string) {
        this.initialize();

        const recipient = this.merchantWallet;
        const amount = new BigNumber(amountSOL);
        const reference = new Keypair().publicKey; // Random reference key to track this specific transaction

        const url = encodeURL({
            recipient,
            amount,
            reference,
            label,
            message,
        });

        return {
            url: url.toString(),
            reference: reference.toBase58(),
            amount: amount.toString(),
            recipient: recipient.toBase58()
        };
    }

    /**
     * Check if a payment with specific Reference Key has landed on-chain.
     */
    static async verifyPayment(reference: string, amountSOL: number): Promise<boolean> {
        this.initialize();
        const refKey = new PublicKey(reference);
        const amount = new BigNumber(amountSOL);

        try {
            // 1. Find transaction with this reference key (fast lookup)
            const signatureInfo = await findReference(this.connection, refKey, { finality: 'confirmed' });

            // 2. Validate it matches expected amount and recipient
            await validateTransfer(
                this.connection,
                signatureInfo.signature,
                {
                    recipient: this.merchantWallet,
                    amount
                }
            );

            return true;

        } catch (error) {
            if (error instanceof FindReferenceError) {
                // Not found yet
                return false;
            }
            if (error instanceof ValidateTransferError) {
                console.error('Transaction found but invalid:', error);
                return false;
            }
            console.error('Solana Verification Error:', error);
            return false;
        }
    }

    /**
     * Get Balance of Merchant Wallet
     */
    static async getBalance(): Promise<number> {
        this.initialize();
        const balance = await this.connection.getBalance(this.merchantWallet);
        return balance / LAMPORTS_PER_SOL;
    }
}
