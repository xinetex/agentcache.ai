# Lyve Transcoder Implementation & Testing Guide

**Created:** December 28, 2024  
**Status:** Ready for Testing  

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────────┐
│   Web API   │─────>│ Redis Queue  │─────>│ Python Worker │
│ (TypeScript)│      │   (Upstash)  │      │  (FFmpeg)     │
└─────────────┘      └──────────────┘      └───────────────┘
       │                     │                       │
       │                     │                       │
       v                     v                       v
   Job Status           Job Queue              Lyve Cloud S3
   (Redis Hash)        (List: RPOP)           (Video Output)
```

---

## Prerequisites

### 1. System Dependencies

**FFmpeg** (required for transcoding):
```bash
# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

**Python 3.8+**:
```bash
python3 --version
```

### 2. Python Dependencies

Create `requirements.txt`:
```bash
cat > /Users/letstaco/Documents/agentcache-ai/transcoder-service/requirements.txt << 'EOF'
redis==5.0.1
boto3==1.34.15
requests==2.31.0
EOF
```

Install:
```bash
cd /Users/letstaco/Documents/agentcache-ai/transcoder-service
pip3 install -r requirements.txt
```

### 3. Environment Variables

Create `.env` file:
```bash
cat > /Users/letstaco/Documents/agentcache-ai/transcoder-service/.env << 'EOF'
# Redis (Upstash)
REDIS_URL=redis://default:YOUR_UPSTASH_PASSWORD@YOUR_UPSTASH_HOST:PORT
UPSTASH_REDIS_URL=redis://default:YOUR_UPSTASH_PASSWORD@YOUR_UPSTASH_HOST:PORT

# Lyve Cloud S3
LYVE_ENDPOINT=https://s3.us-west-1.lyvecloud.seagate.com
LYVE_ACCESS_KEY=YOUR_LYVE_ACCESS_KEY
LYVE_SECRET_KEY=YOUR_LYVE_SECRET_KEY
LYVE_BUCKET=jettydata-prod

# Optional
WEBHOOK_URL=https://your-api.com/transcode-webhook
QUEUE_NAME=transcode_jobs
EOF
```

**Load environment:**
```bash
source /Users/letstaco/Documents/agentcache-ai/transcoder-service/.env
```

---

## Quick Start

### Step 1: Start the Worker

```bash
cd /Users/letstaco/Documents/agentcache-ai/transcoder-service
python3 lyve_transcoder.py
```

**Expected output:**
```
2024-12-28 06:30:00 [INFO] ✅ Connected to Redis
2024-12-28 06:30:00 [INFO] ✅ Connected to Lyve Cloud: https://s3.us-west-1.lyvecloud.seagate.com
2024-12-28 06:30:00 [INFO] 🚀 Lyve Transcoder started. Waiting for jobs...
```

### Step 2: Submit a Test Job

**Option A: Using Python Script**

Create `test_submit.py`:
```python
#!/usr/bin/env python3
import redis
import json
import os

REDIS_URL = os.environ['REDIS_URL']
r = redis.from_url(REDIS_URL, decode_responses=True)

job = {
    'id': 'test_job_001',
    'input_bucket': 'jettydata-prod',
    'input_key': 'audio1/2816/test-video.mp4',  # Replace with actual video
    'output_bucket': 'jettydata-prod',
    'output_prefix': 'transcoded/test_001',
    'ladder': [
        {'name': '720p', 'height': 720, 'bitrate': '4M', 'audio_bitrate': '128k'},
        {'name': '480p', 'height': 480, 'bitrate': '2M', 'audio_bitrate': '96k'},
    ]
}

r.lpush('transcode_jobs', json.dumps(job))
print(f"✅ Job submitted: {job['id']}")
```

Run:
```bash
python3 test_submit.py
```

**Option B: Using TypeScript API**

```bash
curl -X POST http://localhost:3000/api/transcode/submit \
  -H "Content-Type: application/json" \
  -d '{
    "inputKey": "audio1/2816/test-video.mp4",
    "profile": "roku-hls",
    "outputPrefix": "transcoded/test_001"
  }'
```

### Step 3: Monitor Job Status

**Check Redis directly:**
```python
#!/usr/bin/env python3
import redis
import json
import os

r = redis.from_url(os.environ['REDIS_URL'], decode_responses=True)
job_id = 'test_job_001'

status = r.hgetall(f"job:{job_id}")
print(json.dumps(status, indent=2))
```

**Via API:**
```bash
curl http://localhost:3000/api/transcode/status/test_job_001
```

---

## Testing Plan

### Test 1: Basic Functionality

**Goal:** Verify worker can process a simple video

**Steps:**
1. Upload a small test video to Lyve Cloud (10-30 seconds)
2. Submit transcoding job
3. Monitor worker logs
4. Verify outputs in S3

**Test video locations:**
```
Input:  s3://jettydata-prod/test-videos/sample.mp4
Output: s3://jettydata-prod/transcoded/test_001/720p.mp4
        s3://jettydata-prod/transcoded/test_001/480p.mp4
        s3://jettydata-prod/transcoded/test_001/master.m3u8
```

**Success criteria:**
- [ ] Worker downloads source video
- [ ] FFmpeg encodes without errors
- [ ] Outputs are uploaded to S3
- [ ] HLS manifest is generated
- [ ] Job status updates to "complete"

### Test 2: Error Handling

**Goal:** Verify graceful failure handling

**Test cases:**
- Missing input file
- Invalid S3 credentials
- Corrupted video file
- Insufficient disk space

**Expected behavior:**
- Job status updates to "failed"
- Error message is stored
- Worker continues processing other jobs

### Test 3: Multiple Qualities

**Goal:** Test full ABR ladder

**Job config:**
```json
{
  "ladder": [
    {"name": "1080p", "height": 1080, "bitrate": "8M", "audio_bitrate": "192k"},
    {"name": "720p", "height": 720, "bitrate": "4M", "audio_bitrate": "128k"},
    {"name": "480p", "height": 480, "bitrate": "2M", "audio_bitrate": "96k"},
    {"name": "360p", "height": 360, "bitrate": "800k", "audio_bitrate": "64k"}
  ]
}
```

**Verify:**
- [ ] All 4 profiles are generated
- [ ] File sizes are correct (1080p > 720p > 480p > 360p)
- [ ] HLS manifest includes all profiles

### Test 4: Roku Playback

**Goal:** Verify transcoded videos work on Roku

**Steps:**
1. Transcode a video
2. Update feed API to serve HLS manifest URL
3. Test playback on Roku device
4. Verify seeking works
5. Check quality switching

**Success criteria:**
- [ ] Video starts within 3 seconds
- [ ] No buffering issues
- [ ] Seeking is smooth
- [ ] Quality adapts to bandwidth

### Test 5: Performance Benchmarks

**Goal:** Measure transcoding performance

**Test video specs:**
- Duration: 5 minutes
- Resolution: 1920x1080
- Format: H.264 MP4

**Measurements:**
- Time to transcode (should be < 10 minutes on modern hardware)
- CPU usage (monitor with `top`)
- Memory usage
- S3 upload speed

### Test 6: Queue Behavior

**Goal:** Verify queue handling under load

**Steps:**
1. Submit 10 jobs at once
2. Monitor queue length
3. Verify FIFO processing
4. Check for race conditions

**Monitor:**
```bash
# Queue length
redis-cli -u $REDIS_URL LLEN transcode_jobs

# Active jobs
redis-cli -u $REDIS_URL KEYS "job:*"
```

---

## Integration with Audio1.tv

### Step 1: Add Transcode Trigger

When a user uploads a video to audio1.tv, automatically submit transcode job:

**File:** `audio1.tv/apps/studio/app/api/videos/upload/route.ts`

```typescript
import { submitTranscodeJob } from '@/services/transcode-queue';

// After file upload to S3
const s3Key = `audio1/${userId}/${timestamp}-${filename}`;
await uploadToS3(file, s3Key);

// Submit transcode job
const jobId = await submitTranscodeJob(s3Key, {
  output_prefix: `audio1/transcoded/${userId}/${timestamp}`,
  webhook_url: `https://www.audio1.tv/api/transcode-webhook`
});

// Save job ID to database
await db.videos.create({
  user_id: userId,
  original_key: s3Key,
  transcode_job_id: jobId,
  status: 'processing'
});
```

### Step 2: Update Feed API

Once transcoding completes, serve HLS manifest to Roku:

**File:** `audio1.tv/apps/studio/app/api/feed/route.ts`

```typescript
// In transformStreamUrl function
if (video.transcode_status === 'complete' && video.hls_manifest_key) {
  // Use transcoded HLS for Roku
  if (isRoku) {
    return `https://jettythunder.app/roku-stream/${video.hls_manifest_key}`;
  }
  // Use transcoded MP4 for web
  return `https://www.audio1.tv/api/video-proxy?key=${video.transcoded_720p_key}`;
}
```

### Step 3: Webhook Handler

Create webhook to receive completion notifications:

**File:** `audio1.tv/apps/studio/app/api/transcode-webhook/route.ts`

```typescript
export async function POST(request: Request) {
  const { job_id, status, outputs, error } = await request.json();
  
  if (status === 'complete') {
    // Find video by job ID
    const video = await db.videos.findByTranscodeJobId(job_id);
    
    // Update with output keys
    const hlsManifest = outputs.find(o => o.profile === 'hls');
    const mp4_720p = outputs.find(o => o.profile === '720p');
    
    await db.videos.update(video.id, {
      transcode_status: 'complete',
      hls_manifest_key: hlsManifest?.key,
      transcoded_720p_key: mp4_720p?.key,
      transcoded_at: new Date()
    });
    
    console.log(`✅ Video ${video.id} transcoded successfully`);
  } else if (status === 'failed') {
    await db.videos.update(video.id, {
      transcode_status: 'failed',
      transcode_error: error
    });
  }
  
  return new Response('OK');
}
```

---

## Monitoring & Debugging

### Worker Logs

**Enable verbose FFmpeg logging:**
```python
# In lyve_transcoder.py, line 175
result = subprocess.run(cmd, capture_output=True, text=True)

# Replace with:
result = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
logger.debug(result.stderr)  # Log FFmpeg output
```

### Redis Monitoring

**Queue length:**
```bash
redis-cli -u $REDIS_URL LLEN transcode_jobs
```

**Active jobs:**
```bash
redis-cli -u $REDIS_URL KEYS "job:*" | wc -l
```

**Job details:**
```bash
redis-cli -u $REDIS_URL HGETALL "job:test_job_001"
```

### S3 Verification

**List transcoded outputs:**
```bash
aws s3 ls s3://jettydata-prod/transcoded/ \
  --endpoint-url https://s3.us-west-1.lyvecloud.seagate.com \
  --profile lyve
```

**Download and test:**
```bash
aws s3 cp s3://jettydata-prod/transcoded/test_001/720p.mp4 /tmp/test.mp4 \
  --endpoint-url https://s3.us-west-1.lyvecloud.seagate.com

# Play locally
ffplay /tmp/test.mp4
```

---

## Production Deployment

### Option 1: Docker Container

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lyve_transcoder.py .

CMD ["python", "lyve_transcoder.py"]
```

**Build and run:**
```bash
docker build -t lyve-transcoder .
docker run -d \
  --name transcoder-worker \
  -e REDIS_URL=$REDIS_URL \
  -e LYVE_ACCESS_KEY=$LYVE_ACCESS_KEY \
  -e LYVE_SECRET_KEY=$LYVE_SECRET_KEY \
  lyve-transcoder
```

### Option 2: Systemd Service (Linux)

**File:** `/etc/systemd/system/lyve-transcoder.service`

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
ExecStart=/usr/bin/python3 lyve_transcoder.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable:**
```bash
sudo systemctl enable lyve-transcoder
sudo systemctl start lyve-transcoder
sudo systemctl status lyve-transcoder
```

### Option 3: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lyve-transcoder
spec:
  replicas: 3
  selector:
    matchLabels:
      app: transcoder
  template:
    metadata:
      labels:
        app: transcoder
    spec:
      containers:
      - name: worker
        image: lyve-transcoder:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: transcoder-secrets
              key: redis-url
        resources:
          requests:
            memory: "2Gi"
            cpu: "2000m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
```

---

## Optimization Tips

### 1. FFmpeg Performance

**Hardware acceleration (if available):**
```python
# NVIDIA GPU
'-c:v', 'h264_nvenc',

# Intel QuickSync
'-c:v', 'h264_qsv',

# Apple M1/M2
'-c:v', 'h264_videotoolbox',
```

### 2. Faster Presets

For faster transcoding at the cost of quality:
```python
'-preset', 'fast',  # or 'veryfast', 'ultrafast'
```

### 3. Parallel Workers

Run multiple workers to process jobs in parallel:
```bash
# Terminal 1
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py

# Terminal 2
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py

# Terminal 3
QUEUE_NAME=transcode_jobs python3 lyve_transcoder.py
```

### 4. Priority Queues

Use separate queues for different priorities:
```python
# High priority
QUEUE_NAME=transcode_jobs_high

# Low priority
QUEUE_NAME=transcode_jobs_low
```

---

## Troubleshooting

### Issue: "FFmpeg not found"

**Solution:**
```bash
which ffmpeg
# If empty, install FFmpeg
brew install ffmpeg  # macOS
apt-get install ffmpeg  # Ubuntu
```

### Issue: "Redis connection failed"

**Solution:**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL PING
# Expected: PONG

# Check credentials
echo $REDIS_URL
```

### Issue: "S3 403 Forbidden"

**Solution:**
```bash
# Verify credentials
aws s3 ls s3://jettydata-prod/ \
  --endpoint-url https://s3.us-west-1.lyvecloud.seagate.com \
  --profile lyve

# Check IAM permissions (need: s3:GetObject, s3:PutObject)
```

### Issue: "Video plays but has artifacts"

**Solution:**
```python
# Increase bitrate
'-b:v', '8M',  # Instead of 4M

# Use slower preset
'-preset', 'slow',  # Instead of medium
```

### Issue: "Roku won't play HLS manifest"

**Solution:**
- Verify manifest URLs are absolute (not relative)
- Check CORS headers on S3 bucket
- Ensure Content-Type is `application/x-mpegURL`
- Test manifest with: `curl https://jettythunder.app/roku-stream/transcoded/.../master.m3u8`

---

## Next Steps

1. **Run basic test** (Test 1 above)
2. **Monitor worker logs** for errors
3. **Verify S3 outputs** are created
4. **Test Roku playback** with transcoded video
5. **Integrate with audio1.tv** upload flow
6. **Set up monitoring** (Sentry, DataDog, etc.)
7. **Deploy to production** (Docker or K8s)

---

## API Reference

### Submit Job

```bash
POST /api/transcode/submit
Content-Type: application/json

{
  "inputKey": "audio1/2816/video.mp4",
  "profile": "roku-hls",
  "outputPrefix": "transcoded/job_123"
}

Response:
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "queued"
}
```

### Get Status

```bash
GET /api/transcode/status/:jobId

Response:
{
  "jobId": "job_123",
  "status": "complete",
  "outputs": [
    {"profile": "720p", "key": "transcoded/job_123/720p.mp4"},
    {"profile": "480p", "key": "transcoded/job_123/480p.mp4"},
    {"profile": "hls", "key": "transcoded/job_123/master.m3u8"}
  ]
}
```

### List Jobs

```bash
GET /api/transcode/jobs?page=0&size=20

Response:
{
  "jobs": [
    {"id": "job_123", "status": "complete", "created": "2024-12-28T06:00:00Z"},
    {"id": "job_124", "status": "processing", "created": "2024-12-28T06:01:00Z"}
  ]
}
```

---

**Ready to test!** 🚀

Start with Test 1 (Basic Functionality) and let me know what happens!
