# Customer Credentials Template

**For**: Providing credentials to enterprise customers (e.g., JettyThunder)  
**When**: After completing customer onboarding/provisioning

## JettyThunder Onboarding Credentials

### Production API Access

```bash
# AgentCache API Credentials
AGENTCACHE_API_KEY=ac_live_jettythunder_[generated_key]
AGENTCACHE_BASE_URL=https://agentcache.ai
AGENTCACHE_ORG_ID=org_jettythunder

# Pre-configured Namespaces (filestorage sector)
AGENTCACHE_NAMESPACE_STORAGE=jt_storage      # Main file operations
AGENTCACHE_NAMESPACE_CDN=jt_cdn              # CDN/edge caching
AGENTCACHE_NAMESPACE_METADATA=jt_metadata    # File metadata/search
```

### Customer Portal Access

```bash
# Login URL
PORTAL_URL=https://agentcache.ai/portal/login

# Admin credentials (send securely)
EMAIL=admin@jettythunder.app
TEMP_PASSWORD=[generated_secure_password]
# Note: Admin must change password on first login
```

### Integration Endpoints

```bash
# Cache Operations
GET  https://agentcache.ai/api/cache/get?key={key}
POST https://agentcache.ai/api/cache/set

# Headers Required:
X-API-Key: ac_live_jettythunder_[key]
X-Cache-Namespace: jt_storage  # or jt_cdn, jt_metadata
Content-Type: application/json
```

## Quick Start Integration

### 1. Test Connection
```bash
curl https://agentcache.ai/api/cache/get?key=test \
  -H "X-API-Key: ac_live_jettythunder_[key]" \
  -H "X-Cache-Namespace: jt_storage"
  
# Expected: 404 (key not found) or 200 (success)
# Error: 401 means invalid API key
# Error: 403 means namespace not allowed
```

### 2. Set a Value
```bash
curl -X POST https://agentcache.ai/api/cache/set \
  -H "X-API-Key: ac_live_jettythunder_[key]" \
  -H "X-Cache-Namespace: jt_storage" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "test-file-123",
    "value": "cached file data",
    "ttl": 3600
  }'
```

### 3. Get the Value
```bash
curl https://agentcache.ai/api/cache/get?key=test-file-123 \
  -H "X-API-Key: ac_live_jettythunder_[key]" \
  -H "X-Cache-Namespace: jt_storage"
```

## SDK Integration Examples

### Node.js/TypeScript
```typescript
import { AgentCache } from '@agentcache/sdk';

const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  baseURL: process.env.AGENTCACHE_BASE_URL,
  namespace: 'jt_storage' // default namespace
});

// Use in your app
const fileData = await cache.get('file-123');
if (!fileData) {
  fileData = await fetchFromLyve('file-123');
  await cache.set('file-123', fileData, { ttl: 3600 });
}
```

### Python
```python
from agentcache import AgentCache

cache = AgentCache(
    api_key=os.environ['AGENTCACHE_API_KEY'],
    base_url=os.environ['AGENTCACHE_BASE_URL'],
    namespace='jt_storage'
)

# Use in your app
file_data = cache.get('file-123')
if not file_data:
    file_data = fetch_from_lyve('file-123')
    cache.set('file-123', file_data, ttl=3600)
```

### cURL (for testing)
```bash
# Set these in your environment
export AGENTCACHE_API_KEY=ac_live_jettythunder_[key]
export AGENTCACHE_BASE_URL=https://agentcache.ai
export AGENTCACHE_NAMESPACE=jt_storage

# Now you can use them
curl $AGENTCACHE_BASE_URL/api/cache/get?key=mykey \
  -H "X-API-Key: $AGENTCACHE_API_KEY" \
  -H "X-Cache-Namespace: $AGENTCACHE_NAMESPACE"
```

## Namespace Usage Guide

### `jt_storage` - Main File Operations
Use for caching:
- File content/blobs
- Seagate Lyve API responses
- File metadata (small objects)
- Directory listings

```typescript
await cache.set('file-abc123', fileContent, { 
  namespace: 'jt_storage',
  ttl: 3600 
});
```

### `jt_cdn` - CDN/Edge Caching
Use for caching:
- Frequently accessed files
- Public assets
- Thumbnails/previews
- API responses for end users

```typescript
await cache.set('thumbnail-xyz', imageData, { 
  namespace: 'jt_cdn',
  ttl: 86400 // 24 hours
});
```

### `jt_metadata` - File Metadata/Search
Use for caching:
- File search results
- Metadata queries
- Permission checks
- User file lists

```typescript
await cache.set('user-files-list-123', fileList, { 
  namespace: 'jt_metadata',
  ttl: 300 // 5 minutes
});
```

## Security Best Practices

### ✅ DO:
- Store API key in environment variables (never hardcode)
- Use different namespaces for different data types
- Set appropriate TTLs (don't cache forever)
- Rotate API keys quarterly
- Monitor usage via portal dashboard

### ❌ DON'T:
- Commit API keys to git repositories
- Share API keys in chat/email
- Use same namespace for all data
- Cache sensitive data without encryption
- Ignore 401/403 errors (means misconfiguration)

## Support & Documentation

- **Documentation**: https://agentcache.ai/docs
- **Customer Portal**: https://agentcache.ai/portal/dashboard
- **API Reference**: https://agentcache.ai/docs/api
- **Support Email**: support@agentcache.ai
- **Slack Channel**: #jettythunder-support (if applicable)

## Monitoring & Analytics

### View Your Usage
1. Login to portal: https://agentcache.ai/portal/login
2. Dashboard shows:
   - Request count by namespace
   - Cache hit rate
   - Cost savings
   - Latency metrics

### Sample Analytics Query
```bash
curl https://agentcache.ai/api/portal/analytics?period=7d \
  -H "Authorization: Bearer [your-jwt-token]"
```

## Troubleshooting

### Error: 401 Unauthorized
**Problem**: Invalid API key  
**Solution**: Check `AGENTCACHE_API_KEY` is correct, verify in portal

### Error: 403 Forbidden
**Problem**: Namespace not allowed for your organization  
**Solution**: Use one of: `jt_storage`, `jt_cdn`, `jt_metadata`

### Error: 429 Too Many Requests
**Problem**: Rate limit exceeded  
**Solution**: Contact support to increase limits

### Low Cache Hit Rate
**Problem**: Most requests are cache misses  
**Solution**: 
- Ensure consistent cache key naming
- Check TTL values aren't too short
- Verify cache warming on deployment

## Next Steps

1. **Test the API** with the curl commands above
2. **Integrate SDK** into your application
3. **Monitor usage** via the portal dashboard
4. **Schedule check-in** with AgentCache team in 1 week

---

## Secure Delivery Instructions

**How to send these credentials to JettyThunder:**

### Option 1: Password Manager (Recommended)
- Use 1Password/Bitwarden shared vault
- Create "AgentCache Production Credentials" item
- Share with admin@jettythunder.app

### Option 2: Encrypted Email
- Encrypt with PGP/GPG
- Send via secure email
- Include temp password separately

### Option 3: Portal Invitation
- Send portal invitation email
- They set own password
- API key displayed once in portal

**Never send via:**
- Plain text email
- Slack DM
- SMS
- Unencrypted document
