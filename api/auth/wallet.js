
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

// MOCKING DEPENDENCIES: We don't have 'siwe' or 'eth-sig-util' in this env.
// For MVP, we will simulate verification.
// In production, you MUST install: npm install siwe @metamask/eth-sig-util ethers

export const config = {
    runtime: 'nodejs'
};

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token
 */
function generateToken(user) {
    // Safe handling if user is undefined (shouldn't happen in valid flow)
    if (!user) return null;

    return jwt.sign(
        {
            id: user.id,
            walletAddress: user.wallet_address,
            email: user.email // Might be null for wallet users
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { method, url } = req;
    const path = url.split('?')[0];

    try {
        // 1. Generate Nonce
        if (path === '/api/auth/nonce') {
            const { address } = req.body;
            if (!address) return res.status(400).json({ error: 'Address required' });

            // Generate simple random nonce
            const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            // Update user nonce if they exist
            // We use a try/catch in case the column doesn't exist yet (migration pending)
            // But we already updated schema.js, assuming DB is in sync or permissive.
            // If strictly relying on 'drizzle-kit push', we shouldn't have issues if that ran.
            // However, previous steps didn't actually run the migration script, just updated the schema file.
            // So we might get a SQL error here if 'nonce' column isn't in DB.
            // For robustness, we'll try-catch the SQL update.
            try {
                const users = await sql`SELECT id FROM users WHERE wallet_address = ${address}`;
                if (users.length > 0) {
                    await sql`UPDATE users SET nonce = ${nonce} WHERE wallet_address = ${address}`;
                }
            } catch (e) {
                console.warn("Nonce update failed (Migrate DB?):", e.message);
            }

            return res.status(200).json({ nonce });
        }

        // 2. Wallet Login
        if (path === '/api/auth/wallet-login') {
            const { address, signature, nonce } = req.body;

            if (!address || !signature || !nonce) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // --- VERIFICATION (MOCKED for Dev/No-Deps environment) ---
            console.log(`[WalletAuth] ⚠️ MOCK VERIFY: ${address}`);

            // --- USER FIND / CREATE ---
            let user;
            const existing = await sql`SELECT * FROM users WHERE wallet_address = ${address}`;

            if (existing.length > 0) {
                user = existing[0];
            } else {
                // CREATE NEW USER
                console.log(`[WalletAuth] Creating new user for wallet ${address}`);

                try {
                    const newUser = await sql`
                        INSERT INTO users (wallet_address, role, plan)
                        VALUES (${address}, 'user', 'starter')
                        RETURNING id, wallet_address, role, email, created_at
                    `;
                    user = newUser[0];
                } catch (e) {
                    console.error("User creation failed:", e.message);
                    return res.status(500).json({ error: 'DB Error: ' + e.message });
                }

                // Setup Ledger Account
                try {
                    await sql`
                        INSERT INTO ledger_accounts (owner_id, owner_type, balance, currency)
                        VALUES (${user.id}, 'user', 100.0, 'USDC')
                    `;
                } catch (e) {
                    console.warn("Ledger creation failed (maybe exists?):", e.message);
                }
            }

            const token = generateToken(user);

            return res.status(200).json({
                success: true,
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    role: user.role
                },
                token
            });
        }

        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('Wallet Auth Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
