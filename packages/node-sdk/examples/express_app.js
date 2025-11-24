const express = require('express');
const { agentCacheMiddleware, withCache, agentcache } = require('../dist');

// Mock LLM Client
const gemini = {
    chat: async ({ messages }) => {
        console.log('🤖 Calling Gemini API (Expensive)...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate latency
        return {
            role: 'model',
            content: `Response to: ${messages[0].content}`
        };
    }
};

const app = express();
app.use(express.json());

// 1. Middleware Pattern (Route Caching)
app.post('/api/chat', agentCacheMiddleware({
    namespaceFromReq: (req) => `user_${req.body.userId}`,
    ttl: 60 // 1 minute
}), async (req, res) => {
    const response = await gemini.chat({ messages: req.body.messages });
    res.json(response);
});

// 2. Wrapper Pattern (Function Caching)
const cachedGemini = withCache(gemini.chat, {
    namespace: 'global_knowledge',
    keyGenerator: (args) => args.messages[0].content
});

app.post('/api/knowledge', async (req, res) => {
    const response = await cachedGemini({ messages: req.body.messages });
    res.json(response);
});

// Start Server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Test Server running on http://localhost:${PORT}`);
    console.log('   POST /api/chat      -> Middleware Caching');
    console.log('   POST /api/knowledge -> Wrapper Caching');
});
