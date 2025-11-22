import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
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

// Fallback to index.html for SPA-like behavior if needed, or just 404
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/studio.html'));
});

app.listen(port, () => {
    console.log(`AgentCache Edge running on port ${port}`);
});
