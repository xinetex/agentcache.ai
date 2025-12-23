# Audio1.TV CDN Client SDK

Standalone client SDK for integrating with AgentCache CDN services.

## Installation

### Browser (CDN)

```html
<script src="https://agentcache.ai/sdk/audio1-cdn-client.js"></script>
```

### Node.js / React Native

```bash
# Copy the file to your project
cp audio1-cdn-client.js your-project/lib/
```

```javascript
import { Audio1CDN } from './lib/audio1-cdn-client.js';
```

### Roku

```brightscript
' Copy audio1-cdn-roku.brs to your source folder
```

---

## Quick Start

### Web Player (HLS.js)

```javascript
import { Audio1CDN, createPlayerConfig } from './audio1-cdn-client.js';

const cdn = new Audio1CDN({ baseUrl: 'https://agentcache.ai' });

// Get stream URL
const video = document.getElementById('video');
const hls = new Hls();
hls.loadSource(cdn.getPlaylistUrl('video-123', '720p'));
hls.attachMedia(video);
```

### React Native (react-native-video)

```jsx
import { Audio1CDN, detectOptimalQuality } from './audio1-cdn-client';

const cdn = new Audio1CDN({ baseUrl: 'https://agentcache.ai' });
const quality = detectOptimalQuality();

<Video
  source={{ uri: cdn.getPlaylistUrl(videoId, quality) }}
  style={styles.video}
  controls
/>
```

### Roku

```brightscript
cdn = Audio1CDN("https://agentcache.ai")
quality = detectOptimalQuality()

content = cdn.createVideoContent("video-123", quality, "Episode Title")
videoPlayer.setContentList([content])
videoPlayer.play()
```

---

## API Reference

### `Audio1CDN(config)`

Create a new CDN client instance.

```javascript
const cdn = new Audio1CDN({
  baseUrl: 'https://agentcache.ai',  // CDN base URL
  apiKey: 'optional-api-key',        // For authenticated endpoints
  timeout: 30000                      // Request timeout (ms)
});
```

### `cdn.getPlaylistUrl(jobId, quality)`

Get the HLS playlist URL for a video.

```javascript
cdn.getPlaylistUrl('video-123', '720p')
// => 'https://agentcache.ai/hls/video-123/720p/playlist.m3u8'
```

### `cdn.getMasterPlaylistUrl(jobId)`

Get the adaptive bitrate master playlist URL.

```javascript
cdn.getMasterPlaylistUrl('video-123')
// => 'https://agentcache.ai/hls/video-123/master.m3u8'
```

### `cdn.warmCache(jobId, quality)`

Pre-warm the cache for a video (call before premiere).

```javascript
await cdn.warmCache('video-123', '1080p');
// { success: true, message: 'Cache warmed...' }
```

### `cdn.warmAllQualities(jobId)`

Warm all quality levels for a video.

```javascript
await cdn.warmAllQualities('video-123');
```

### `cdn.invalidateCache(jobId)`

Clear cache for a video (call after update/delete).

```javascript
await cdn.invalidateCache('video-123');
```

### `cdn.getMetrics()`

Get cache performance metrics.

```javascript
const metrics = await cdn.getMetrics();
// { l1Hits: 245, l2Hits: 89, cacheHitRate: '96.54%' }
```

---

## Quality Presets

```javascript
import { QualityPresets } from './audio1-cdn-client.js';

QualityPresets.MOBILE    // '360p'
QualityPresets.SD        // '480p'
QualityPresets.HD        // '720p'
QualityPresets.FULL_HD   // '1080p'
```

---

## Integration Examples

### Channel Manager (after transcoding)

```javascript
// When a new video is transcoded
async function onTranscodeComplete(jobId) {
  const cdn = new Audio1CDN({ baseUrl: 'https://agentcache.ai' });
  
  // Pre-warm cache for all qualities
  await cdn.warmAllQualities(jobId);
  
  console.log('Cache warmed for', jobId);
}
```

### Content Update (invalidate cache)

```javascript
// When video metadata or content is updated
async function onContentUpdate(jobId) {
  const cdn = new Audio1CDN({ baseUrl: 'https://agentcache.ai' });
  
  // Clear old cached content
  await cdn.invalidateCache(jobId);
  
  // Re-warm with new content
  await cdn.warmAllQualities(jobId);
}
```

---

## Support

- **Documentation**: https://agentcache.ai/docs
- **Issues**: https://github.com/your-org/agentcache-ai/issues
