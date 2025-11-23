# IPFS Integration Guide

AgentCache now supports decentralized asset storage using IPFS (InterPlanetary File System). This ensures censorship resistance and provides immutable references for user assets.

## Overview

- **Storage Provider**: Pinata (or any IPFS pinning service compatible with the API)
- **Retrieval**: High-performance IPFS Gateway (configurable)
- **API Endpoint**: `/api/assets/upload`

## Configuration

To use the IPFS features, you must configure the following environment variables in Vercel (or your `.env` file locally):

```bash
# Pinata Credentials (Required for uploads)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# IPFS Gateway (Optional, defaults to Pinata's public gateway)
# For best performance, use a dedicated gateway or Cloudflare IPFS
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
# Example: https://cloudflare-ipfs.com/ipfs
```

## API Usage

### Upload Asset

**Endpoint**: `POST /api/assets/upload`

**Headers**:
- `X-API-Key`: Your AgentCache API Key
- `Content-Type`: `multipart/form-data`

**Body**:
- `file`: The file object to upload

**Example (cURL)**:
```bash
curl -X POST https://agentcache.ai/api/assets/upload \
  -H "X-API-Key: ac_demo_test123" \
  -F "file=@/path/to/image.png"
```

**Response**:
```json
{
  "success": true,
  "cid": "QmHash...",
  "url": "https://gateway.pinata.cloud/ipfs/QmHash...",
  "name": "image.png",
  "size": 12345,
  "timestamp": 1732350000000
}
```

## Integration in Editor

When a user uploads an asset in the editor:
1. The frontend sends the file to `/api/assets/upload`.
2. The API uploads to IPFS and returns the `url` and `cid`.
3. The editor uses the `url` for immediate display.
4. The `cid` is stored as the immutable reference (e.g., for NFT minting).

## Benefits

- **Censorship Resistance**: Assets are stored on a decentralized network.
- **Immutability**: Content is addressed by its hash (CID), ensuring it hasn't been tampered with.
- **Performance**: Using a dedicated gateway ensures fast retrieval.
