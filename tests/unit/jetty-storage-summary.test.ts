import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJettyStorageSummary } from '../../src/services/JettyStorageSummaryService.js';

const validKey = `ac_test_${'a'.repeat(32)}`;

afterEach(() => vi.unstubAllGlobals());

describe('Jetty storage summary adapter', () => {
  it('makes two fixed read calls and returns aggregate values only', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/storage/quota')) return Response.json({ success: true, user: { quotaBytes: 1000, usedBytes: 250, remainingBytes: 750, usagePercent: 25 } });
      return Response.json({ success: true, files: [{ id: 'private-id', name: 'private-name', lyveKey: 'private-key' }], pagination: { total: 9 } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getJettyStorageSummary(validKey);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).sort()).toEqual([
      'https://jettythunder.app/api/v1/storage/files?limit=1&offset=0',
      'https://jettythunder.app/api/v1/storage/quota',
    ]);
    expect(result).toMatchObject({ quotaBytes: 1000, usedBytes: 250, remainingBytes: 750, usagePercent: 25, fileCount: 9 });
    expect(JSON.stringify(result)).not.toMatch(/private-id|private-name|private-key/);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'x-jetty-service-key': validKey, accept: 'application/json' });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error');
  });

  it('rejects malformed service keys before making provider requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getJettyStorageSummary('unsafe')).rejects.toThrow('provider_credentials_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'provider_credentials_expired'],
    [403, 'provider_permission_denied'],
    [503, 'provider_request_failed'],
  ])('maps provider HTTP %i to a stable error without exposing credentials', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('provider detail with secret', { status })));
    await expect(getJettyStorageSummary(validKey)).rejects.toThrow(code);
    try {
      await getJettyStorageSummary(validKey);
    } catch (error: any) {
      expect(error.message).not.toContain(validKey);
      expect(error.message).not.toContain('provider detail');
    }
  });

  it('maps provider timeouts without exposing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }));
    await expect(getJettyStorageSummary(validKey)).rejects.toThrow('provider_timeout');
  });

  it('rejects incomplete provider payloads without returning private data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, user: { quotaBytes: 1, privateName: 'secret' } })));
    await expect(getJettyStorageSummary(validKey)).rejects.toThrow('provider_response_invalid');
  });

  it('preserves negative remaining capacity when usage exceeds the current quota', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/api/v1/storage/quota')) {
        return Response.json({ success: true, user: { quotaBytes: 100, usedBytes: 120, remainingBytes: -20, usagePercent: 120 } });
      }
      return Response.json({ success: true, files: [], pagination: { total: 0 } });
    }));

    await expect(getJettyStorageSummary(validKey)).resolves.toMatchObject({
      quotaBytes: 100, usedBytes: 120, remainingBytes: -20, usagePercent: 120, fileCount: 0,
    });
  });

  it('rejects oversized provider responses before parsing or retaining them', async () => {
    const body = JSON.stringify({ success: true, user: { quotaBytes: 1 }, padding: 'x'.repeat(70_000) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'content-type': 'application/json' } })));
    await expect(getJettyStorageSummary(validKey)).rejects.toThrow('provider_response_invalid');
  });
});
