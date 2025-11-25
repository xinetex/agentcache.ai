/**
 * API Key Management
 * Generate, validate, and revoke API keys for user access
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getUserFromRequest } from './auth.js';

const sql = neon(process.env.DATABASE_URL);

/**
 * Generate a secure API key
 */
function generateAPIKey(prefix = 'sk_live') {
  const random = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${random}`;
}

/**
 * Validate API key from request headers
 * Returns user and key metadata
 */
export async function validateAPIKey(apiKey) {
  if (!apiKey) {
    return { valid: false, error: 'No API key provided' };
  }
  
  try {
    // Extract prefix for quick lookup
    const prefix = apiKey.substring(0, 16);
    
    // Hash the key for comparison
    const keyHash = await bcrypt.hash(apiKey, 10);
    
    // Find active key
    const keys = await sql`
      SELECT 
        k.id,
        k.user_id,
        k.key_hash,
        k.scopes,
        k.allowed_namespaces,
        k.is_active,
        u.email,
        u.stripe_customer_id,
        s.plan_tier
      FROM api_keys k
      JOIN users u ON k.user_id = u.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE k.key_prefix = ${prefix}
        AND k.is_active = TRUE
        AND (k.expires_at IS NULL OR k.expires_at > NOW())
      LIMIT 1
    `;
    
    if (keys.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    const key = keys[0];
    
    // Verify hash (in production, use constant-time comparison)
    const isValid = await bcrypt.compare(apiKey, key.key_hash);
    
    if (!isValid) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    // Update usage stats
    await sql`
      UPDATE api_keys
      SET 
        last_used_at = NOW(),
        request_count = request_count + 1
      WHERE id = ${key.id}
    `;
    
    return {
      valid: true,
      key_id: key.id,
      user: {
        id: key.user_id,
        email: key.email,
        plan: key.plan_tier || 'starter'
      },
      scopes: key.scopes || ['cache:read', 'cache:write'],
      namespaces: key.allowed_namespaces || ['*']
    };
    
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Require authentication
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  const { method, url } = req;
  const path = url.split('?')[0];
  const pathParts = path.split('/').filter(Boolean);
  
  try {
    // GET /api/keys - List user's API keys
    if (method === 'GET' && path === '/api/keys') {
      const keys = await sql`
        SELECT 
          id,
          key_prefix,
          name,
          scopes,
          allowed_namespaces,
          created_at,
          last_used_at,
          request_count,
          expires_at,
          is_active
        FROM api_keys
        WHERE user_id = ${user.id}
          AND is_active = TRUE
        ORDER BY created_at DESC
      `;
      
      return res.status(200).json({
        keys: keys.map(k => ({
          id: k.id,
          prefix: k.key_prefix,
          name: k.name,
          scopes: k.scopes,
          namespaces: k.allowed_namespaces,
          created_at: k.created_at,
          last_used_at: k.last_used_at,
          request_count: parseInt(k.request_count),
          expires_at: k.expires_at
        }))
      });
    }
    
    // POST /api/keys - Generate new API key
    if (method === 'POST' && path === '/api/keys') {
      const { name, scopes, namespaces, expires_days } = req.body;
      
      // Check plan limits
      const keyCount = await sql`
        SELECT COUNT(*) as count
        FROM api_keys
        WHERE user_id = ${user.id} AND is_active = TRUE
      `;
      
      const limits = {
        starter: 2,
        professional: 10,
        enterprise: 100
      };
      
      const userPlan = user.plan || 'starter';
      if (parseInt(keyCount[0].count) >= limits[userPlan]) {
        return res.status(403).json({
          error: 'Plan limit exceeded',
          message: `Your ${userPlan} plan allows ${limits[userPlan]} API keys`,
          current: parseInt(keyCount[0].count),
          limit: limits[userPlan]
        });
      }
      
      // Generate key
      const apiKey = generateAPIKey('sk_live');
      const prefix = apiKey.substring(0, 16);
      const keyHash = await bcrypt.hash(apiKey, 10);
      
      // Store hashed key
      const newKeys = await sql`
        INSERT INTO api_keys (
          user_id,
          key_hash,
          key_prefix,
          name,
          scopes,
          allowed_namespaces,
          expires_at
        )
        VALUES (
          ${user.id},
          ${keyHash},
          ${prefix},
          ${name || 'Unnamed Key'},
          ${JSON.stringify(scopes || ['cache:read', 'cache:write'])},
          ${JSON.stringify(namespaces || ['*'])},
          ${expires_days ? `NOW() + INTERVAL '${expires_days} days'` : null}
        )
        RETURNING id, key_prefix, name, created_at
      `;
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES (
          ${user.id},
          'api_key.created',
          'api_key',
          ${newKeys[0].id},
          ${JSON.stringify({ name, scopes, namespaces })}
        )
      `;
      
      // Return full key ONCE (user must save it)
      return res.status(201).json({
        key: {
          id: newKeys[0].id,
          name: newKeys[0].name,
          prefix: newKeys[0].key_prefix,
          created_at: newKeys[0].created_at
        },
        api_key: apiKey, // ONLY TIME THIS IS SHOWN
        warning: 'Save this key now. You will not be able to see it again.'
      });
    }
    
    // DELETE /api/keys/:id - Revoke API key
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'keys') {
      const keyId = pathParts[2];
      
      // Verify ownership
      const existing = await sql`
        SELECT id, name FROM api_keys
        WHERE id = ${keyId} AND user_id = ${user.id}
      `;
      
      if (existing.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      }
      
      // Soft delete (revoke)
      await sql`
        UPDATE api_keys
        SET 
          is_active = FALSE,
          revoked_at = NOW()
        WHERE id = ${keyId}
      `;
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES (
          ${user.id},
          'api_key.revoked',
          'api_key',
          ${keyId},
          ${JSON.stringify({ name: existing[0].name })}
        )
      `;
      
      return res.status(200).json({
        message: 'API key revoked successfully'
      });
    }
    
    // POST /api/keys/:id/rotate - Rotate API key
    if (method === 'POST' && pathParts.length === 4 && pathParts[1] === 'keys' && pathParts[3] === 'rotate') {
      const keyId = pathParts[2];
      
      // Verify ownership
      const existing = await sql`
        SELECT id, name, scopes, allowed_namespaces
        FROM api_keys
        WHERE id = ${keyId} AND user_id = ${user.id} AND is_active = TRUE
      `;
      
      if (existing.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'API key not found'
        });
      }
      
      const oldKey = existing[0];
      
      // Generate new key
      const newApiKey = generateAPIKey('sk_live');
      const newPrefix = newApiKey.substring(0, 16);
      const newKeyHash = await bcrypt.hash(newApiKey, 10);
      
      // Revoke old key
      await sql`
        UPDATE api_keys
        SET is_active = FALSE, revoked_at = NOW()
        WHERE id = ${keyId}
      `;
      
      // Create new key with same permissions
      const rotated = await sql`
        INSERT INTO api_keys (
          user_id,
          key_hash,
          key_prefix,
          name,
          scopes,
          allowed_namespaces
        )
        VALUES (
          ${user.id},
          ${newKeyHash},
          ${newPrefix},
          ${oldKey.name} || ' (rotated)',
          ${oldKey.scopes},
          ${oldKey.allowed_namespaces}
        )
        RETURNING id, key_prefix, name, created_at
      `;
      
      // Log audit event
      await sql`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES (
          ${user.id},
          'api_key.rotated',
          'api_key',
          ${rotated[0].id},
          ${JSON.stringify({ old_key_id: keyId })}
        )
      `;
      
      return res.status(200).json({
        key: {
          id: rotated[0].id,
          name: rotated[0].name,
          prefix: rotated[0].key_prefix,
          created_at: rotated[0].created_at
        },
        api_key: newApiKey,
        warning: 'Save this key now. The old key has been revoked.'
      });
    }
    
    // Route not found
    return res.status(404).json({
      error: 'Not found',
      message: 'API key endpoint not found'
    });
    
  } catch (error) {
    console.error('API keys error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
