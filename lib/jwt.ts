import jwt from 'jsonwebtoken';

/**
 * JWT Utilities for AgentCache Customer Portal
 * Handles token generation, verification, and refresh
 */

const JWT_SECRET = process.env.JWT_SECRET;
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

  const payload = {
    userId: user.id,
    email: user.email,
    organizationId: user.organization_id || null,
    role: user.role || 'member',
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET || 'dev-secret-change-me', {
      issuer: 'agentcache.ai',
      audience: 'customer-portal',
    });

    return {
      userId: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('Token expired:', error.message);
      return null;
    }
    if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token:', error.message);
      return null;
    }
    console.error('Token verification error:', error);
    return null;
  }
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
