import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Rate limiting store
const rateLimitStore = new Map();

// Security middleware
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
    next();
});

// Simple rate limiter (100 req/min per IP)
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, []);
    }

    const requests = rateLimitStore.get(ip).filter(time => now - time < windowMs);

    if (requests.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    requests.push(now);
    rateLimitStore.set(ip, requests);
    next();
});

// Force Timeout Middleware (Prevention of 504)
app.use((req, res, next) => {
    res.setTimeout(8000, () => {
        console.error(`[Server] Request Timeout: ${req.method} ${req.url}`);
        if (!res.headersSent) {
            res.status(504).json({ error: 'Gateway Timeout (Server Enforced)', details: 'The request took too long to process.' });
        }
    });
    next();
});

app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(express.static('public'));

// ---------------------------------------------------------
// Dashboard Routes (The "User Page" & "Mission Control")
// ---------------------------------------------------------
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/user-dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/mission-control.html'));
});

app.get('/login', (req, res) => {
    res.redirect('/dashboard'); // Auto-login flow for Demo
});
// ---------------------------------------------------------

// Mock Edge Runtime Request/Response
class EdgeRequest {
    constructor(req) {
        this.req = req;
        this.method = req.method;
        this.headers = new Map(Object.entries(req.headers));
    }
    async json() { return this.req.body; }
}

// Helper to wrap Vercel Edge Functions
const wrap = (handler) => async (req, res) => {
    try {
        const edgeReq = new EdgeRequest(req);
        // Mock context with waitUntil
        const ctx = {
            waitUntil: (promise) => {
                // In Node/Express, we just let the promise float or await it if we want to be strict
                // But for "background" tasks, usually we just don't await it here to unblock response.
                // However, to prevent unhandled rejections crashing, we catch.
                Promise.resolve(promise).catch(err => console.error('Background task error:', err));
            }
        };
        const edgeRes = await handler(edgeReq, ctx);

        // Convert Edge Response to Express Response
        const status = edgeRes.status || 200;
        const data = await edgeRes.json(); // This consumes the body!

        // Handle headers
        if (edgeRes.headers) {
            edgeRes.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });
        }

        res.status(status).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Import Handlers
// Note: In a real build step we might bundle these, but for this adapter we import directly
import spellingHandler from './api/spelling.js';
import constraintsHandler from './api/constraints.js';
import imageGenHandler from './api/image-gen.js';
import piiHandler from './api/pii.js';
import settingsHandler from './api/settings.js';
import integrationsHandler from './api/integrations.js';
import historyHandler from './api/history.js';
import authVerifyHandler from './api/auth/verify.js';
import agentChatHandler from './api/agent/chat.js';
import adminStatsHandler from './api/admin-stats.js';
import adminUsersHandler from './api/admin-users.js';

// API Routes
app.post('/api/spelling/fix', wrap(spellingHandler));
app.post('/api/constraints/enforce', wrap(constraintsHandler));
app.post('/api/image-gen/generate', wrap(imageGenHandler));
app.post('/api/pii/redact', wrap(piiHandler));
app.post('/api/settings', wrap(settingsHandler));
app.post('/api/integrations', wrap(integrationsHandler));
app.post('/api/history', wrap(historyHandler));
app.post('/api/auth/verify', wrap(authVerifyHandler));

app.post('/api/agent/chat', wrap(agentChatHandler));

app.get('/api/admin/stats', wrap(adminStatsHandler));
app.get('/api/admin/users', wrap(adminUsersHandler));

import adminContentHandler from './api/admin-content.js';
app.get('/api/content', wrap(adminContentHandler));
app.post('/api/content/card', wrap(adminContentHandler));
app.delete('/api/content/card/:id', wrap(adminContentHandler));

// Cache Routes (mapped from vercel.json rewrites)
import cacheHandler from './api/cache.js';
import cacheInvalidateHandler from './api/cache/invalidate.js';
import listenersRegisterHandler from './api/listeners/register.js';
import toolCacheHandler from './api/tool-cache.js';

app.post('/api/cache', wrap(cacheHandler));
app.post('/api/cache/get', wrap(cacheHandler));
app.post('/api/cache/set', wrap(cacheHandler));
app.post('/api/cache/check', wrap(cacheHandler));
app.post('/api/cache/invalidate', wrap(cacheInvalidateHandler));

app.post('/api/listeners/register', wrap(listenersRegisterHandler));
app.get('/api/listeners/register', wrap(listenersRegisterHandler));
app.delete('/api/listeners/register', wrap(listenersRegisterHandler));

app.post('/api/tool-cache', wrap(toolCacheHandler));
app.post('/api/tool-cache/get', wrap(toolCacheHandler));
app.post('/api/tool-cache/set', wrap(toolCacheHandler));

// MCP Bridge Route
import mcpBridgeHandler from './api/mcp-bridge.js';
import lidarIntentHandler from './api/lidar-intent.js';
app.post('/api/mcp/execute', wrap(mcpBridgeHandler));
app.post('/api/lidar/intent', wrap(lidarIntentHandler));

// JettySpeed Routes
import optimalEdgesHandler from './api/jetty/optimal-edges.js';
import checkDuplicateHandler from './api/jetty/check-duplicate.js';
import cacheChunkHandler from './api/jetty/cache-chunk.js';
import trackUploadHandler from './api/jetty/track-upload.js';

app.post('/api/jetty/optimal-edges', wrap(optimalEdgesHandler));
app.post('/api/jetty/check-duplicate', wrap(checkDuplicateHandler));
app.post('/api/jetty/cache-chunk', wrap(cacheChunkHandler));
app.get('/api/jetty/cache-chunk', wrap(cacheChunkHandler));
app.post('/api/jetty/track-upload', wrap(trackUploadHandler));

// Brain Memory Routes (AutoMem Integration)
import brainMemoryHandler from './api/brain/memory.js';

app.post('/api/brain/memory/store', wrap(brainMemoryHandler));
app.post('/api/brain/memory/recall', wrap(brainMemoryHandler));
app.post('/api/brain/memory/associate', wrap(brainMemoryHandler));
app.get('/api/brain/memory/health', wrap(brainMemoryHandler));
app.get('/api/brain/memory/enrichment/status', wrap(brainMemoryHandler));
app.get('/api/brain/memory/:id', wrap(brainMemoryHandler));
app.patch('/api/brain/memory/:id', wrap(brainMemoryHandler));
app.delete('/api/brain/memory/:id', wrap(brainMemoryHandler));
app.get('/api/brain/memory/:id/graph', wrap(brainMemoryHandler));

// JettyThunder Provisioning Webhook
import jettyThunderProvisionHandler from './api/webhooks/jettythunder-provision.js';

app.post('/api/webhooks/jettythunder/provision', wrap(jettyThunderProvisionHandler));

// CDN Routes (Audio1.TV Video Streaming)
import cdnStreamHandler from './api/cdn/stream.js';
import cdnMetricsHandler from './api/cdn/metrics.js';
import cdnWarmHandler from './api/cdn/warm.js';
import cdnInvalidateHandler from './api/cdn/invalidate.js';

// Special wrapper for CDN stream that handles binary responses
const wrapCdn = (handler) => async (req, res) => {
    try {
        const edgeReq = new EdgeRequest(req);
        // Add URL property for query string parsing
        edgeReq.url = `http://localhost${req.originalUrl}`;

        const edgeRes = await handler(edgeReq);
        const status = edgeRes.status || 200;

        // Handle headers
        if (edgeRes.headers) {
            edgeRes.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });
        }

        // Check content type for binary vs JSON response
        const contentType = edgeRes.headers?.get('Content-Type') || '';
        if (contentType.includes('video') || contentType.includes('mpegURL')) {
            // Binary response (video segment)
            const buffer = await edgeRes.arrayBuffer();
            res.status(status).send(Buffer.from(buffer));
        } else {
            // JSON response
            const data = await edgeRes.json();
            res.status(status).json(data);
        }
    } catch (err) {
        console.error('CDN error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// CDN endpoints
app.get('/api/cdn/stream', wrapCdn(cdnStreamHandler));
app.options('/api/cdn/stream', (req, res) => res.status(204).end());
app.get('/api/cdn/metrics', wrap(cdnMetricsHandler));
app.post('/api/cdn/warm', wrap(cdnWarmHandler));
app.post('/api/cdn/invalidate', wrap(cdnInvalidateHandler));
app.delete('/api/cdn/invalidate', wrap(cdnInvalidateHandler));

// ==================================================
// QChannel Routes (Crypto Market Intelligence)
// See: docs/QCHANNEL_EXTENSION.md
// ==================================================
import qchannelZonesHandler from './api/qchannel/zones.js';
import qchannelFeedHandler from './api/qchannel/feed.js';
import qchannelAdsHandler from './api/qchannel/ads.js';
import qchannelAnalyticsHandler from './api/qchannel/analytics.js';

// Zone CRUD
app.get('/api/qchannel/zones', wrap(qchannelZonesHandler));
app.get('/api/qchannel/zones/:id', wrap(qchannelZonesHandler));
app.post('/api/qchannel/zones', wrap(qchannelZonesHandler));
app.patch('/api/qchannel/zones/:id', wrap(qchannelZonesHandler));
app.delete('/api/qchannel/zones/:id', wrap(qchannelZonesHandler));

// Roku MRSS Feed
app.get('/api/qchannel/feed/roku', wrap(qchannelFeedHandler));
app.get('/api/qchannel/feed/zones/:id', wrap(qchannelFeedHandler));

// Ad Network (Google Ad Manager / VAST)
app.get('/api/qchannel/ads/vast/:type', wrap(qchannelAdsHandler));
app.post('/api/qchannel/ads/event', wrap(qchannelAdsHandler));

// Analytics
app.post('/api/qchannel/analytics/view', wrap(qchannelAnalyticsHandler));
app.get('/api/qchannel/analytics/summary', wrap(qchannelAnalyticsHandler));

// Visuals / Artwork
import qchannelVisualsHandler from './api/qchannel/visuals.js';
app.get('/api/qchannel/visuals', wrap(qchannelVisualsHandler));
app.post('/api/qchannel/visuals', wrap(qchannelVisualsHandler));

// HLS rewrite route for player-friendly URLs
app.get('/hls/:jobId/:quality/:segment', (req, res, next) => {
    req.query.jobId = req.params.jobId;
    req.query.quality = req.params.quality;
    req.query.segment = req.params.segment;
    wrapCdn(cdnStreamHandler)(req, res);
});

// Branded Media Route
app.get('/media/*', (req, res) => {
    // The path will be parsed by cdnStreamHandler from req.url
    wrapCdn(cdnStreamHandler)(req, res);
});

// Thumbnail Service Routes (proxy to internal microservice)
const THUMBNAIL_SERVICE = process.env.THUMBNAIL_SERVICE_URL || 'http://thumbnail:8080';

app.post('/api/thumbnail/generate', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Thumbnail] Generate error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/thumbnail/status/:id', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/jobs/${req.params.id}`);
        if (!response.ok) return res.status(404).json({ error: 'Job not found' });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/thumbnail/poster/:id', async (req, res) => {
    try {
        const response = await fetch(`${THUMBNAIL_SERVICE}/poster/${req.params.id}`);
        if (!response.ok) return res.status(404).json({ error: 'Job not found' });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Fallback to index.html for SPA-like behavior if needed, or just 404
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/studio.html'));
});

app.listen(port, () => {
    console.log(`AgentCache Edge running on port ${port}`);
});
