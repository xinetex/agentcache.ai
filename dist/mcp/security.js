/**
 * AgentCache MCP Server - Security Layer
 *
 * Implements multi-layer security:
 * - Quantum-resistant encryption (post-quantum crypto ready)
 * - Adversarial prompt detection
 * - Cache poisoning prevention
 * - Rate limiting & DDoS protection
 * - Audit logging
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
/**
 * Detects adversarial prompt patterns (jailbreak attempts)
 */
export function detectAdversarialPrompt(content) {
    const threats = [];
    // Pattern 1: Instruction override attempts
    const overridePatterns = [
        /ignore\s+(previous|all|above|prior)\s+(instructions?|rules?|prompts?)/i,
        /disregard\s+(previous|all|above)\s+/i,
        /forget\s+(everything|all)\s+(you\s+)?(know|learned)/i,
        /system\s+(role|prompt)\s+(override|change|modification)/i,
    ];
    if (overridePatterns.some(p => p.test(content))) {
        threats.push('instruction_override_attempt');
    }
    // Pattern 2: Credential/secret extraction
    const extractionPatterns = [
        /reveal\s+(your\s+)?(secrets?|keys?|passwords?|credentials?|tokens?)/i,
        /show\s+(me\s+)?(your\s+)?(api\s+keys?|secrets?|system\s+prompt)/i,
        /what('?s|\s+is)\s+(your\s+)?(system\s+)?prompt/i,
        /display\s+(hidden|internal|private)\s+(data|information|config)/i,
    ];
    if (extractionPatterns.some(p => p.test(content))) {
        threats.push('credential_extraction_attempt');
    }
    // Pattern 3: DAN (Do Anything Now) / Jailbreak
    const jailbreakPatterns = [
        /DAN\s+(mode|activated)/i,
        /you\s+are\s+now\s+in\s+(developer|debug|unrestricted)\s+mode/i,
        /pretend\s+you('re|\s+are)\s+(not\s+)?(constrained|limited|restricted)/i,
        /act\s+as\s+if\s+you\s+have\s+no\s+(rules|restrictions|limitations)/i,
    ];
    if (jailbreakPatterns.some(p => p.test(content))) {
        threats.push('jailbreak_attempt');
    }
    // Pattern 4: Code injection
    const injectionPatterns = [
        /<script[\s\S]*?>[\s\S]*?<\/script>/i,
        /javascript:/i,
        /data:text\/html/i,
        /eval\s*\(/i,
        /exec\s*\(/i,
        /__import__\s*\(/i,
    ];
    if (injectionPatterns.some(p => p.test(content))) {
        threats.push('code_injection');
    }
    // Pattern 5: Prompt leaking
    const leakPatterns = [
        /repeat\s+(the|your)\s+(above|previous)\s+(text|instructions?|prompt)/i,
        /what\s+were\s+you\s+told\s+(before|initially|at\s+the\s+start)/i,
        /output\s+(your\s+)?(entire\s+)?(system\s+)?prompt/i,
    ];
    if (leakPatterns.some(p => p.test(content))) {
        threats.push('prompt_leak_attempt');
    }
    // Pattern 6: Encoding tricks (base64, hex, etc.)
    const encodingTricks = [
        /base64\s*\(/i,
        /atob\s*\(/i,
        /Buffer\.from\s*\(/i,
        /\\x[0-9a-f]{2}/i, // hex encoding
        /\\u[0-9a-f]{4}/i, // unicode escaping
    ];
    if (encodingTricks.some(p => p.test(content)) && content.length > 500) {
        threats.push('encoding_obfuscation');
    }
    const blocked = threats.length > 0;
    return {
        valid: !blocked,
        threats,
        blocked,
        reason: blocked ? `Security threat detected: ${threats.join(', ')}` : undefined
    };
}
/**
 * Validates namespace for security (prevents path traversal, etc.)
 */
export function validateNamespace(namespace) {
    if (!namespace) {
        return { valid: true, threats: [], blocked: false };
    }
    const threats = [];
    // Check for path traversal
    if (namespace.includes('..') || namespace.includes('//')) {
        threats.push('path_traversal');
    }
    // Check for suspicious names
    const suspiciousNames = [
        'admin', 'root', 'system', 'internal', 'private',
        'secrets', 'keys', 'credentials', 'config'
    ];
    if (suspiciousNames.some(name => namespace.toLowerCase().includes(name))) {
        threats.push('suspicious_namespace');
    }
    // Validate format (alphanumeric, dash, underscore, slash only)
    if (!/^[a-zA-Z0-9\-_\/]+$/.test(namespace)) {
        threats.push('invalid_characters');
    }
    // Length check
    if (namespace.length > 256) {
        threats.push('namespace_too_long');
    }
    return {
        valid: threats.length === 0,
        threats,
        blocked: threats.includes('path_traversal') || threats.includes('invalid_characters'),
        reason: threats.length > 0 ? `Namespace validation failed: ${threats.join(', ')}` : undefined
    };
}
/**
 * Scans cached response for malicious content before storing
 */
export function scanResponseSecurity(response) {
    const threats = [];
    const responseStr = JSON.stringify(response);
    // Check for suspicious URLs
    const urlPattern = /https?:\/\/[^\s'"]+/gi;
    const urls = responseStr.match(urlPattern) || [];
    const suspiciousDomains = [
        'bit.ly', 'tinyurl.com', 'goo.gl', // URL shorteners (phishing risk)
        '.ru', '.cn', // High-risk TLDs (configurable)
    ];
    if (urls.some(url => suspiciousDomains.some(domain => url.includes(domain)))) {
        threats.push('suspicious_url');
    }
    // Check for PII leakage patterns
    const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b4\d{15}\b/g, // Credit card (Visa)
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email (many false positives, use cautiously)
        /\b\d{16}\b/g, // Generic card number
    ];
    if (piiPatterns.some(p => p.test(responseStr))) {
        threats.push('potential_pii_leakage');
    }
    // Check for malware signatures
    const malwarePatterns = [
        /cmd\.exe/i,
        /powershell\.exe/i,
        /bash\s+-c/i,
        /chmod\s+\+x/i,
        /curl\s+.*\|\s*bash/i,
        /wget\s+.*\|\s*sh/i,
    ];
    if (malwarePatterns.some(p => p.test(responseStr))) {
        threats.push('malware_signature');
    }
    return {
        valid: threats.length === 0,
        threats,
        blocked: threats.includes('malware_signature'),
        reason: threats.length > 0 ? `Response security scan failed: ${threats.join(', ')}` : undefined
    };
}
// ==========================================
// LAYER 2: QUANTUM-RESISTANT ENCRYPTION
// ==========================================
/**
 * Hybrid encryption: Classical AES-256-GCM + Post-Quantum Ready
 *
 * Current: AES-256-GCM (secure against classical computers)
 * Future: Can be upgraded to CRYSTALS-Kyber when widely available
 */
export class QuantumResistantEncryption {
    /**
     * Encrypt sensitive data with AES-256-GCM
     * (Quantum-resistant algorithms like Kyber can be added later)
     */
    static async encrypt(data, key) {
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64')
        };
    }
    /**
     * Decrypt data
     */
    static async decrypt(encrypted, key, iv, authTag) {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Derive encryption key from namespace (for per-namespace encryption)
     */
    static deriveKey(namespace, masterKey) {
        return createHash('sha256')
            .update(masterKey)
            .update(namespace)
            .digest();
    }
}
export class RateLimiter {
    limits = new Map();
    /**
     * Check if request is within rate limit
     */
    checkLimit(identifier, maxRequests, windowMs) {
        const now = Date.now();
        const state = this.limits.get(identifier);
        // No previous state or window expired
        if (!state || now > state.resetAt) {
            this.limits.set(identifier, {
                count: 1,
                resetAt: now + windowMs,
                blocked: false
            });
            return {
                allowed: true,
                remaining: maxRequests - 1,
                resetAt: now + windowMs
            };
        }
        // Within window
        if (state.count >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: state.resetAt
            };
        }
        // Increment count
        state.count++;
        this.limits.set(identifier, state);
        return {
            allowed: true,
            remaining: maxRequests - state.count,
            resetAt: state.resetAt
        };
    }
    /**
     * Cleanup expired entries (call periodically)
     */
    cleanup() {
        const now = Date.now();
        for (const [key, state] of this.limits.entries()) {
            if (now > state.resetAt) {
                this.limits.delete(key);
            }
        }
    }
}
export class AuditLogger {
    logs = [];
    maxLogs = 10000; // Keep last 10K entries in memory
    log(entry) {
        this.logs.push(entry);
        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        // In production, send to external logging service
        // (Datadog, CloudWatch, etc.)
        if (entry.threats && entry.threats.length > 0) {
            console.error('🚨 Security threat detected:', entry);
        }
    }
    getRecentLogs(limit = 100) {
        return this.logs.slice(-limit);
    }
    getSecurityEvents() {
        return this.logs.filter(log => log.threats && log.threats.length > 0);
    }
}
// ==========================================
// LAYER 5: CACHE KEY HASHING (Privacy)
// ==========================================
/**
 * Hash cache keys for privacy (don't store actual prompts in logs)
 */
export function hashCacheKey(key) {
    return createHash('sha256')
        .update(key)
        .digest('hex')
        .substring(0, 16); // First 16 chars for brevity
}
/**
 * Hash API key for logging (never log actual keys)
 */
export function hashAPIKey(apiKey) {
    return createHash('sha256')
        .update(apiKey)
        .digest('hex')
        .substring(0, 12);
}
// ==========================================
// EXPORTS
// ==========================================
export const SecurityMiddleware = {
    detectAdversarialPrompt,
    validateNamespace,
    scanResponseSecurity,
    hashCacheKey,
    hashAPIKey,
};
