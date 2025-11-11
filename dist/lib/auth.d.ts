export interface JWTPayload {
    userId: string;
    email: string;
}
/**
 * Hash password with bcrypt
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify password against hash
 */
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
/**
 * Generate JWT token
 */
export declare function generateToken(payload: JWTPayload): string;
/**
 * Verify JWT token
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Generate API key
 */
export declare function generateApiKey(prefix?: 'live' | 'test'): string;
/**
 * Hash API key for storage
 */
export declare function hashApiKey(key: string): Promise<string>;
/**
 * Verify API key against hash
 */
export declare function verifyApiKey(key: string, hash: string): Promise<boolean>;
//# sourceMappingURL=auth.d.ts.map