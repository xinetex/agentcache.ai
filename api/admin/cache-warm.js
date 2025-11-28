export const config = { runtime: 'edge' };

// Cache Warming Admin Endpoint
// POST /api/admin/cache-warm
// Pre-populates cache with frequently requested prompts
// Protected by ADMIN_TOKEN

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

async function generateCacheKey(provider, model, messages, temperature = 0) {
  const canonical = {
    provider,
    model,
    messages,
    temperature
  };
  
  const requestStr = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(requestStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `agentcache:v1:${provider}:${model}:${hash}`;
}

async function warmCache(scenario) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis not configured');
  }
  
  const { provider, model, messages, response, ttl = 604800 } = scenario;
  
  // Generate cache key
  const cacheKey = await generateCacheKey(provider, model, messages, 0);
  
  // Build namespace prefix if provided
  const namespace = scenario.namespace;
  const nsPrefix = namespace ? `ns:${namespace}:` : '';
  const fullKey = nsPrefix + cacheKey;
  
  // Store in Redis
  const cacheEntry = {
    response,
    cached_at: new Date().toISOString(),
    hit_count: 0,
    warmed: true,
    provider,
    model,
    messages
  };
  
  const commands = [
    ['SET', fullKey, JSON.stringify(cacheEntry)],
    ['EXPIRE', fullKey, ttl]
  ];
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commands })
  });
  
  if (!res.ok) {
    throw new Error(`Redis operation failed: ${res.status}`);
  }
  
  return { key: fullKey, ttl };
}

// Common prompts for cache warming
const COMMON_SCENARIOS = [
  {
    name: 'Code explanation: React hooks',
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Explain React hooks in simple terms' }
    ],
    response: {
      choices: [{
        message: {
          role: 'assistant',
          content: 'React hooks are functions that let you "hook into" React features from function components. The most common hooks are:\n\n1. **useState** - Manages component state\n2. **useEffect** - Performs side effects (API calls, subscriptions)\n3. **useContext** - Accesses context values\n4. **useRef** - Creates mutable references\n\nHooks must be called at the top level of your component and follow specific rules.'
        }
      }],
      usage: { prompt_tokens: 10, completion_tokens: 95, total_tokens: 105 }
    }
  },
  {
    name: 'Python basics: List comprehension',
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is a Python list comprehension?' }
    ],
    response: {
      choices: [{
        message: {
          role: 'assistant',
          content: 'A list comprehension is a concise way to create lists in Python.\n\nSyntax: `[expression for item in iterable if condition]`\n\nExample:\n```python\n# Traditional loop\nsquares = []\nfor x in range(10):\n    squares.append(x**2)\n\n# List comprehension\nsquares = [x**2 for x in range(10)]\n```\n\nBenefits: More readable, faster execution, and Pythonic style.'
        }
      }],
      usage: { prompt_tokens: 9, completion_tokens: 112, total_tokens: 121 }
    }
  },
  {
    name: 'Database: SQL JOIN types',
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Explain SQL JOIN types' }
    ],
    response: {
      choices: [{
        message: {
          role: 'assistant',
          content: 'SQL JOIN types:\n\n1. **INNER JOIN**: Returns matching rows from both tables\n2. **LEFT JOIN**: All rows from left table + matches from right\n3. **RIGHT JOIN**: All rows from right table + matches from left\n4. **FULL OUTER JOIN**: All rows from both tables\n5. **CROSS JOIN**: Cartesian product of both tables\n\nExample:\n```sql\nSELECT * FROM users\nINNER JOIN orders ON users.id = orders.user_id;\n```'
        }
      }],
      usage: { prompt_tokens: 7, completion_tokens: 118, total_tokens: 125 }
    }
  },
  {
    name: 'API: REST vs GraphQL',
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the difference between REST and GraphQL?' }
    ],
    response: {
      choices: [{
        message: {
          role: 'assistant',
          content: 'REST vs GraphQL:\n\n**REST:**\n- Multiple endpoints for different resources\n- Fixed data structure per endpoint\n- Can over-fetch or under-fetch data\n- Simpler to implement\n\n**GraphQL:**\n- Single endpoint\n- Client specifies exact data needed\n- No over-fetching or under-fetching\n- Strongly typed schema\n- More complex setup\n\nUse REST for simple APIs, GraphQL for complex data requirements.'
        }
      }],
      usage: { prompt_tokens: 12, completion_tokens: 98, total_tokens: 110 }
    }
  },
  {
    name: 'DevOps: Docker vs Kubernetes',
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Explain Docker vs Kubernetes' }
    ],
    response: {
      choices: [{
        message: {
          role: 'assistant',
          content: '**Docker:**\n- Containerization platform\n- Packages apps with dependencies\n- Runs on single host\n- Good for development and simple deployments\n\n**Kubernetes:**\n- Container orchestration platform\n- Manages multiple Docker containers\n- Auto-scaling, load balancing, self-healing\n- Production-grade deployments\n\nAnalogy: Docker is the shipping container, Kubernetes is the port management system.'
        }
      }],
      usage: { prompt_tokens: 8, completion_tokens: 95, total_tokens: 103 }
    }
  }
];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  try {
    // Admin authentication
    const adminToken = req.headers.get('x-admin-token') || 
                       req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return json({ error: 'Unauthorized - invalid admin token' }, 401);
    }
    
    // Parse request
    const body = await req.json().catch(() => ({}));
    const { scenarios, namespace } = body;
    
    // Use provided scenarios or defaults
    const scenariosToWarm = scenarios || COMMON_SCENARIOS.map(s => ({
      ...s,
      namespace: namespace || s.namespace
    }));
    
    // Warm cache for each scenario
    const results = [];
    const errors = [];
    
    for (const scenario of scenariosToWarm) {
      try {
        const result = await warmCache(scenario);
        results.push({
          scenario: scenario.name || 'Custom scenario',
          key: result.key,
          ttl: result.ttl,
          status: 'success'
        });
      } catch (err) {
        errors.push({
          scenario: scenario.name || 'Custom scenario',
          error: err.message,
          status: 'failed'
        });
      }
    }
    
    return json({
      warmed: results.length,
      failed: errors.length,
      results,
      errors,
      message: `Successfully warmed ${results.length} cache entries`
    });
    
  } catch (err) {
    console.error('Cache warming error:', err);
    return json({
      error: 'Cache warming failed',
      details: err.message
    }, 500);
  }
}
