/**
 * Auth Middleware — AgentForge
 * JWT-based authentication for the Folder That Thinks.
 * 
 * Security: bcrypt password hashing, short-lived JWTs, 
 * constant-time comparison, no secret leakage in errors.
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

// --- Crypto Utilities for BYOK ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.createHash('sha256').update(String(JWT_SECRET)).digest('base64').substring(0, 32);
const IV_LENGTH = 12;

export function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text) {
    if (!text || !text.includes(':')) return text;
    try {
        const [ivHex, authTagHex, encryptedHex] = text.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('[Crypto Error] Failed to decrypt:', err);
        return '';
    }
}

// --- Token Utilities ---

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

/**
 * Extract authenticated user from a request's Authorization header.
 * Returns null if unauthenticated — never throws.
 */
export async function getUserFromRequest(req) {
    // Support both Edge Request (Map) and Express (object) headers
    const authHeader = typeof req.headers?.get === 'function'
        ? req.headers.get('authorization')
        : req.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const decoded = verifyToken(authHeader.slice(7));
    if (!decoded) return null;

    const rows = await sql`
        SELECT id, email, name, role, plan, created_at
        FROM users
        WHERE id = ${decoded.id}
    `;
    return rows[0] || null;
}

// --- Edge API Handler (signup / login / me / logout) ---

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

export default async function handler(req) {
    try {
        const url = new URL(req.url);
        const action = url.pathname.split('/').pop(); // 'signup', 'login', 'me', 'logout'
        const body = req.method === 'POST' || req.method === 'PATCH' ? await req.json() : {};

        // --- SIGNUP ---
        if (req.method === 'POST' && action === 'signup') {
            const { email, password, name } = body;

            if (!email || !password) {
                return json({ error: 'Email and password required' }, 400);
            }
            if (password.length < 8) {
                return json({ error: 'Password must be at least 8 characters' }, 400);
            }
            // Basic email format check
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return json({ error: 'Invalid email format' }, 400);
            }

            const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
            if (existing.length > 0) {
                return json({ error: 'Email already registered' }, 409);
            }

            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const rows = await sql`
                INSERT INTO users (email, password_hash, name)
                VALUES (${email}, ${passwordHash}, ${name || null})
                RETURNING id, email, name, role, plan, created_at
            `;
            const user = rows[0];
            const token = generateToken(user);

            return json({ user, token }, 201);
        }

        // --- LOGIN ---
        if (req.method === 'POST' && action === 'login') {
            const { email, password } = body;

            if (!email || !password) {
                return json({ error: 'Email and password required' }, 400);
            }

            const rows = await sql`
                SELECT id, email, name, role, plan, password_hash, created_at
                FROM users WHERE email = ${email}
            `;
            if (rows.length === 0) {
                return json({ error: 'Invalid credentials' }, 401);
            }

            const user = rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return json({ error: 'Invalid credentials' }, 401);
            }

            // Strip password_hash before returning
            const { password_hash: _, ...safeUser } = user;
            const token = generateToken(safeUser);

            return json({ user: safeUser, token });
        }

        // --- ME (who am I?) ---
        if (req.method === 'GET' && action === 'me') {
            const user = await getUserFromRequest(req);
            if (!user) return json({ error: 'Unauthorized' }, 401);

            // Fetch user including settings
            const rows = await sql`SELECT id, email, name, role, plan, settings, created_at FROM users WHERE id = ${user.id}`;
            const fullUser = rows[0];
            
            // Decrypt keys before sending to frontend
            if (fullUser.settings) {
                if (fullUser.settings.openaiKey) fullUser.settings.openaiKey = decrypt(fullUser.settings.openaiKey);
                if (fullUser.settings.anthropicKey) fullUser.settings.anthropicKey = decrypt(fullUser.settings.anthropicKey);
            }

            // Also return their node count
            const nodeCount = await sql`
                SELECT COUNT(*) as count FROM smart_nodes WHERE owner_id = ${user.id}
            `;

            return json({
                user: fullUser,
                stats: { nodes: parseInt(nodeCount[0]?.count || '0') },
            });
        }

        // --- UPDATE SETTINGS ---
        if (req.method === 'PATCH' && action === 'settings') {
            const user = await getUserFromRequest(req);
            if (!user) return json({ error: 'Unauthorized' }, 401);

            if (!body.settings || typeof body.settings !== 'object') {
                return json({ error: 'Settings object required' }, 400);
            }

            const secureSettings = { ...body.settings };
            if (secureSettings.openaiKey) secureSettings.openaiKey = encrypt(secureSettings.openaiKey);
            if (secureSettings.anthropicKey) secureSettings.anthropicKey = encrypt(secureSettings.anthropicKey);

            // Using jsonb_set or simple replacement. 
            // For simplicity, we merge with existing settings via SQL || operator.
            const rows = await sql`
                UPDATE users
                SET settings = COALESCE(settings, '{}'::jsonb) || ${JSON.stringify(secureSettings)}::jsonb,
                    updated_at = NOW()
                WHERE id = ${user.id}
                RETURNING settings
            `;
            
            const returnedSettings = rows[0].settings;
            if (returnedSettings.openaiKey) returnedSettings.openaiKey = decrypt(returnedSettings.openaiKey);
            if (returnedSettings.anthropicKey) returnedSettings.anthropicKey = decrypt(returnedSettings.anthropicKey);

            return json({ success: true, settings: returnedSettings });
        }

        // --- LOGOUT ---
        if (req.method === 'POST' && action === 'logout') {
            // JWT is stateless — client deletes the token.
            // Future: implement token blacklist in Redis.
            return json({ message: 'Logged out' });
        }

        return json({ error: 'Not found' }, 404);

    } catch (err) {
        console.error('[Auth] Error:', err);
        // Never leak internal details to the client
        return json({ error: 'Internal server error' }, 500);
    }
}
