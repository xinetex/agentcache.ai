# QChannel Extension for AgentCache

> **Note for Future Agents**: This module was added on 2025-12-30 as part of the QChannel Crypto News Platform project. It extends AgentCache with OTT/Roku channel management capabilities.

## Overview

QChannel is a crypto market news channel (like a "Weather Channel for crypto") that runs on:
- **Web**: Next.js frontend at `/Users/letstaco/Documents/QCrypto Channel/web`
- **Roku**: BrightScript channel at `/Users/letstaco/Documents/QCrypto Channel/roku`
- **Backend**: This AgentCache extension

## Database Tables

Run migration: `db/migrations/004_qchannel.sql`

| Table | Purpose |
|-------|---------|
| `qchannel_zones` | Content categories (Solana, AI, Memes, RWA, etc.) |
| `qchannel_news_sources` | RSS feeds and API endpoints for news |
| `qchannel_ad_placements` | Google Ad Manager / VAST integration |
| `qchannel_ad_events` | Ad impression/completion tracking |
| `qchannel_analytics` | View engagement metrics |

## API Routes

All routes under `/api/qchannel/`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/zones` | GET | List all active zones |
| `/zones/:id` | GET/PATCH/DELETE | Zone CRUD |
| `/feed/roku` | GET | Roku MRSS feed for EPG |
| `/ads/vast/:zoneId` | GET | VAST tag proxy |
| `/ads/event` | POST | Log ad events |
| `/analytics/view` | POST | Log content views |

## Integration with QChannel Web

The QChannel web app can optionally use AgentCache for:
1. **Zone management** - Instead of hardcoded zones
2. **News aggregation** - Centralized RSS fetching
3. **Ad serving** - VAST tag management
4. **Analytics** - Cross-platform view tracking

## Integration with Roku Channel

The Roku channel uses:
- `/api/qchannel/feed/roku` for content feed
- `/api/qchannel/ads/vast` for pre-roll ads via Roku RAF

## Related Projects

- **JettyThunder.app**: Storage service (existing integration)
- **Audio1.tv**: Video streaming CDN (existing `/api/cdn` routes)

## Sellable Service Potential

Two features marked for potential white-label offering:
1. **Content Management API** - OTT channel content management
2. **Ad Server Proxy** - VAST wrapping with analytics for CTV

---
*Created by: Lead Programmer, QChannel Project*
