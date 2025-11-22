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

app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(express.static('public'));

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
        const edgeRes = await handler(edgeReq);

        // Convert Edge Response to Express Response
        const status = edgeRes.status || 200;
        const data = await edgeRes.json();

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

// API Routes
app.post('/api/spelling/fix', wrap(spellingHandler));
app.post('/api/constraints/enforce', wrap(constraintsHandler));
app.post('/api/image-gen/generate', wrap(imageGenHandler));
app.post('/api/pii/redact', wrap(piiHandler));
app.post('/api/settings', wrap(settingsHandler));
app.post('/api/integrations', wrap(integrationsHandler));
app.post('/api/history', wrap(historyHandler));
app.post('/api/auth/verify', wrap(authVerifyHandler));

// Cache Routes (mapped from vercel.json rewrites)
import cacheHandler from './api/cache.js';
import toolCacheHandler from './api/tool-cache.js';

app.post('/api/cache', wrap(cacheHandler));
app.post('/api/cache/get', wrap(cacheHandler));
app.post('/api/cache/set', wrap(cacheHandler));
app.post('/api/cache/check', wrap(cacheHandler));

app.post('/api/tool-cache', wrap(toolCacheHandler));
app.post('/api/tool-cache/get', wrap(toolCacheHandler));
app.post('/api/tool-cache/set', wrap(toolCacheHandler));

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
