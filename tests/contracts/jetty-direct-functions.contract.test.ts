import { describe, expect, it, vi } from 'vitest';

const jettySpeedDbMock = vi.hoisted(() => ({
  getActiveEdges: vi.fn(),
  getAllEdgeMetrics: vi.fn(),
}));

vi.mock('../../src/services/jettySpeedDb.js', () => ({ jettySpeedDb: jettySpeedDbMock }));
vi.mock('@upstash/redis', () => ({ Redis: class { } }));

import { POST as optimalEdges } from '../../api/jetty/optimal-edges.ts';
import { POST as trackUpload } from '../../api/jetty/track-upload.ts';
import { GET as readChunk, POST as cacheChunk } from '../../api/jetty/cache-chunk.ts';

function request(path: string, method: string, body?: Record<string, unknown>, authenticated = true) {
  return new Request(`https://agentcache.test${path}`, {
    method,
    headers: {
      ...(authenticated ? { Authorization: 'Bearer contract-test-key' } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('JettyThunder direct Vercel function contracts', () => {
  it('keeps optimal-edges authenticated and supports both documented GET and existing POST calls', async () => {
    expect((await optimalEdges(request('/api/jetty/optimal-edges', 'POST', {}, false))).status).toBe(401);
    const response = await optimalEdges(request('/api/jetty/optimal-edges', 'POST', { userId: 'user-1' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Missing required fields: userId, fileSize, fileHash' });

    jettySpeedDbMock.getActiveEdges.mockResolvedValueOnce([{
      id: 'edge-1', url: 'https://edge.example', city: 'Detroit', country: 'US',
      lat: 42.3314, lng: -83.0458, provider: 'test', is_active: true,
    }]);
    jettySpeedDbMock.getAllEdgeMetrics.mockResolvedValueOnce(new Map());
    const getResponse = await optimalEdges(request('/api/jetty/optimal-edges?fileSize=1024&lat=42.3314&lng=-83.0458', 'GET'));
    expect(getResponse.status).toBe(200);
    const payload = await getResponse.json();
    expect(payload.edges.map((edge: any) => edge.id)).toContain('edge-1');
    expect(payload.edges.map((edge: any) => edge.id)).toContain('lyve-direct');
  });

  it('keeps the track-upload handler authenticated and validates its action', async () => {
    expect((await trackUpload(request('/api/jetty/track-upload', 'POST', {}, false))).status).toBe(401);
    const response = await trackUpload(request('/api/jetty/track-upload', 'POST', {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Missing required field: action' });
  });

  it('keeps both cache-chunk methods mounted and validates their required fields', async () => {
    expect((await readChunk(request('/api/jetty/cache-chunk', 'GET', undefined, false))).status).toBe(401);
    const missingSession = await readChunk(request('/api/jetty/cache-chunk', 'GET'));
    expect(missingSession.status).toBe(400);
    expect(await missingSession.json()).toMatchObject({ error: 'Missing sessionId parameter' });

    expect((await cacheChunk(request('/api/jetty/cache-chunk', 'POST', {}, false))).status).toBe(401);
    const missingChunkFields = await cacheChunk(request('/api/jetty/cache-chunk', 'POST', { sessionId: 'session-1' }));
    expect(missingChunkFields.status).toBe(400);
    expect(await missingChunkFields.json()).toMatchObject({ error: 'Missing required fields: sessionId, chunkIndex, status' });
  });
});
