# Dual Authentication System

AgentCache supports **three authentication methods** for maximum flexibility and compatibility:

1. **API Keys** - Simple, fast authentication for AgentCache clients
2. **AWS Signature V4** - S3-compatible authentication for standard tools
3. **JWT Bearer Tokens** - Session-based user authentication (future)

## Why Dual Authentication?

### Backward Compatibility
- Existing `ac_demo_*` and `ac_live_*` API keys continue to work
- No breaking changes for current users
- Zero migration required

### AWS Ecosystem Support
- Use AWS CLI, SDKs (boto3, aws-sdk-js, etc.)
- Work with standard tools: s3cmd, rclone, Cyberduck
- Compatible with existing S3 workflows

### Innovation Layer
- Custom caching on top of S3 API
- Better performance than raw AWS/Lyve Cloud
- Unified analytics across all auth methods
- Lower costs through edge optimization

## Authentication Methods

### 1. API Key Authentication

**Current AgentCache system** - Simple and fast.

**Request:**
```bash
curl -X POST https://agentcache.ai/api/s3/presigned \
  -H "X-API-Key: ac_demo_test123" \
  -d '{"key": "users/2/file.pdf"}'
```

**Formats supported:**
- `X-API-Key: ac_demo_*` (demo keys, unlimited)
- `X-API-Key: ac_live_*` (live keys, quota enforced)
- `Authorization: Bearer ac_live_*` (alternative)

### 2. AWS Signature V4

**S3-compatible authentication** - Works with all AWS tools.

**Example with AWS CLI:**
```bash
# Configure credentials
aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY

# Use with custom endpoint
aws s3 ls s3://jettydata-prod/users/2/ \
  --endpoint-url https://agentcache.ai/api/s3
```

**Example with boto3 (Python):**
```python
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='https://agentcache.ai/api/s3',
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY'
)

# Generate presigned URL
url = s3.generate_presigned_url(
    'get_object',
    Params={'Bucket': 'jettydata-prod', 'Key': 'users/2/file.pdf'},
    ExpiresIn=3600
)
```

**How it works:**
1. Request includes `Authorization: AWS4-HMAC-SHA256 Credential=...`
2. System extracts access key ID
3. Looks up secret key in Redis
4. Verifies signature matches
5. Returns success or error

### 3. JWT Bearer Tokens

**User session authentication** - For dashboard/UI access.

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUz..." \
  https://agentcache.ai/api/dashboard
```

_(Not fully implemented yet - Phase 2)_

## API Endpoints

### Generate Presigned URL

**Endpoint:** `POST /api/s3/presigned`

**Authentication:** API Key or AWS Signature V4

**Request:**
```json
{
  "key": "users/2/AUDIO1.TV.PDF",
  "bucket": "jettydata-prod",
  "expires_in": 3600,
  "method": "GET"
}
```

**Response:**
```json
{
  "url": "https://s3.us-east-1.lyvecloud.seagate.com/jettydata-prod/users/2/AUDIO1.TV.PDF?X-Amz-Algorithm=...",
  "expires_in": 3600,
  "expires_at": "2023-12-01T13:00:00Z",
  "bucket": "jettydata-prod",
  "key": "users/2/AUDIO1.TV.PDF",
  "method": "GET"
}
```

**Example:**
```bash
curl -X POST https://agentcache.ai/api/s3/presigned \
  -H "X-API-Key: ac_demo_test123" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "users/2/AUDIO1.TV.PDF",
    "expires_in": 7200
  }'
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Seagate Lyve Cloud credentials
LYVE_ACCESS_KEY_ID=STX1AAB7AM0VNPCIHRJHGOE6KPSW
LYVE_SECRET_ACCESS_KEY=your-secret-key
LYVE_ENDPOINT=https://s3.us-east-1.lyvecloud.seagate.com
LYVE_BUCKET=jettydata-prod
LYVE_REGION=us-east-1
```

**Important:** The region in `LYVE_ENDPOINT` must match `LYVE_REGION`!

### Redis Key Structure

**API Keys (existing):**
```
usage:{hash}                  - Key metadata (quota, etc.)
usage:{hash}:m:{YYYY-MM}      - Monthly usage counter
key:{hash}/email              - Email associated with key
```

**AWS Access Keys (new):**
```
aws:accesskey:{access_key_id}        - Secret key (hashed)
aws:accesskey:{access_key_id}:user   - User ID
aws:accesskey:{access_key_id}:email  - User email
```

## Implementation Details

### Authentication Flow

```
Request arrives
    ↓
Detect auth type (API key, AWS sig, JWT)
    ↓
Extract credentials
    ↓
Validate against Redis
    ↓
Return auth context
```

### Files

- `lib/aws-sig-v4.js` - AWS Signature V4 implementation
- `lib/auth-unified.js` - Unified auth middleware
- `api/s3/presigned.js` - Presigned URL endpoint

### Testing

Run tests:
```bash
node scripts/test-dual-auth.js
```

All tests should pass before deployment.

## Migration Guide

### For Existing Users

**No changes required!** Your existing API keys work exactly as before.

### Adding AWS Authentication

1. Generate AWS-style access keys (admin feature - coming soon)
2. Store in Redis:
   ```bash
   redis-cli SET aws:accesskey:YOUR_KEY_ID your_secret_key
   redis-cli SET aws:accesskey:YOUR_KEY_ID:user user_id
   ```
3. Use with any S3-compatible tool

## Use Cases

### 1. Simple API Access
Use API keys for quick, simple authentication:
```bash
curl -H "X-API-Key: ac_demo_test123" https://agentcache.ai/api/cache/get
```

### 2. S3 Tool Integration
Use AWS Signature V4 with standard tools:
```bash
aws s3 sync ./local-dir s3://bucket/prefix \
  --endpoint-url https://agentcache.ai/api/s3
```

### 3. Presigned URLs
Generate shareable URLs:
```bash
curl -X POST https://agentcache.ai/api/s3/presigned \
  -H "X-API-Key: ac_live_xyz" \
  -d '{"key": "public/video.mp4", "expires_in": 3600}'
```

## Security

### Best Practices

1. **Never commit credentials** - Use environment variables
2. **Rotate keys regularly** - Especially secret keys
3. **Use short expiration** - For presigned URLs (1-6 hours)
4. **Monitor usage** - Track API key and AWS key usage
5. **Rate limiting** - Applies to all auth types

### Signature Verification

AWS Signature V4 uses:
- HMAC-SHA256 cryptographic signing
- Timestamp validation (prevents replay)
- Timing-safe comparison (prevents timing attacks)
- Request integrity (signature changes if request modified)

## Roadmap

### Phase 1: AWS Signature V4 Support ✅
- [x] Signature validation library
- [x] Unified auth middleware
- [x] Presigned URL generation
- [x] Environment configuration

### Phase 2: S3 API Endpoints (In Progress)
- [ ] GET /api/s3/{bucket}/{key}
- [ ] PUT /api/s3/{bucket}/{key}
- [ ] HEAD /api/s3/{bucket}/{key}
- [ ] GET /api/s3/{bucket}?list-type=2

### Phase 3: Admin Features
- [ ] Generate AWS access keys via dashboard
- [ ] View auth method breakdown in analytics
- [ ] Manage multiple credentials per user
- [ ] IAM-style policies

## Troubleshooting

### "Invalid signature" Error

1. Check region/endpoint consistency:
   ```bash
   echo $LYVE_ENDPOINT
   echo $LYVE_REGION
   ```

2. Verify credentials are correct

3. Check system time (signature includes timestamp)

### "Missing AWS access key ID"

The Authorization header is missing or malformed. Ensure it starts with `AWS4-HMAC-SHA256`.

### "Service configuration error"

`LYVE_ACCESS_KEY_ID` or `LYVE_SECRET_ACCESS_KEY` not set in environment.

## Resources

- [AWS Signature V4 Specification](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html)
- [S3 API Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/)
- [Seagate Lyve Cloud Docs](https://www.seagate.com/products/storage/cloud/)
