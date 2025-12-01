#!/usr/bin/env node

/**
 * Test script for Seagate Lyve Cloud S3 downloads
 * 
 * This script helps diagnose and fix presigned URL issues with Lyve Cloud,
 * particularly region mismatches and signature problems.
 * 
 * Usage:
 *   node scripts/test-lyve-download.js
 * 
 * Environment variables required:
 *   LYVE_ACCESS_KEY_ID - Seagate Lyve Cloud access key
 *   LYVE_SECRET_ACCESS_KEY - Seagate Lyve Cloud secret key
 *   LYVE_ENDPOINT - Lyve Cloud endpoint URL (e.g., https://s3.us-east-1.lyvecloud.seagate.com)
 *   LYVE_BUCKET - Bucket name (e.g., jettydata-prod)
 *   LYVE_REGION - Region (must match endpoint, e.g., us-east-1)
 */

import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash, createHmac } from 'crypto';
import { URL } from 'url';

// Configuration from environment
const config = {
  accessKeyId: process.env.LYVE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.LYVE_SECRET_ACCESS_KEY || '',
  endpoint: process.env.LYVE_ENDPOINT || 'https://s3.us-east-1.lyvecloud.seagate.com',
  bucket: process.env.LYVE_BUCKET || 'jettydata-prod',
  region: process.env.LYVE_REGION || 'us-east-1',
};

/**
 * Generate AWS Signature V4
 */
function generateSignatureV4(params) {
  const { method, url, headers, region, service, accessKeyId, secretAccessKey } = params;
  
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname || '/';
  const canonicalQuerystring = parsedUrl.searchParams.toString();
  
  // Canonical headers
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  
  // Canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  
  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  // Calculate signature
  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  // Authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Authorization': authorization,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'Host': host,
  };
}

/**
 * Generate a presigned URL for downloading
 */
function generatePresignedUrl(key, expiresIn = 3600) {
  const url = `${config.endpoint}/${config.bucket}/${key}`;
  const parsedUrl = new URL(url);
  
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  
  // Build query parameters
  parsedUrl.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsedUrl.searchParams.set('X-Amz-Credential', credential);
  parsedUrl.searchParams.set('X-Amz-Date', amzDate);
  parsedUrl.searchParams.set('X-Amz-Expires', expiresIn.toString());
  parsedUrl.searchParams.set('X-Amz-SignedHeaders', 'host');
  
  // Canonical request for presigned URL
  const canonicalQuerystring = Array.from(parsedUrl.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  
  const canonicalUri = parsedUrl.pathname;
  const canonicalHeaders = `host:${parsedUrl.host}\n`;
  const signedHeaders = 'host';
  
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  
  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  // Calculate signature
  const kDate = createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(config.region).digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  parsedUrl.searchParams.set('X-Amz-Signature', signature);
  
  return parsedUrl.toString();
}

/**
 * Download a file from Lyve Cloud
 */
async function downloadFile(key, outputPath) {
  console.log(`\n📥 Downloading: ${key}`);
  console.log(`   To: ${outputPath}`);
  
  const url = `${config.endpoint}/${config.bucket}/${key}`;
  
  const headers = generateSignatureV4({
    method: 'GET',
    url,
    region: config.region,
    service: 's3',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    await pipeline(response.body, createWriteStream(outputPath));
    console.log(`✅ Download complete: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Download failed: ${error.message}`);
    return false;
  }
}

/**
 * Test presigned URL generation
 */
function testPresignedUrl(key) {
  console.log(`\n🔗 Generating presigned URL for: ${key}`);
  
  const url = generatePresignedUrl(key);
  console.log(`\n${url}\n`);
  
  return url;
}

/**
 * List objects in the bucket
 */
async function listObjects(prefix = '', maxKeys = 10) {
  console.log(`\n📋 Listing objects with prefix: "${prefix}"`);
  
  const params = new URLSearchParams({
    'list-type': '2',
    'max-keys': maxKeys.toString(),
  });
  
  if (prefix) {
    params.set('prefix', prefix);
  }
  
  const url = `${config.endpoint}/${config.bucket}?${params.toString()}`;
  
  const headers = generateSignatureV4({
    method: 'GET',
    url,
    region: config.region,
    service: 's3',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    const xml = await response.text();
    
    // Simple XML parsing for Contents
    const contents = [];
    const keyMatches = xml.matchAll(/<Key>(.*?)<\/Key>/g);
    const sizeMatches = xml.matchAll(/<Size>(.*?)<\/Size>/g);
    
    const keys = Array.from(keyMatches).map(m => m[1]);
    const sizes = Array.from(sizeMatches).map(m => m[1]);
    
    for (let i = 0; i < keys.length; i++) {
      contents.push({
        key: keys[i],
        size: parseInt(sizes[i], 10),
      });
    }
    
    console.log(`\nFound ${contents.length} objects:\n`);
    contents.forEach(({ key, size }) => {
      console.log(`  ${key} (${(size / 1024).toFixed(2)} KB)`);
    });
    
    return contents;
  } catch (error) {
    console.error(`❌ List failed: ${error.message}`);
    return [];
  }
}

/**
 * Validate configuration
 */
function validateConfig() {
  const errors = [];
  
  if (!config.accessKeyId) errors.push('LYVE_ACCESS_KEY_ID is not set');
  if (!config.secretAccessKey) errors.push('LYVE_SECRET_ACCESS_KEY is not set');
  if (!config.endpoint) errors.push('LYVE_ENDPOINT is not set');
  if (!config.bucket) errors.push('LYVE_BUCKET is not set');
  if (!config.region) errors.push('LYVE_REGION is not set');
  
  // Check region/endpoint consistency
  if (config.endpoint && config.region) {
    const endpointRegion = config.endpoint.match(/s3\.([^.]+)\.lyvecloud/)?.[1];
    if (endpointRegion && endpointRegion !== config.region) {
      errors.push(`Region mismatch: endpoint has "${endpointRegion}" but LYVE_REGION is "${config.region}"`);
    }
  }
  
  return errors;
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 Seagate Lyve Cloud Download Test\n');
  console.log('Configuration:');
  console.log(`  Endpoint: ${config.endpoint}`);
  console.log(`  Bucket:   ${config.bucket}`);
  console.log(`  Region:   ${config.region}`);
  console.log(`  Key ID:   ${config.accessKeyId ? '***' + config.accessKeyId.slice(-4) : '(not set)'}`);
  
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:');
    errors.forEach(err => console.error(`   - ${err}`));
    console.error('\nPlease set the required environment variables in .env file or export them:\n');
    console.error('  export LYVE_ACCESS_KEY_ID="your-access-key"');
    console.error('  export LYVE_SECRET_ACCESS_KEY="your-secret-key"');
    console.error('  export LYVE_ENDPOINT="https://s3.us-east-1.lyvecloud.seagate.com"');
    console.error('  export LYVE_BUCKET="jettydata-prod"');
    console.error('  export LYVE_REGION="us-east-1"\n');
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'list') {
    const prefix = args[1] || '';
    await listObjects(prefix);
  } else if (command === 'download') {
    const key = args[1];
    const outputPath = args[2] || `./${key.split('/').pop()}`;
    
    if (!key) {
      console.error('❌ Usage: node test-lyve-download.js download <key> [output-path]');
      process.exit(1);
    }
    
    await downloadFile(key, outputPath);
  } else if (command === 'presigned') {
    const key = args[1];
    
    if (!key) {
      console.error('❌ Usage: node test-lyve-download.js presigned <key>');
      process.exit(1);
    }
    
    testPresignedUrl(key);
  } else {
    console.log('\n📚 Usage:');
    console.log('  node scripts/test-lyve-download.js list [prefix]');
    console.log('  node scripts/test-lyve-download.js download <key> [output-path]');
    console.log('  node scripts/test-lyve-download.js presigned <key>\n');
    console.log('Examples:');
    console.log('  node scripts/test-lyve-download.js list users/2/');
    console.log('  node scripts/test-lyve-download.js download users/2/AUDIO1.TV.PDF ./downloads/audio.pdf');
    console.log('  node scripts/test-lyve-download.js presigned users/2/AUDIO1.TV.PDF\n');
  }
}

main().catch(console.error);
