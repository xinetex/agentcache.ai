# Seagate Lyve Cloud Download Configuration

This guide helps you set up and test downloads from Seagate Lyve Cloud S3-compatible storage.

## Problem

When generating presigned URLs for Lyve Cloud, you may encounter:
```xml
<Error>
  <Code>SignatureDoesNotMatch</Code>
  <Message>The request signature we calculated does not match the signature you provided...</Message>
</Error>
```

**Common causes:**
1. **Region mismatch** - Endpoint region doesn't match credential region
2. **Invalid credentials** - Access key or secret key is incorrect
3. **URL modification** - Presigned URL was altered after generation
4. **Timestamp issues** - System clock is skewed

## Setup

### 1. Get Your Lyve Cloud Credentials

Log into your Seagate Lyve Cloud console and create or retrieve:
- Access Key ID
- Secret Access Key
- Bucket name
- Region (us-east-1, us-west-1, etc.)

### 2. Configure Environment Variables

Copy the template:
```bash
cp .env.lyve .env.local
```

Edit `.env.local` or `.env` and add your credentials:
```bash
LYVE_ACCESS_KEY_ID=STX1AAB7AM0VNPCIHRJHGOE6KPSW
LYVE_SECRET_ACCESS_KEY=your-secret-key-here
LYVE_ENDPOINT=https://s3.us-east-1.lyvecloud.seagate.com
LYVE_BUCKET=jettydata-prod
LYVE_REGION=us-east-1
```

**CRITICAL:** Ensure the region in your endpoint URL matches `LYVE_REGION`:
- ✅ Endpoint: `s3.us-east-1.lyvecloud.seagate.com` + Region: `us-east-1`
- ❌ Endpoint: `s3.us-east-1.lyvecloud.seagate.com` + Region: `us-west-1`

### 3. Load Environment Variables

```bash
# Option 1: Export manually
export LYVE_ACCESS_KEY_ID="your-key"
export LYVE_SECRET_ACCESS_KEY="your-secret"
export LYVE_ENDPOINT="https://s3.us-east-1.lyvecloud.seagate.com"
export LYVE_BUCKET="jettydata-prod"
export LYVE_REGION="us-east-1"

# Option 2: Use dotenv (if you have a .env file)
source .env
```

## Testing

The test script provides three main commands:

### List Files

List objects in your bucket:
```bash
node scripts/test-lyve-download.js list
```

List objects with a prefix:
```bash
node scripts/test-lyve-download.js list users/2/
```

### Download Files

Download a file directly (with proper authentication):
```bash
node scripts/test-lyve-download.js download users/2/AUDIO1.TV.PDF ./downloads/audio.pdf
```

This uses AWS Signature V4 authentication and handles all the signing for you.

### Generate Presigned URLs

Generate a presigned URL that can be shared or used in browsers:
```bash
node scripts/test-lyve-download.js presigned users/2/AUDIO1.TV.PDF
```

The URL will be valid for 1 hour (3600 seconds) by default.

## How It Works

### AWS Signature V4

The script implements AWS Signature V4 authentication for Lyve Cloud. The process:

1. **Canonical Request** - Normalize the HTTP request
2. **String to Sign** - Create a string with request metadata
3. **Signing Key** - Derive a signing key from your secret key
4. **Signature** - Calculate HMAC-SHA256 signature
5. **Authorization Header** - Add signature to request

### Presigned URLs

For presigned URLs:
- All authentication parameters are embedded in the query string
- The signature is calculated over the entire URL
- URLs expire after the specified time (default: 1 hour)
- No additional headers are needed when using the URL

### Region Consistency

The signature calculation uses the region parameter. If your endpoint says `us-east-1` but your region is `us-west-1`, the signature will be invalid.

## Troubleshooting

### "SignatureDoesNotMatch" Error

1. **Check region consistency:**
   ```bash
   echo $LYVE_ENDPOINT
   echo $LYVE_REGION
   ```
   The region in the endpoint URL must match `LYVE_REGION`.

2. **Verify credentials:**
   ```bash
   node scripts/test-lyve-download.js list
   ```
   If this fails, your credentials are likely incorrect.

3. **Check system time:**
   ```bash
   date
   ```
   If your system clock is significantly off, signatures will fail.

### "Access Denied" Error

- Your credentials don't have permission for the bucket/object
- Check IAM policies in Lyve Cloud console

### "NoSuchBucket" Error

- Bucket name is incorrect
- Bucket is in a different region

### Connection Timeout

- Check network connectivity
- Verify firewall rules allow HTTPS to *.lyvecloud.seagate.com

## Integration with Your App

### Generating Presigned URLs in Your Code

```javascript
import { createHash, createHmac } from 'crypto';

function generatePresignedUrl(key, config, expiresIn = 3600) {
  const url = `${config.endpoint}/${config.bucket}/${key}`;
  const parsedUrl = new URL(url);
  
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, '');
  
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  
  // Add query parameters
  parsedUrl.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsedUrl.searchParams.set('X-Amz-Credential', credential);
  parsedUrl.searchParams.set('X-Amz-Date', amzDate);
  parsedUrl.searchParams.set('X-Amz-Expires', expiresIn.toString());
  parsedUrl.searchParams.set('X-Amz-SignedHeaders', 'host');
  
  // Calculate signature (see full implementation in test-lyve-download.js)
  // ...
  
  return parsedUrl.toString();
}
```

### Direct Downloads with Authentication

```javascript
async function downloadFromLyve(key, config) {
  const url = `${config.endpoint}/${config.bucket}/${key}`;
  
  const headers = generateSignatureV4({
    method: 'GET',
    url,
    region: config.region,
    service: 's3',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  
  const response = await fetch(url, { headers });
  return response;
}
```

## Security Notes

1. **Never commit credentials** - Keep `.env` files out of version control
2. **Use presigned URLs carefully** - They grant temporary access to private files
3. **Set appropriate expiration** - Shorter is more secure
4. **Rotate credentials regularly** - Follow security best practices
5. **Use IAM policies** - Limit access to only what's needed

## Next Steps

1. Test the script with your credentials
2. Integrate presigned URL generation into your app
3. Set up proper credential management (AWS Secrets Manager, environment variables, etc.)
4. Implement error handling and retry logic
5. Monitor usage and costs in Lyve Cloud console

## Resources

- [Seagate Lyve Cloud Documentation](https://www.seagate.com/products/storage/cloud/)
- [AWS Signature V4 Specification](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html)
- [S3 API Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/)
