// tests/pipeline-builder.test.mjs
// Tests end-to-end Pipeline Studio APIs (Nodes, Templates, Validate, Generate, CRUD, and Edge Deploy)

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.AGENTCACHE_FORCE_MOCK_DB = '1';

import assert from 'node:assert/strict';
import pipelineRouter, { NODE_LIBRARY, PIPELINE_TEMPLATES } from '../src/api/pipeline.ts';

let passed = 0;

async function runAsyncTests() {
  console.log('pipeline-builder');

  // Test 1: Node library palette retrieval
  {
    const req = new Request('http://localhost/nodes', { method: 'GET' });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.nodes));
    assert.ok(data.nodes.some(n => n.id === 'cache_l1'));
    assert.ok(data.nodes.some(n => n.id === 'pii_validator'));
    passed++;
    console.log('  ✓ palette nodes retrieved');
  }

  // Test 2: Pre-built templates retrieval
  {
    const req = new Request('http://localhost/templates', { method: 'GET' });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.templates));
    assert.ok(data.templates.length >= 3);
    passed++;
    console.log('  ✓ pre-built templates retrieved');
  }

  // Test 3: Validation and Complexity Scoring
  {
    const payload = {
      sector: 'healthcare',
      nodes: [
        { id: '1', type: 'source' },
        { id: '2', type: 'pii_validator' },
        { id: '3', type: 'cache_l2' },
        { id: '4', type: 'openai' }
      ],
      connections: [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '4' }
      ]
    };
    const req = new Request('http://localhost/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.valid, true);
    assert.ok(data.complexity.score > 0);
    assert.ok(data.complexity.tier);
    passed++;
    console.log('  ✓ topology validated with complexity scoring');
  }

  // Test 4: Pipeline Generation (AI / deterministic fallback)
  {
    const payload = {
      prompt: 'Build a low latency cache for trading',
      sector: 'finance',
      performance: 'fast'
    };
    const req = new Request('http://localhost/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.pipeline.nodes.length > 0);
    passed++;
    console.log('  ✓ pipeline generated with reasoning trace');
  }

  // Test 5: Plural CRUD - POST / save pipeline
  let savedId = '';
  {
    const payload = {
      name: 'Test Healthcare Pipeline',
      sector: 'healthcare',
      nodes: [
        { id: '1', type: 'source', data: { label: 'EHR Ingress' } },
        { id: '2', type: 'cache_l1', data: { label: 'L1 Hot' } }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    };
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_user_token_12345'
      },
      body: JSON.stringify(payload)
    });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.pipeline.id);
    savedId = data.pipeline.id;
    passed++;
    console.log('  ✓ pipeline saved to data store');
  }

  // Test 6: Plural CRUD - GET / list
  {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test_user_token_12345' }
    });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.pipelines));
    assert.ok(data.pipelines.some(p => p.id === savedId || p.name === 'Test Healthcare Pipeline'));
    passed++;
    console.log('  ✓ user pipelines listed');
  }

  // Test 7: GET /:id retrieve single
  {
    const req = new Request(`http://localhost/${savedId}`, { method: 'GET' });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.pipeline.name, 'Test Healthcare Pipeline');
    passed++;
    console.log('  ✓ single pipeline retrieved');
  }

  // Test 8: POST /deploy - Deploy to Edge Network
  {
    const payload = {
      id: savedId,
      name: 'Test Healthcare Pipeline',
      sector: 'healthcare',
      nodes: [{ id: '1', type: 'source' }, { id: '2', type: 'cache_l1' }]
    };
    const req = new Request('http://localhost/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.deployment.apiKey.startsWith('ac_live_'));
    assert.ok(data.deployment.deploymentEndpoint.includes('/api/v1/cache'));
    assert.ok(data.snippets.curl.includes('curl -X POST'));
    assert.ok(data.snippets.python.includes('from agentcache import AgentCache'));
    passed++;
    console.log('  ✓ pipeline deployed to edge with API key & snippets');
  }

  // Test 9: DELETE /:id
  {
    const req = new Request(`http://localhost/${savedId}`, { method: 'DELETE' });
    const res = await pipelineRouter.request(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    passed++;
    console.log('  ✓ pipeline deleted');
  }

  console.log(`\n${passed} passed`);
  process.exit(0);
}

await runAsyncTests();
