# Videocache Roku Proxy - Render.com Deployment

This directory contains the HTTP/1.1 video proxy for Roku compatibility.

## Quick Deploy to Render.com

1. Create a new Web Service on Render.com
2. Connect to your Git repository
3. Set root directory: `transcoder-service`
4. Build command: `npm install`
5. Start command: `node videocache-server.js`
6. Environment variables:
   - `JETTYTHUNDER_URL`: `https://www.jettythunder.app`
   - `CACHE_PORT`: `3003`

## Endpoints

- `GET /roku-stream/{key}` - Roku-compatible HTTP/1.1 streaming
- `GET /audio1/{partner}/{userId}/{fileId}/{filename}` - Legacy format
- `GET /audio1/stats` - Cache statistics

## Testing

```bash
# Test the Roku endpoint
curl -I https://your-render-url.onrender.com/roku-stream/audio1/videos/2816/test.mp4
# Should return HTTP/1.1 200 or 206
```
