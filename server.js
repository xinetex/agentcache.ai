import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Rate limiting store
const rateLimitStore = new Map();

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'",
        "img-src 'self' data: blob:",
    ].join('; '));
    next();
});

// Rate limiter (100 req/min per IP)
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000;
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

// Timeout enforcement (Vercel-compatible 8s limit)
app.use((req, res, next) => {
    res.setTimeout(8000, () => {
        console.error(`[Server] Timeout: ${req.method} ${req.url}`);
        if (!res.headersSent) {
            res.status(504).json({ error: 'Gateway Timeout' });
        }
    });
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Edge Request adapter for Vercel-style handlers
class EdgeRequest {
    constructor(req) {
        this.req = req;
        this.method = req.method;
        this.headers = new Map(Object.entries(req.headers));
        this.url = `http://localhost:${port}${req.originalUrl}`;
    }
    async json() { return this.req.body; }
}

// Wrapper: Vercel Edge Function → Express
const wrap = (handler) => async (req, res) => {
    try {
        const edgeReq = new EdgeRequest(req);
        const ctx = {
            waitUntil: (promise) => {
                Promise.resolve(promise).catch(err => console.error('[BG] Error:', err));
            }
        };
        const edgeRes = await handler(edgeReq, ctx);
        const status = edgeRes.status || 200;
        const data = await edgeRes.json();
        if (edgeRes.headers) {
            edgeRes.headers.forEach((value, key) => res.setHeader(key, value));
        }
        res.status(status).json(data);
    } catch (err) {
        console.error('[Server] Handler error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── Core Handlers ───────────────────────────────────────────
import authHandler from './api/auth.js';
import nodesHandler from './api/nodes.js';
import workflowsHandler from './api/workflows.js';
import subscribeHandler from './api/subscribe.js';
import telemetryHandler from './api/telemetry.js';
import templatesHandler from './api/templates.js';
import toolsHandler from './api/tools.js';

// ─── Auth Routes ─────────────────────────────────────────────
app.post('/api/auth/signup', wrap(authHandler));
app.post('/api/auth/login', wrap(authHandler));
app.get('/api/auth/me', wrap(authHandler));
app.post('/api/auth/logout', wrap(authHandler));
app.patch('/api/auth/settings', wrap(authHandler));

// ─── Node Control Plane ──────────────────────────────────────
app.all('/api/nodes', wrap(nodesHandler));
app.all('/api/telemetry', wrap(telemetryHandler));
app.all('/api/templates', wrap(templatesHandler));

// ─── Aletheia Grounded Tools (ComfyUI-style registry + execution) ─
app.all('/api/tools', wrap(toolsHandler));

// ─── Workflow & Connection Editor ────────────────────────────
app.all('/api/workflows', wrap(workflowsHandler));

// ─── Waitlist ────────────────────────────────────────────────
app.post('/api/subscribe', wrap(subscribeHandler));

// ─── Health ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'agentcache',
        timestamp: new Date().toISOString(),
        endpoints: ['/api/auth/*', '/api/nodes', '/api/subscribe', '/health'],
    });
});

// ─── Fallback ────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
    console.log(`\n  ⚡ AgentCache running on http://localhost:${port}\n`);
});
