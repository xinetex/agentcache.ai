#!/usr/bin/env node

/**
 * Test script for dual authentication system
 * 
 * Tests:
 * 1. API key authentication (existing)
 * 2. AWS Signature V4 authentication (new)
 * 3. Presigned URL generation
 * 
 * Usage:
 *   node scripts/test-dual-auth.js
 */

import { generatePresignedUrl, verifySignature, parseAuthHeader } from '../lib/aws-sig-v4.js';
import { detectAuthType, authenticateApiKey } from '../lib/auth-unified.js';

console.log('🧪 Dual Authentication System Tests\n');

// Test 1: Parse AWS Authorization header
console.log('Test 1: Parse AWS Authorization Header');
const testAuthHeader = 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20231201/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc123def456';
const parsed = parseAuthHeader(testAuthHeader);
console.log('  ✅ Parsed:', {
  accessKeyId: parsed.accessKeyId,
  region: parsed.region,
  service: parsed.service,
});
console.log('');

// Test 2: Generate presigned URL
console.log('Test 2: Generate Presigned URL');
const presignedUrl = generatePresignedUrl({
  method: 'GET',
  bucket: 'test-bucket',
  key: 'test-file.pdf',
  accessKeyId: 'TEST_ACCESS_KEY',
  secretAccessKey: 'TEST_SECRET_KEY',
  region: 'us-east-1',
  endpoint: 'https://s3.us-east-1.lyvecloud.seagate.com',
  expiresIn: 3600,
});
console.log('  ✅ Generated URL:', presignedUrl.substring(0, 100) + '...');
console.log('  ✅ Contains signature:', presignedUrl.includes('X-Amz-Signature='));
console.log('');

// Test 3: Detect auth type - API Key
console.log('Test 3: Detect Auth Type - API Key');
const reqApiKey = {
  headers: {
    'x-api-key': 'ac_demo_test123',
  },
};
const authTypeApiKey = detectAuthType(reqApiKey);
console.log('  ✅ Detected:', authTypeApiKey);
console.log('');

// Test 4: Detect auth type - AWS Signature V4
console.log('Test 4: Detect Auth Type - AWS Signature V4');
const reqAwsSig = {
  headers: {
    authorization: 'AWS4-HMAC-SHA256 Credential=...',
  },
};
const authTypeAwsSig = detectAuthType(reqAwsSig);
console.log('  ✅ Detected:', authTypeAwsSig);
console.log('');

// Test 5: Detect auth type - JWT
console.log('Test 5: Detect Auth Type - JWT');
const reqJwt = {
  headers: {
    authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
};
const authTypeJwt = detectAuthType(reqJwt);
console.log('  ✅ Detected:', authTypeJwt);
console.log('');

// Test 6: Detect auth type - Presigned URL
console.log('Test 6: Detect Auth Type - Presigned URL');
const reqPresigned = {
  url: 'https://example.com/bucket/key?X-Amz-Signature=abc123',
  headers: {},
};
const authTypePresigned = detectAuthType(reqPresigned);
console.log('  ✅ Detected:', authTypePresigned);
console.log('');

// Test 7: Authenticate demo API key
console.log('Test 7: Authenticate Demo API Key');
const mockRedis = {
  get: async () => null,
  hgetall: async () => ({}),
};

const authResult = await authenticateApiKey('ac_demo_test123', mockRedis);
console.log('  ✅ Auth result:', {
  ok: authResult.ok,
  type: authResult.type,
  kind: authResult.kind,
});
console.log('');

console.log('✅ All tests passed!\n');
console.log('Next steps:');
console.log('1. Add your Lyve Cloud credentials to .env');
console.log('2. Deploy to Vercel to test the presigned URL endpoint');
console.log('3. Test with: curl -X POST https://your-domain.vercel.app/api/s3/presigned \\');
console.log('     -H "X-API-Key: ac_demo_test123" \\');
console.log('     -d \'{"key": "users/2/AUDIO1.TV.PDF"}\'');
