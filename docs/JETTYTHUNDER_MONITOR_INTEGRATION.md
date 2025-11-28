# AgentCache Monitor Widget - JettyThunder Integration Guide

## Overview

This guide shows how to integrate the **AgentCache Monitor Widget** into JettyThunder's dashboard so users can see their file transfer cache activity in real-time.

## What Users See

When a JettyThunder user logs in, they'll see a dashboard card showing:

- **Connection Status**: Active edge locations, latency, and connection quality
- **Performance Metrics**: Cache hit rate, bandwidth saved, upload acceleration
- **Active Transfers**: Real-time progress of ongoing file uploads
- **Recent Activity**: Feed of completed transfers with speed multipliers
- **Cache Status**: Number of cached files and chunks

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              JettyThunder Dashboard                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │   <iframe src="agentcache.ai/widgets/monitor">  │  │
│  │                    │                             │  │
│  └────────────────────┼─────────────────────────────┘  │
│                       │                                 │
└───────────────────────┼─────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  AgentCache API       │
            │  /api/jetty/user-stats│
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Redis + Neon DB      │
            │  • Session data       │
            │  • Edge metrics       │
            │  • Upload history     │
            └───────────────────────┘
```

## Integration Steps

### Option 1: iFrame Embed (Quickest)

Add this to your JettyThunder dashboard page:

```html
<div class="dashboard-card">
  <iframe 
    src="https://agentcache.ai/widgets/agentcache-monitor.html?apiKey=USER_API_KEY&userId=USER_ID"
    width="100%" 
    height="800" 
    frameborder="0"
    style="border-radius: 8px; overflow: hidden;"
  ></iframe>
</div>
```

**Replace dynamically:**
- `USER_API_KEY`: JettyThunder user's AgentCache API key
- `USER_ID`: JettyThunder user ID

### Option 2: React Component (Recommended)

Create a React component wrapper:

```tsx
// components/AgentCacheMonitor.tsx
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export function AgentCacheMonitor() {
  const { data: session } = useSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const apiKey = session?.user?.agentcacheApiKey;
  const userId = session?.user?.id;
  
  if (!apiKey || !userId) {
    return (
      <div className="rounded-lg border border-slate-800 p-6 text-center">
        <p className="text-slate-400">AgentCache not configured</p>
        <button className="mt-4 btn-primary">
          Enable AgentCache CDN
        </button>
      </div>
    );
  }
  
  const widgetUrl = `https://agentcache.ai/widgets/agentcache-monitor.html?apiKey=${apiKey}&userId=${userId}`;
  
  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <iframe
        ref={iframeRef}
        src={widgetUrl}
        className="w-full h-[800px] border-0"
        title="AgentCache Monitor"
      />
    </div>
  );
}
```

Use it in your dashboard:

```tsx
// app/dashboard/page.tsx
import { AgentCacheMonitor } from '@/components/AgentCacheMonitor';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Other dashboard cards */}
      <div className="col-span-4">
        <AgentCacheMonitor />
      </div>
    </div>
  );
}
```

### Option 3: Direct API Integration (Most Control)

Fetch stats directly and render with your own components:

```tsx
// lib/agentcache.ts
export async function fetchUserStats(userId: string, apiKey: string) {
  const response = await fetch(
    `https://agentcache.ai/api/jetty/user-stats?userId=${userId}&period=24h`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}

// components/AgentCacheStats.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchUserStats } from '@/lib/agentcache';

export function AgentCacheStats({ userId, apiKey }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agentcache-stats', userId],
    queryFn: () => fetchUserStats(userId, apiKey),
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>AgentCache CDN</CardTitle>
          <Badge variant={data.connection.status}>
            {data.connection.status}
          </Badge>
        </CardHeader>
        <CardContent>
          {data.connection.active_edges.map(edge => (
            <EdgeItem key={edge.id} edge={edge} />
          ))}
        </CardContent>
      </Card>
      
      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Metric 
              label="Cache Hit Rate" 
              value={`${data.performance.cache_hit_rate_percent}%`} 
            />
            <Metric 
              label="Bandwidth Saved" 
              value={`${data.performance.bandwidth_saved_gb} GB`} 
            />
            <Metric 
              label="Avg Download" 
              value={`${data.performance.average_download_ms}ms`} 
            />
            <Metric 
              label="Upload Accel" 
              value={`${data.performance.upload_acceleration}x`} 
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Active Transfers */}
      {data.file_transfers.active_transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            {data.file_transfers.active_transfers.map(transfer => (
              <TransferProgress key={transfer.session_id} transfer={transfer} />
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={data.file_transfers.recent_activity} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## API Reference

### Endpoint: `GET /api/jetty/user-stats`

**Query Parameters:**
- `userId` (required): JettyThunder user ID
- `period` (optional): `1h`, `24h`, `7d`, `30d` (default: `24h`)

**Headers:**
- `Authorization: Bearer <apiKey>`

**Response:**
```json
{
  "period": "24h",
  "userId": "usr_123",
  "timestamp": "2025-11-28T11:00:00Z",
  "connection": {
    "status": "connected",
    "active_edges": [
      {
        "id": "sf-1",
        "city": "San Francisco",
        "latency_ms": 42,
        "utilization_percent": 65
      }
    ],
    "average_latency_ms": 45
  },
  "file_transfers": {
    "total_uploads": 12,
    "total_downloads": 5,
    "active_transfers": [
      {
        "session_id": "sess_abc",
        "file_name": "video.mp4",
        "file_size": 1073741824,
        "progress_percent": 67,
        "speed_mbps": 25.4,
        "edges_used": ["sf-1", "ny-2"],
        "started_at": "2025-11-28T10:58:00Z"
      }
    ],
    "recent_activity": [
      {
        "timestamp": "2025-11-28T10:55:00Z",
        "type": "upload",
        "file_name": "document.pdf",
        "file_size": 15728640,
        "duration_seconds": 5,
        "speed_multiplier": 3.2,
        "cache_hit": false,
        "edges_used": ["sf-1", "ny-2", "eu-1"]
      }
    ]
  },
  "performance": {
    "cache_hit_rate_percent": 78.5,
    "bandwidth_saved_gb": 2.4,
    "average_download_ms": 38,
    "upload_acceleration": 3.8
  },
  "cache_status": {
    "cached_files": 45,
    "cached_chunks": 1250,
    "total_cached_size_gb": 12.5,
    "files": [
      {
        "file_id": "file_abc",
        "file_name": "video.mp4",
        "cached_chunks": 20,
        "total_chunks": 20,
        "ttl_hours": 48
      }
    ]
  }
}
```

## Authentication Flow

1. User signs up on JettyThunder
2. JettyThunder calls AgentCache provisioning webhook
3. AgentCache creates storage account and returns API key
4. JettyThunder stores API key in user record
5. Dashboard loads monitor widget with user's API key

```typescript
// Example: Store API key after provisioning
async function provisionAgentCache(userId: string, email: string) {
  const response = await fetch(
    'https://agentcache.ai/api/webhooks/jetty/provision',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.AGENTCACHE_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({
        user_id: userId,
        email: email,
        tier: 'pro',
      }),
    }
  );
  
  const data = await response.json();
  
  // Store in user record
  await db.user.update({
    where: { id: userId },
    data: {
      agentcacheApiKey: data.api_key,
      agentcacheEnabled: true,
    },
  });
  
  return data;
}
```

## Styling Customization

The widget uses Tailwind classes. You can customize via CSS overrides:

```css
/* Override widget styles */
iframe[title="AgentCache Monitor"] {
  /* Dark theme matching JettyThunder */
  filter: brightness(0.95);
}

/* Or use postMessage to change theme */
<script>
  const iframe = document.querySelector('iframe');
  iframe.contentWindow.postMessage({
    type: 'theme',
    theme: 'dark',
    accent: '#0ea5e9', // sky-500
  }, 'https://agentcache.ai');
</script>
```

## Testing

### 1. Test Widget Locally

```bash
# Serve widget locally
cd /Users/letstaco/Documents/agentcache-ai
python3 -m http.server 8080

# Open in browser
open http://localhost:8080/public/widgets/agentcache-monitor.html?apiKey=ac_demo_test123&userId=test_user
```

### 2. Test API Endpoint

```bash
export API_KEY="your_jettythunder_api_key"
export USER_ID="your_user_id"

curl -X GET "https://agentcache.ai/api/jetty/user-stats?userId=$USER_ID&period=24h" \
  -H "Authorization: Bearer $API_KEY"
```

### 3. Test in JettyThunder

Add temporary test route:

```typescript
// app/test/monitor/page.tsx
export default function MonitorTestPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AgentCache Monitor Test</h1>
      <iframe
        src="https://agentcache.ai/widgets/agentcache-monitor.html?apiKey=ac_demo_test123&userId=test_user"
        className="w-full h-[1000px] border rounded-lg"
      />
    </div>
  );
}
```

## Deployment Checklist

### AgentCache Side

- [x] Deploy `/api/jetty/user-stats.ts` endpoint
- [x] Deploy widget HTML to `/public/widgets/agentcache-monitor.html`
- [ ] Set up CORS to allow jettythunder.app origin
- [ ] Add monitoring for API endpoint performance
- [ ] Set up rate limiting (500 req/min per user)

### JettyThunder Side

- [ ] Add `agentcacheApiKey` field to user model
- [ ] Implement provisioning flow on signup
- [ ] Create dashboard component with iframe/React wrapper
- [ ] Add "Enable AgentCache" CTA for users without it
- [ ] Test with demo API key first
- [ ] Deploy to staging, test with real users
- [ ] Deploy to production

## Support

For issues or questions:
- **AgentCache Team**: support@agentcache.ai
- **JettyThunder Team**: Your internal channels
- **Documentation**: https://agentcache.ai/docs/jetty-integration

## Example Screenshots

```
┌─────────────────────────────────────────┐
│  🚀 AgentCache CDN                      │
│  ● 5 edges active                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  📍 San Francisco     42ms  ████████░   │
│  📍 New York         38ms  ██████░░░   │
│  📍 London           95ms  ███░░░░░░   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Avg Latency: 45ms                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Performance (24h)                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Cache Hit Rate    Bandwidth Saved      │
│     78.5%             2.4 GB            │
│                                         │
│  Avg Download      Upload Accel         │
│      38ms             3.8x              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Active Transfers                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  video.mp4                    25.4 MB/s │
│  ████████████████░░░░░░░░░░░░ 67%     │
│  67% • 2 edges                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Recent Activity                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ⬆ video.mp4                            │
│     1.2GB • 45s • 3.2x faster • 3 edges │
│     2m ago                              │
│                                         │
│  ⬇ document.pdf                         │
│     15MB • Cache HIT • SF edge • 38ms   │
│     5m ago                              │
└─────────────────────────────────────────┘
```
