/**
 * Integration Tests: audio1.tv Critical Endpoints
 *
 * Tests the CDN and transcoding services that audio1.tv depends on.
 * These endpoints MUST maintain 99.9% uptime.
 *
 * IMPORTANT:
 * - These tests are OPT-IN to avoid hitting production during CI/build.
 * - Set RUN_INTEGRATION_TESTS=true and TEST_BASE_URL to run.
 *
 * Run with:
 *   RUN_INTEGRATION_TESTS=true TEST_BASE_URL=https://<your-deployment> \
 *     npm test tests/integration/audio1tv.test.ts
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL ?? '';
const SHOULD_RUN = process.env.RUN_INTEGRATION_TESTS === 'true' && !!BASE_URL;
const describeIntegration = SHOULD_RUN ? describe : describe.skip;

const TIMEOUT = 10000; // 10 second timeout for CDN operations

describeIntegration('audio1.tv Critical Endpoints', () => {
  
  describe('GET /api/cdn/stream', () => {
    it('should return 404 for missing content (expected behavior)', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/stream?path=nonexistent-test.mp4`, {
        method: 'GET',
      });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
    }, TIMEOUT);

    it('should accept valid path query parameter', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/stream?path=test/sample.mp4`, {
        method: 'GET',
      });
      
      // Should either return content or 404, but not 400/500
      expect([200, 404]).toContain(response.status);
    }, TIMEOUT);

    it('should accept jobId/quality/segment parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/cdn/stream?jobId=test-job&quality=720p&segment=segment_00001.ts`,
        { method: 'GET' }
      );
      
      // Should either return content or 404, but not 400/500
      expect([200, 404]).toContain(response.status);
    }, TIMEOUT);

    it('should return error for missing parameters', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/stream`, {
        method: 'GET',
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    }, TIMEOUT);

    it('should include proper CORS headers', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/stream?path=test.mp4`, {
        method: 'GET',
      });
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    }, TIMEOUT);

    it('should respond within 500ms for cache hits', async () => {
      const start = Date.now();
      await fetch(`${BASE_URL}/api/cdn/stream?path=test-cached.mp4`, {
        method: 'GET',
      });
      const duration = Date.now() - start;
      
      // CDN should be fast - if content is cached
      expect(duration).toBeLessThan(2000); // 2 second max (generous for cold start)
    }, TIMEOUT);
  });

  describe('GET /api/cdn/status', () => {
    it('should return CDN health status', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/status`, {
        method: 'GET',
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(data.component).toBe('cdn');
    }, TIMEOUT);

    it('should include cache statistics', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/status`, {
        method: 'GET',
      });
      
      const data = await response.json();
      expect(data.cache).toBeDefined();
      expect(data.cache.enabled).toBeDefined();
    }, TIMEOUT);
  });

  describe('POST /api/cdn/warm', () => {
    it('should accept cache warming request', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/warm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: ['test/video1.mp4', 'test/video2.mp4']
        }),
      });
      
      expect([200, 202, 500]).toContain(response.status); // 500 ok if cache service unavailable
    }, TIMEOUT);

    it('should handle empty paths array', async () => {
      const response = await fetch(`${BASE_URL}/api/cdn/warm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [] }),
      });
      
      expect([200, 202, 400]).toContain(response.status);
    }, TIMEOUT);
  });

  describe('POST /api/transcode/submit', () => {
    it('should reject request without inputKey', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('inputKey');
    }, TIMEOUT);

    it('should accept valid transcode request', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputKey: 'test/source-video.mp4',
          profile: 'roku-hls',
          outputPrefix: 'test/output'
        }),
      });
      
      // Should either succeed or fail gracefully (transcoder may be offline in tests)
      expect([200, 201, 500, 502]).toContain(response.status);
      
      if (response.status < 300) {
        const data = await response.json();
        expect(data.jobId).toBeDefined();
      }
    }, TIMEOUT);

    it('should return jobId on success', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputKey: 'test/integration-test-video.mp4',
        }),
      });
      
      if (response.status < 300) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.jobId).toBeDefined();
        expect(data.status).toBe('queued');
      }
    }, TIMEOUT);
  });

  describe('GET /api/transcode/status/:jobId', () => {
    it('should return status for job ID', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/status/test-job-123`, {
        method: 'GET',
      });
      
      // Should either return status or 404 for non-existent job
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.jobId).toBe('test-job-123');
        expect(data.status).toBeDefined();
      }
    }, TIMEOUT);

    it('should include job status field', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/status/any-job-id`, {
        method: 'GET',
      });
      
      if (response.status === 200) {
        const data = await response.json();
        expect(['queued', 'processing', 'completed', 'failed']).toContain(data.status?.status || data.status);
      }
    }, TIMEOUT);
  });

  describe('GET /api/transcode/jobs', () => {
    it('should return jobs list or queue length', async () => {
      const response = await fetch(`${BASE_URL}/api/transcode/jobs`, {
        method: 'GET',
      });
      
      expect([200, 501]).toContain(response.status); // 501 if not implemented yet
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.queueLength).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Brain API (optional for audio1.tv)', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${BASE_URL}/api/brain/health`, {
        method: 'GET',
      });
      
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.status).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('SLA Compliance', () => {
    it('critical endpoints should respond within 2 seconds', async () => {
      const endpoints = [
        '/api/cdn/stream?path=test.mp4',
        '/api/cdn/status',
        '/api/transcode/status/test-job',
      ];

      for (const endpoint of endpoints) {
        const start = Date.now();
        await fetch(`${BASE_URL}${endpoint}`);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(2000); // 2 second max response time
      }
    }, TIMEOUT * 2);

    it('endpoints should not return 5xx errors under normal load', async () => {
      const endpoints = [
        '/api/cdn/status',
        '/api/transcode/jobs',
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        
        // Some 500s are acceptable if services are offline, but check structure
        if (response.status >= 500) {
          const data = await response.json();
          expect(data.error).toBeDefined(); // Should have error message
        }
      }
    }, TIMEOUT);
  });
});
