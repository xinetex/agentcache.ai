import jwt from 'jsonwebtoken';

/**
 * JWT Utilities for AgentCache Customer Portal
 * Handles token generation, verification, and refresh
 */

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRETS = Array.from(new Set([
  JWT_SECRET,
  'dev-secret-change-me',
  'dev_secret_do_not_use_in_prod',
].filter(Boolean)));
const TOKEN_EXPIRY = '7d'; // 7 days

if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set - using development fallback (INSECURE FOR PRODUCTION)');
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object from database
 * @param {string} user.id - User ID
 * @param {string} user.email - User email
 * @param {string} user.organization_id - Organization ID
 * @param {string} user.role - User role (owner, admin, member, viewer)
 * @returns {string} JWT token
 */
export function generateToken(user) {
  if (!user || !user.id) {
    throw new Error('Invalid user object for token generation');
  }

  const organizationId = user.organization_id || user.organizationId || user.orgId || null;
  const payload = {
    userId: user.id,
    email: user.email,
    organizationId,
    role: user.role || 'member',
    plan: user.plan || null,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET || 'dev-secret-change-me', {
    expiresIn: TOKEN_EXPIRY,
    issuer: 'agentcache.ai',
    audience: 'customer-portal',
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  if (!token) {
    return null;
  }

  const normalizeDecoded = (decoded) => ({
    userId: decoded.userId || decoded.id || null,
    email: decoded.email || null,
    organizationId:
      decoded.organizationId ||
      decoded.organization_id ||
      decoded.orgId ||
      decoded.org_id ||
      null,
    role: decoded.role || 'member',
    plan: decoded.plan || null,
    iat: decoded.iat,
    exp: decoded.exp,
  });

  let lastError = null;

  for (const secret of JWT_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'agentcache.ai',
        audience: 'customer-portal',
      });
      return normalizeDecoded(decoded);
    } catch (error) {
      lastError = error;
    }

    try {
      // Accept newer internal JWTs that share a secret but omit customer-portal claims.
      const decoded = jwt.verify(token, secret);
      return normalizeDecoded(decoded);
    } catch (error) {
      lastError = error;
    }
  }

  const error = lastError;
  if (error?.name === 'TokenExpiredError') {
    console.log('Token expired:', error.message);
    return null;
  }
  if (error?.name === 'JsonWebTokenError') {
    console.log('Invalid token:', error.message);
    return null;
  }

  if (error) {
    console.error('Token verification error:', error);
  }
  return null;
}

/**
 * Refresh a token (generate new token from valid existing token)
 * @param {string} token - Existing valid JWT token
 * @returns {string|null} New JWT token or null if original invalid
 */
export function refreshToken(token) {
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return null;
  }

  // Generate new token with same payload
  const user = {
    id: decoded.userId,
    email: decoded.email,
    organization_id: decoded.organizationId,
    role: decoded.role,
    plan: decoded.plan,
  };

  return generateToken(user);
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token string or null
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer TOKEN" and just "TOKEN"
  const parts = authHeader.split(' ');
  
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  
  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

/**
 * Check if token is expiring soon (within 1 day)
 * @param {Object} decoded - Decoded token payload
 * @returns {boolean} True if expiring within 1 day
 */
export function isTokenExpiringSoon(decoded) {
  if (!decoded || !decoded.exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = decoded.exp - now;
  const oneDayInSeconds = 24 * 60 * 60;

  return timeUntilExpiry < oneDayInSeconds;
}

/**
 * Generate a JWT secret (for initial setup)
 * @returns {string} Random 32-byte base64 secret
 */
export function generateJWTSecret() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64');
}

export default {
  generateToken,
  verifyToken,
  refreshToken,
  extractTokenFromHeader,
  isTokenExpiringSoon,
  generateJWTSecret,
};
