import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
const JWT_SECRET = process.env.JWT_SECRET || 'agentcache-secret-change-this';
const SALT_ROUNDS = 10;
/**
 * Hash password with bcrypt
 */
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
/**
 * Generate JWT token
 */
export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
/**
 * Generate API key
 */
export function generateApiKey(prefix = 'live') {
    const random = createId();
    return `ac_${prefix}_${random}`;
}
/**
 * Hash API key for storage
 */
export async function hashApiKey(key) {
    return bcrypt.hash(key, SALT_ROUNDS);
}
/**
 * Verify API key against hash
 */
export async function verifyApiKey(key, hash) {
    return bcrypt.compare(key, hash);
}
//# sourceMappingURL=auth.js.map