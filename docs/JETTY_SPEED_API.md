# JettySpeed API Documentation

Complete API reference for AgentCache ↔ JettyThunder integration.

## Base URL
```
Production: https://agentcache.ai
Development: http://localhost:3000
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer {api_key}
```

---

## Endpoints

### 1. Get Optimal Edges

Returns the best edge locations for file upload based on user location, real-time load, and latency metrics. Includes automatic deduplication check.

**Endpoint:** `POST /api/jetty/optimal-edges`

**Request Body:**
```json
{
  "userId": "usr_abc123",
  "fileSize": 1073741824,
  "fileHash": "sha256:abc123def456...",
  "fileName": "video.mp4",
  "userLocation": {
    "lat": 37.7749,
    "lng": -122.4194,
    "city": "San Francisco"
  },
  "priority": "speed",
  "budget": 0.50
}
```

**Parameters:**
- `userId` (string, required) - User ID
- `fileSize` (number, required) - File size in bytes
- `fileHash` (string, required) - SHA-256 hash of file for deduplication
- `fileName` (string, optional) - File name
- `userLocation` (object, optional) - User's geographic location
  - `lat` (number) - Latitude
  - `lng` (number) - Longitude
  - `city` (string) - City name
- `priority` (string, optional) - Upload priority: `speed`, `cost`, or `balanced` (default: `balanced`)
- `budget` (number, optional) - Maximum cost willing to pay

**Response (New File):**
```json
{
  "strategy": {
    "chunkSize": 52428800,
    "threads": 24,
    "compression": "none",
    "estimatedTime": 372,
    "estimatedCost": 0.42
  },
  "edges": [
    {
      "id": "sfo-1",
      "url": "https://sfo.agentcache.ai",
      "latency": 12,
      "load": 23,
      "distance": 0,
      "weight": 0.35
    },
    {
      "id": "lax-1",
      "url": "https://lax.agentcache.ai",
      "latency": 18,
      "load": 15,
      "distance": 559,
      "weight": 0.30
    },
    {
      "id": "lyve-direct",
      "url": "https://s3.lyvecloud.seagate.com",
      "latency": 45,
      "load": 0,
      "distance": 0,
      "weight": 0.10
    }
  ],
  "duplicate": null
}
```

**Response (Duplicate Detected):**
```json
{
  "duplicate": {
    "fileId": "file_xyz789",
    "url": "https://s3.lyvecloud.seagate.com/agentcache-assets/users/usr_abc123/file_xyz789",
    "savedBytes": 1073741824,
    "savedCost": 10.00,
    "message": "File already exists. Zero-cost clone available."
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `400` - Missing required fields
- `503` - No active edges available

---

### 2. Check Duplicate

Fast hash lookup to check if file already exists before upload. Instant deduplication check.

**Endpoint:** `POST /api/jetty/check-duplicate`

**Request Body:**
```json
{
  "fileHash": "sha256:abc123def456...",
  "userId": "usr_abc123",
  "fileName": "video.mp4",
  "fileSize": 1073741824
}
```

**Parameters:**
- `fileHash` (string, required) - SHA-256 hash of file
- `userId` (string, required) - User ID
- `fileName` (string, optional) - File name
- `fileSize` (number, optional) - File size in bytes

**Response (Duplicate Found):**
```json
{
  "isDuplicate": true,
  "file": {
    "fileId": "file_xyz789",
    "url": "https://s3.lyvecloud.seagate.com/agentcache-assets/file_xyz789",
    "fileName": "original-video.mp4",
    "fileSize": 1073741824,
    "mimeType": "video/mp4",
    "uploadCount": 5,
    "firstUploadedAt": "2025-01-15T10:30:00Z"
  },
  "savings": {
    "bytes": 1073741824,
    "cost": 0.10
  },
  "message": "File already exists. Instant zero-copy clone available."
}
```

**Response (New File):**
```json
{
  "isDuplicate": false,
  "message": "File is unique. Proceed with upload."
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `400` - Missing required fields

---

### 3. Cache Chunk Metadata

Store or retrieve chunk upload metadata in Redis for cross-platform resume capability.

**Endpoint:** `POST /api/jetty/cache-chunk` (store)  
**Endpoint:** `GET /api/jetty/cache-chunk?sessionId={id}` (retrieve)

**POST Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkIndex": 0,
  "chunkHash": "sha256:chunk_0_hash",
  "edgeId": "sfo-1",
  "status": "completed",
  "bytesUploaded": 52428800,
  "errorMessage": null
}
```

**Parameters (POST):**
- `sessionId` (string, required) - Upload session ID
- `chunkIndex` (number, required) - Chunk index (0-based)
- `chunkHash` (string, optional) - Hash of chunk
- `edgeId` (string, optional) - Edge used for upload
- `status` (string, required) - `pending`, `uploading`, `completed`, or `failed`
- `bytesUploaded` (number, optional) - Bytes uploaded for this chunk
- `errorMessage` (string, optional) - Error message if failed

**POST Response:**
```json
{
  "success": true,
  "message": "Chunk metadata cached",
  "chunk": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "chunkIndex": 0,
    "status": "completed"
  }
}
```

**GET Response:**
```json
{
  "chunks": [
    {
      "chunkIndex": 0,
      "chunkHash": "sha256:chunk_0_hash",
      "edgeId": "sfo-1",
      "status": "completed",
      "bytesUploaded": 52428800,
      "timestamp": "2025-01-20T14:30:00Z"
    },
    {
      "chunkIndex": 1,
      "chunkHash": "sha256:chunk_1_hash",
      "edgeId": "lax-1",
      "status": "completed",
      "bytesUploaded": 52428800,
      "timestamp": "2025-01-20T14:30:05Z"
    }
  ],
  "total": 2
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `400` - Missing required fields

**Cache Duration:** 7 days

---

### 4. Track Upload

Create and track upload sessions for analytics, progress monitoring, and performance metrics.

**Endpoint:** `POST /api/jetty/track-upload`

#### Action: Start

Create new upload session.

**Request Body:**
```json
{
  "action": "start",
  "userId": "usr_abc123",
  "fileName": "video.mp4",
  "fileHash": "sha256:abc123def456...",
  "fileSize": 1073741824,
  "chunkSize": 52428800,
  "threads": 24,
  "edgesUsed": ["sfo-1", "lax-1", "sea-1"],
  "chunksTotal": 20,
  "estimatedCost": 0.10,
  "uploadVia": "desktop",
  "jettySpeedEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload session created",
  "session": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "fileId": "file_abc123",
    "chunksTotal": 20,
    "estimatedTime": 372
  }
}
```

#### Action: Progress

Update upload progress.

**Request Body:**
```json
{
  "action": "progress",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "chunksCompleted": 5,
  "bytesUploaded": 262144000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Progress updated",
  "progress": {
    "chunksCompleted": 5,
    "bytesUploaded": 262144000
  }
}
```

#### Action: Complete

Mark upload as completed.

**Request Body:**
```json
{
  "action": "complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "actualCost": 0.08
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload completed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Action: Fail

Mark upload as failed.

**Request Body:**
```json
{
  "action": "fail",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "chunksCompleted": 3,
  "bytesUploaded": 157286400,
  "errorMessage": "Network timeout"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload marked as failed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "errorMessage": "Network timeout"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `400` - Missing required fields or invalid action

---

## Integration Flow

### Standard Upload Flow

```
1. Desktop/Web App → Check Duplicate
   ↓ (if duplicate)
   → Return existing file URL (instant)
   
   ↓ (if new)
2. Desktop/Web App → Get Optimal Edges
   ↓
3. AgentCache returns edge strategy + edge list
   ↓
4. Desktop/Web App → Track Upload (action: start)
   ↓
5. Desktop splits file into chunks
   ↓
6. For each chunk:
   - Upload chunk to edge
   - Cache Chunk Metadata
   - Track Upload (action: progress)
   ↓
7. All chunks complete → Track Upload (action: complete)
```

### Resume Upload Flow

```
1. Desktop/Web App crashes mid-upload
   ↓
2. User restarts upload
   ↓
3. Desktop/Web App → Get Cached Chunks (sessionId)
   ↓
4. AgentCache returns completed chunks
   ↓
5. Desktop skips completed chunks, uploads remaining
   ↓
6. Continue from step 6 in Standard Flow
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common Error Codes:**
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid/missing API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable (no edges available)

---

## Rate Limits

- **Optimal Edges:** 60 requests/minute per user
- **Check Duplicate:** 120 requests/minute per user
- **Cache Chunk:** 1000 requests/minute per user
- **Track Upload:** 500 requests/minute per user

---

## Performance Metrics

### Expected Response Times
- Check Duplicate: < 50ms
- Get Optimal Edges: < 200ms (with mock metrics), < 500ms (with real metrics)
- Cache Chunk: < 100ms
- Track Upload: < 150ms

### Expected Upload Speed Improvements
- **Without JettySpeed:** 45s for 100MB
- **With JettySpeed:** 5s for 100MB (9x faster)
- **Duplicate File:** 0.5s (instant, 90x faster)

---

## Testing

Run the test suite:
```bash
cd /Users/letstaco/Documents/agentcache-ai
BASE_URL=http://localhost:3000 API_KEY=your_key ./tests/jetty-speed-api-tests.sh
```

---

## Database Migration

Before using these endpoints, run the database migration:

```bash
psql $DATABASE_URL -f database/jettyspeed-schema.sql
```

This creates tables for:
- `edge_locations` - Edge server locations
- `edge_metrics` - Real-time edge performance metrics
- `file_hashes` - Deduplication index
- `upload_sessions` - Upload tracking
- `upload_patterns` - Predictive pre-warming data

---

## Next Steps for JettyThunder Team

1. ✅ Read this documentation
2. ✅ Read `docs/JETTYTHUNDER_HANDOFF.md`
3. Build Rust client: `src-tauri/src/agentcache_client.rs`
4. Integrate optimal-edges API call before upload
5. Test with our staging environment
6. Launch! 🚀

---

## Support

Questions? Reach out to AgentCache team or file an issue in the repo.
