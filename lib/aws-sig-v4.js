/**
 * AWS Signature Version 4 Authentication
 * 
 * Validates AWS Signature V4 requests for S3-compatible API compatibility.
 * This allows standard AWS tools (SDK, CLI, etc.) to work with AgentCache.
 */

import { createHash, createHmac } from 'crypto';

/**
 * Parse Authorization header for AWS Signature V4
 * 
 * Format: AWS4-HMAC-SHA256 Credential=AKID/20231201/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc123
 */
export function parseAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('AWS4-HMAC-SHA256')) {
    return null;
  }

  const parts = authHeader.substring('AWS4-HMAC-SHA256 '.length).split(', ');
  const parsed = {};

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 'Credential') {
      const credParts = value.split('/');
      parsed.accessKeyId = credParts[0];
      parsed.date = credParts[1];
      parsed.region = credParts[2];
      parsed.service = credParts[3];
      parsed.requestType = credParts[4];
    } else if (key === 'SignedHeaders') {
      parsed.signedHeaders = value.split(';');
    } else if (key === 'Signature') {
      parsed.signature = value;
    }
  }

  return parsed;
}

/**
 * Build canonical request
 * 
 * Format:
 * HTTP_METHOD\n
 * CANONICAL_URI\n
 * CANONICAL_QUERY_STRING\n
 * CANONICAL_HEADERS\n
 * SIGNED_HEADERS\n
 * HASHED_PAYLOAD
 */
export function buildCanonicalRequest(req, signedHeaders, hashedPayload = 'UNSIGNED-PAYLOAD') {
  const method = req.method || 'GET';
  
  // Parse URL for path and query string
  const url = new URL(req.url, `https://${req.headers.host || req.headers.Host}`);
  const canonicalUri = url.pathname || '/';
  
  // Build canonical query string (sorted)
  const queryParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Build canonical headers (sorted, lowercase)
  const canonicalHeaders = signedHeaders
    .sort()
    .map(header => {
      const value = req.headers[header] || req.headers[header.toLowerCase()] || '';
      return `${header.toLowerCase()}:${value.trim()}`;
    })
    .join('\n') + '\n';

  const signedHeadersList = signedHeaders.map(h => h.toLowerCase()).sort().join(';');

  return [
    method,
    canonicalUri,
    queryParams,
    canonicalHeaders,
    signedHeadersList,
    hashedPayload
  ].join('\n');
}

/**
 * Build string to sign
 * 
 * Format:
 * AWS4-HMAC-SHA256\n
 * TIMESTAMP\n
 * SCOPE\n
 * HASHED_CANONICAL_REQUEST
 */
export function buildStringToSign(timestamp, credentialScope, canonicalRequest) {
  const hashedRequest = createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');

  return [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    hashedRequest
  ].join('\n');
}

/**
 * Calculate signing key
 * 
 * Derives a signing key from the secret access key using HMAC-SHA256
 */
export function calculateSigningKey(secretKey, date, region, service) {
  const kDate = createHmac('sha256', `AWS4${secretKey}`)
    .update(date)
    .digest();

  const kRegion = createHmac('sha256', kDate)
    .update(region)
    .digest();

  const kService = createHmac('sha256', kRegion)
    .update(service)
    .digest();

  const kSigning = createHmac('sha256', kService)
    .update('aws4_request')
    .digest();

  return kSigning;
}

/**
 * Calculate signature
 */
export function calculateSignature(signingKey, stringToSign) {
  return createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');
}

/**
 * Verify AWS Signature V4 request
 * 
 * @param {Request} req - HTTP request object
 * @param {string} secretAccessKey - AWS secret access key
 * @returns {boolean} - True if signature is valid
 */
export function verifySignature(req, secretAccessKey) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return false;
  }

  // Parse authorization header
  const parsed = parseAuthHeader(authHeader);
  if (!parsed) {
    return false;
  }

  // Get timestamp from x-amz-date header
  const amzDate = req.headers['x-amz-date'] || req.headers['X-Amz-Date'];
  if (!amzDate) {
    return false;
  }

  // Get hashed payload
  const hashedPayload = req.headers['x-amz-content-sha256'] || 
                        req.headers['X-Amz-Content-Sha256'] || 
                        'UNSIGNED-PAYLOAD';

  // Build credential scope
  const credentialScope = `${parsed.date}/${parsed.region}/${parsed.service}/aws4_request`;

  // Build canonical request
  const canonicalRequest = buildCanonicalRequest(req, parsed.signedHeaders, hashedPayload);

  // Build string to sign
  const stringToSign = buildStringToSign(amzDate, credentialScope, canonicalRequest);

  // Calculate signing key
  const signingKey = calculateSigningKey(
    secretAccessKey,
    parsed.date,
    parsed.region,
    parsed.service
  );

  // Calculate expected signature
  const expectedSignature = calculateSignature(signingKey, stringToSign);

  // Compare signatures (constant-time comparison to prevent timing attacks)
  return timingSafeEqual(expectedSignature, parsed.signature);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate presigned URL for S3-compatible storage
 * 
 * @param {object} params - Configuration
 * @param {string} params.method - HTTP method (GET, PUT, etc.)
 * @param {string} params.bucket - Bucket name
 * @param {string} params.key - Object key
 * @param {string} params.accessKeyId - AWS access key ID
 * @param {string} params.secretAccessKey - AWS secret access key
 * @param {string} params.region - AWS region
 * @param {string} params.endpoint - S3 endpoint URL
 * @param {number} params.expiresIn - Expiration time in seconds (default: 3600)
 * @returns {string} - Presigned URL
 */
export function generatePresignedUrl(params) {
  const {
    method = 'GET',
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    expiresIn = 3600
  } = params;

  const url = `${endpoint}/${bucket}/${key}`;
  const parsedUrl = new URL(url);

  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  // Add query parameters
  parsedUrl.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsedUrl.searchParams.set('X-Amz-Credential', credential);
  parsedUrl.searchParams.set('X-Amz-Date', amzDate);
  parsedUrl.searchParams.set('X-Amz-Expires', expiresIn.toString());
  parsedUrl.searchParams.set('X-Amz-SignedHeaders', 'host');

  // Build canonical query string (sorted)
  const canonicalQuerystring = Array.from(parsedUrl.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Canonical request for presigned URL
  const canonicalUri = parsedUrl.pathname;
  const canonicalHeaders = `host:${parsedUrl.host}\n`;
  const signedHeaders = 'host';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  // String to sign
  const stringToSign = buildStringToSign(amzDate, credentialScope, canonicalRequest);

  // Calculate signature
  const signingKey = calculateSigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = calculateSignature(signingKey, stringToSign);

  // Add signature to URL
  parsedUrl.searchParams.set('X-Amz-Signature', signature);

  return parsedUrl.toString();
}

/**
 * Extract access key ID from request
 * Works with both Authorization header and query string (presigned URLs)
 */
export function extractAccessKeyId(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('AWS4-HMAC-SHA256')) {
    const parsed = parseAuthHeader(authHeader);
    return parsed?.accessKeyId || null;
  }

  // Check query string (presigned URL)
  const url = new URL(req.url, `https://${req.headers.host || req.headers.Host}`);
  const credential = url.searchParams.get('X-Amz-Credential');
  if (credential) {
    return credential.split('/')[0];
  }

  return null;
}
