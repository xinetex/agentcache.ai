# AgentCache + Transcoder Deployment Guide

**Target:** Vercel (API) + Railway/Fly.io (Worker)

---

## Architecture

```
┌─────────────────┐
│  Vercel (API)   │  ← TypeScript API on Vercel Edge
│  agentcache.ai  │     - /api/transcode/submit
│                 │     - /api/transcode/status
└────────┬────────┘
         │
         │ (Push job to Redis)
         v
┌─────────────────┐
│  Upstash Redis  │  ← Job queue + status storage
│   (Queue)       │
└────────┬────────┘
         │
         │ (Worker polls queue)
         v
┌─────────────────┐
│ Railway/Fly.io  │  ← Python worker (long-running)
│ (Worker)        │     - Pulls jobs from Redis
│                 │     - Runs FFmpeg transcoding
│                 │     - Uploads to Lyve Cloud S3
└─────────────────┘
```

---

## Step 1: Deploy API to Vercel

### 1.1 Push Code to GitHub

```bash
cd /Users/letstaco/Documents/agentcache-ai
git add .
git commit -m "Add transcode API and worker"
git push origin main
```

### 1.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js/Node.js

### 1.3 Environment Variables on Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```env
# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://YOUR_REDIS.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN_HERE

# Lyve Cloud (for API to generate signed URLs if needed)
LYVE_ENDPOINT=https://s3.us-west-1.lyvecloud.seagate.com
LYVE_ACCESS_KEY=YOUR_ACCESS_KEY
LYVE_SECRET_KEY=YOUR_SECRET_KEY
LYVE_BUCKET=jettydata-prod

# Webhook (optional - for completion notifications)
WEBHOOK_URL=https://www.audio1.tv/api/transcode-webhook

# Database (existing)
DATABASE_URL=postgres://...
```

### 1.4 Deploy

```bash
# Vercel CLI (or use dashboard)
vercel --prod
```

**Test API:**
```bash
curl https://agentcache.ai/api/transcode/submit \
  -H "Content-Type: application/json" \
  -d '{"inputKey": "test/video.mp4", "profile": "roku-hls"}'
```

---

## Step 2: Deploy Python Worker

### Option A: Railway (Recommended)

**Why Railway?**
- ✅ Free $5/month credit (enough for testing)
- ✅ Easy deployment from GitHub
- ✅ Auto-restart on crash
- ✅ Horizontal scaling support

#### 2.1 Create `Dockerfile`

```bash
cd /Users/letstaco/Documents/agentcache-ai/transcoder-service
```

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lyve_transcoder.py .

CMD ["python", "lyve_transcoder.py"]
```

#### 2.2 Create `railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
numReplicas = 1
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### 2.3 Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repo and `/transcoder-service` directory
4. Railway will detect Dockerfile and build

#### 2.4 Set Environment Variables on Railway

In Railway Dashboard → Variables:

```env
REDIS_URL=redis://default:PASSWORD@HOST:PORT
UPSTASH_REDIS_URL=redis://default:PASSWORD@HOST:PORT
LYVE_ENDPOINT=https://s3.us-west-1.lyvecloud.seagate.com
LYVE_ACCESS_KEY=YOUR_ACCESS_KEY
LYVE_SECRET_KEY=YOUR_SECRET_KEY
LYVE_BUCKET=jettydata-prod
WEBHOOK_URL=https://www.audio1.tv/api/transcode-webhook
QUEUE_NAME=transcode_jobs
```

#### 2.5 Deploy & Monitor

Railway will auto-build and start the worker.

**View logs:**
```
Railway Dashboard → Your Service → Logs
```

**Expected output:**
```
✅ Connected to Redis
✅ Connected to Lyve Cloud: https://s3.us-west-1.lyvecloud.seagate.com
🚀 Lyve Transcoder started. Waiting for jobs...
```

---

### Option B: Fly.io

```bash
cd /Users/letstaco/Documents/agentcache-ai/transcoder-service

# Install Fly CLI
brew install flyctl

# Login
flyctl auth login

# Create app
flyctl launch --name lyve-transcoder

# Set secrets
flyctl secrets set \
  REDIS_URL="redis://..." \
  LYVE_ACCESS_KEY="..." \
  LYVE_SECRET_KEY="..." \
  LYVE_BUCKET="jettydata-prod"

# Deploy
flyctl deploy
```

**Monitor:**
```bash
flyctl logs
```

---

### Option C: Local Development / VPS

For local testing or a dedicated server:

```bash
cd /Users/letstaco/Documents/agentcache-ai/transcoder-service

# Activate venv
source .venv/bin/activate

# Set environment variables
export REDIS_URL="redis://..."
export LYVE_ACCESS_KEY="..."
export LYVE_SECRET_KEY="..."
export LYVE_BUCKET="jettydata-prod"

# Run worker
python3 lyve_transcoder.py
```

**Run as systemd service (Linux):**

Create `/etc/systemd/system/lyve-transcoder.service`:
```ini
[Unit]
Description=Lyve Transcoder Worker
After=network.target

[Service]
Type=simple
User=transcoder
WorkingDirectory=/opt/lyve-transcoder
Environment="REDIS_URL=redis://..."
Environment="LYVE_ACCESS_KEY=..."
Environment="LYVE_SECRET_KEY=..."
Environment="LYVE_BUCKET=jettydata-prod"
ExecStart=/usr/bin/python3 lyve_transcoder.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable lyve-transcoder
sudo systemctl start lyve-transcoder
sudo systemctl status lyve-transcoder
```

---

## Step 3: Test End-to-End

### 3.1 Submit Job via API

```bash
curl -X POST https://agentcache.ai/api/transcode/submit \
  -H "Content-Type: application/json" \
  -d '{
    "inputKey": "audio1/2816/test-video.mp4",
    "profile": "roku-hls",
    "outputPrefix": "transcoded/test_001"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1735363200_abc123",
  "status": "queued",
  "message": "Transcoding job submitted. Profile: roku-hls"
}
```

### 3.2 Monitor Worker Logs

**Railway:**
```
Dashboard → Logs
```

**Fly.io:**
```bash
flyctl logs
```

**Local:**
```
Watch terminal output
```

**Expected log output:**
```
📥 Processing job: job_1735363200_abc123
⬇️  Downloading: s3://jettydata-prod/audio1/2816/test-video.mp4
🎬 Encoding 720p...
⬆️  Uploading: s3://jettydata-prod/transcoded/test_001/720p.mp4
🎬 Encoding 480p...
⬆️  Uploading: s3://jettydata-prod/transcoded/test_001/480p.mp4
✅ Job job_1735363200_abc123 complete: 3 outputs
```

### 3.3 Check Status

```bash
curl https://agentcache.ai/api/transcode/status/job_1735363200_abc123
```

**Response:**
```json
{
  "jobId": "job_1735363200_abc123",
  "status": "complete",
  "outputs": [
    {"profile": "720p", "key": "transcoded/test_001/720p.mp4"},
    {"profile": "480p", "key": "transcoded/test_001/480p.mp4"},
    {"profile": "hls", "key": "transcoded/test_001/master.m3u8"}
  ]
}
```

### 3.4 Verify S3 Outputs

```bash
aws s3 ls s3://jettydata-prod/transcoded/test_001/ \
  --endpoint-url https://s3.us-west-1.lyvecloud.seagate.com
```

**Expected:**
```
720p.mp4
480p.mp4
master.m3u8
```

---

## Step 4: Integrate with Audio1.tv

### 4.1 Auto-Submit on Upload

**File:** `audio1.tv/apps/studio/app/api/videos/upload/route.ts`

```typescript
import { submitTranscodeJob } from '@agentcache/transcode-queue';

// After S3 upload
const s3Key = `audio1/${userId}/${timestamp}-${filename}`;
await uploadToS3(file, s3Key);

// Submit transcode job
const jobId = await fetch('https://agentcache.ai/api/transcode/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputKey: s3Key,
    profile: 'roku-hls',
    outputPrefix: `audio1/transcoded/${userId}/${timestamp}`
  })
}).then(r => r.json()).then(d => d.jobId);

// Save to database
await db.videos.create({
  user_id: userId,
  original_key: s3Key,
  transcode_job_id: jobId,
  status: 'processing'
});
```

### 4.2 Webhook Handler

**File:** `audio1.tv/apps/studio/app/api/transcode-webhook/route.ts`

```typescript
export async function POST(request: Request) {
  const { job_id, status, outputs, error } = await request.json();
  
  if (status === 'complete') {
    const video = await db.videos.findOne({ transcode_job_id: job_id });
    const hlsManifest = outputs.find(o => o.profile === 'hls');
    
    await db.videos.update(video.id, {
      transcode_status: 'complete',
      hls_manifest_key: hlsManifest?.key,
      transcoded_at: new Date()
    });
  } else if (status === 'failed') {
    await db.videos.update(video.id, {
      transcode_status: 'failed',
      transcode_error: error
    });
  }
  
  return new Response('OK');
}
```

### 4.3 Update Feed API

**File:** `audio1.tv/apps/studio/app/api/feed/route.ts`

```typescript
// In transformStreamUrl function
if (video.transcode_status === 'complete' && video.hls_manifest_key) {
  if (isRoku) {
    // Serve HLS manifest through Cloudflare Worker
    return `https://jettythunder.app/roku-stream/${video.hls_manifest_key}`;
  }
  // Serve transcoded MP4 for web
  const mp4Key = video.hls_manifest_key.replace('master.m3u8', '720p.mp4');
  return `https://www.audio1.tv/api/video-proxy?key=${mp4Key}`;
}
```

---

## Monitoring & Scaling

### Queue Monitoring

**Check queue length:**
```bash
redis-cli -u $REDIS_URL LLEN transcode_jobs
```

**List active jobs:**
```bash
redis-cli -u $REDIS_URL KEYS "job:*"
```

### Scaling Workers

**Railway:**
- Dashboard → Settings → Scale
- Increase replicas (costs $5/replica/month)

**Fly.io:**
```bash
flyctl scale count 3  # Run 3 workers
```

**Local/VPS:**
```bash
# Run multiple workers in parallel
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py &
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py &
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py &
```

### Performance

**Expected transcoding speed:**
- 5 min video → ~5-10 min transcode time
- 4 quality levels (1080p, 720p, 480p, 360p)
- ~10-20MB output per quality level

**Cost estimate (Railway):**
- 1 worker: Free (within $5 credit)
- 3 workers: $10/month
- CPU: 2 vCPU per worker
- RAM: 2GB per worker

---

## Troubleshooting

### Issue: Jobs stuck in queue

**Check worker logs:**
```bash
# Railway
Railway Dashboard → Logs

# Fly.io
flyctl logs

# Local
Check terminal output
```

**Common causes:**
- Worker crashed (check logs)
- Redis connection issue
- S3 credentials invalid
- FFmpeg not installed in container

### Issue: Transcoding fails

**Check error in Redis:**
```bash
redis-cli -u $REDIS_URL HGET "job:JOB_ID" error
```

**Common errors:**
- "Input file not found" → Check S3 key
- "FFmpeg error" → Check video format (must be MP4/MOV/etc.)
- "S3 upload failed" → Check Lyve credentials

### Issue: API returns 500

**Check Vercel logs:**
```bash
vercel logs
```

**Common causes:**
- Upstash Redis not configured
- Environment variables missing
- TypeScript compilation error

---

## Next Steps

1. ✅ Deploy API to Vercel
2. ✅ Deploy worker to Railway
3. ✅ Test end-to-end flow
4. ✅ Integrate with audio1.tv upload
5. ✅ Set up webhook handler
6. 🔜 Add monitoring/alerting (Sentry, etc.)
7. 🔜 Optimize transcoding presets
8. 🔜 Add job prioritization
9. 🔜 Implement job cancellation

---

## Quick Commands Cheat Sheet

```bash
# Deploy to Vercel
vercel --prod

# Check Railway logs
railway logs

# Monitor Redis queue
redis-cli -u $REDIS_URL LLEN transcode_jobs

# Submit test job
curl -X POST https://agentcache.ai/api/transcode/submit \
  -H "Content-Type: application/json" \
  -d '{"inputKey": "audio1/2816/test.mp4", "profile": "roku-hls"}'

# Check job status
curl https://agentcache.ai/api/transcode/status/JOB_ID

# List S3 outputs
aws s3 ls s3://jettydata-prod/transcoded/ \
  --endpoint-url https://s3.us-west-1.lyvecloud.seagate.com
```

---

**Ready to deploy!** 🚀

Start with Railway deployment (easiest), then test the full flow.
