# AgentCache Edge: Production Security Features

**Last Updated:** November 22, 2025  
**Version:** 1.0.0-hardened

---

## Security Hardening Summary

AgentCache Edge is production-ready with enterprise-grade security controls.

### Container Security

#### Multi-Stage Builds
- **Builder stage**: Contains all dependencies and source
- **Production stage**: Only runtime essentials (60% smaller image)
- **Result**: Reduced attack surface, faster deployment

#### Non-Root Execution
- Runs as user `nodejs` (UID 1001)
- No privileged operations possible
- Filesystem permissions: Read-only (500)

#### Capability Dropping
- Drops ALL Linux capabilities
- No privilege escalation possible
- `no-new-privileges` flag set

#### Read-Only Filesystem
- Root filesystem is read-only
- Only `/tmp` is writable (via tmpfs)
- Prevents malicious file writes

---

### Application Security

#### Rate Limiting
- **Limit**: 100 requests/minute per IP
- **Response**: HTTP 429 (Too Many Requests)
- **Storage**: In-memory (auto-cleanup)

#### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)

#### Input Validation
- JSON payload limit: 1MB
- Prevents DOS via large payloads

---

### Infrastructure Security

#### Health Checks
- **Endpoint**: `/health`
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Retries**: 3

#### Resource Limits
**Application Container:**
- CPU: 2 cores max, 0.5 core reserved
- Memory: 2GB max, 512MB reserved

**Redis Container:**
- CPU: 1 core max, 0.25 core reserved
- Memory: 512MB max, 128MB reserved

#### Network Isolation
- Redis NOT exposed to host network
- Only inter-container communication
- No external Redis access

---

### IP Protection

#### Files Excluded (via .dockerignore)
- Source code (`src/`)
- Git history (`.git/`)
- Environment secrets (`.env`)
- Strategy documents
- Admin scripts
- Test files

#### What's Included
- Compiled JavaScript only
- Public static assets
- Production dependencies

---

## Deployment Commands

### Local Development
```bash
# Configure ports
node scripts/manage_ports.js

# Start containers
docker-compose up
```

### Production
```bash
# Build hardened image
docker build -t agentcache-edge:latest .

# Run with compose
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

---

## Compliance Notes

- **HIPAA**: Medical Mode with PII redaction enabled
- **GDPR**: No personal data leaves the container
- **SOC 2**: Audit logs, read-only FS, least privilege
- **ISO 27001**: Multi-layer security controls

---

## Security Checklist

- [x] Multi-stage Docker builds
- [x] Non-root user execution
- [x] Read-only filesystem
- [x] Capability dropping
- [x] Security headers (OWASP)
- [x] Rate limiting
- [x] Health checks
- [x] Resource limits
- [x] Network isolation
- [x] IP protection (.dockerignore)
- [x] Payload size limits
- [x] Auto-restart on failure

---

## Secrets Management

### ⚠️ CRITICAL: Never Commit Secrets

#### Files That Should NEVER Be Committed
```
.env
.env.local
.env.vercel
.env.vercel_*
.env_*
*_COMPLETE.md (setup docs with real values)
docs/*ONBOARDING.md (if contains real credentials)
```

#### Pre-Commit Checklist
1. **Scan for secrets**
   ```bash
   git diff --cached | grep -i "secret\|password\|sk_\|whsec_\|postgresql://"
   ```

2. **Verify no .env files staged**
   ```bash
   git status | grep \.env
   ```

#### If Secrets Are Exposed
1. Remove from git: `git rm --cached <file>`
2. **Immediately rotate ALL exposed secrets**
3. Update Vercel environment variables
4. Redeploy

#### Safe Patterns
✅ Use environment variables  
✅ Template files with placeholders  
✅ Vercel environment variables (encrypted at rest)  

❌ Never hardcode secrets in tracked files  
❌ Never commit `.env` files  
❌ Never include real secrets in documentation  

---

## Support

For security inquiries: security@agentcache.ai  
For enterprise deployment: enterprise@agentcache.ai
