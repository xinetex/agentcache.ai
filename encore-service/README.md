# SVT Encore Transcoding Service

Scalable video transcoding for AgentCache.ai, deployed on Railway.

## Quick Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Select `agentcache-ai` repo, set root directory to `encore-service`
4. Add environment variables (see below)
5. Deploy!

## Environment Variables

Required on Railway:
```
UPSTASH_REDIS_HOST=frank-buzzard-35556.upstash.io
UPSTASH_REDIS_PASSWORD=AYrkAAIncDIxZjMxMDVkMzBkMzg0ZDMzOTBjYmJmZWU4NWZmMjVjZXA...
LYVE_ENDPOINT=https://s3.us-west-1.lyvecloud.seagate.com
LYVE_ACCESS_KEY=<your-lyve-key>
LYVE_SECRET_KEY=<your-lyve-secret>
LYVE_BUCKET=jettydata-prod
```

## API Endpoints

### Submit Transcoding Job
```bash
POST https://your-encore.railway.app/encoreJobs
Content-Type: application/json

{
  "profile": "roku-hls",
  "outputFolder": "s3://jettydata-prod/transcoded/",
  "baseName": "my-video",
  "inputs": [{
    "uri": "s3://jettydata-prod/audio1/videos/123/source.mp4",
    "type": "AudioVideo"
  }]
}
```

### Check Job Status
```bash
GET https://your-encore.railway.app/encoreJobs/{jobId}
```

## Profiles

- `roku-hls` - Multi-bitrate HLS (1080p/720p/480p/360p) optimized for Roku
- `program` - SVT default broadcast profile

## Architecture

```
Audio1.TV Upload → Lyve Cloud → Encore (Railway) → HLS Output → Lyve Cloud → CDN → Roku
```
