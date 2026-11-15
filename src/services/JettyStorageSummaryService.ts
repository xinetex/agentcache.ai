type JsonObject = Record<string, any>;
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function getJson(path: string, serviceKey: string): Promise<JsonObject> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://jettythunder.app${path}`, {
      method: 'GET',
      headers: { 'x-jetty-service-key': serviceKey, accept: 'application/json' },
      // Never forward the user-owned credential to a redirect destination.
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'provider_credentials_expired' : response.status === 403 ? 'provider_permission_denied' : 'provider_request_failed');
      (error as any).status = response.status;
      throw error;
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new Error('provider_response_invalid');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('provider_response_invalid');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PROVIDER_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error('provider_response_invalid');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new Error('provider_response_invalid');
    }
    if (!isObject(data) || data.success !== true) throw new Error('provider_response_invalid');
    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('provider_timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fixed, read-only JettyThunder adapter. It never accepts a caller supplied URL. */
export async function getJettyStorageSummary(serviceKey: string) {
  if (!/^ac_(prod|test)_[a-f0-9]{32,}$/i.test(serviceKey)) throw new Error('provider_credentials_invalid');
  const [quotaResponse, filesResponse] = await Promise.all([
    getJson('/api/v1/storage/quota', serviceKey),
    getJson('/api/v1/storage/files?limit=1&offset=0', serviceKey),
  ]);

  const quota = isObject(quotaResponse.user) ? quotaResponse.user : isObject(quotaResponse.tenant) ? quotaResponse.tenant : null;
  const pagination = isObject(filesResponse.pagination) ? filesResponse.pagination : null;
  if (!quota || !pagination) throw new Error('provider_response_invalid');
  const quotaBytes = numeric(quota.quotaBytes);
  const usedBytes = numeric(quota.usedBytes);
  // Remaining capacity can legitimately be negative if the provider lowered
  // a quota below existing usage; preserve that fact instead of losing the run.
  const remainingBytes = finiteNumber(quota.remainingBytes);
  const fileCount = numeric(pagination.total);
  if ([quotaBytes, usedBytes, remainingBytes, fileCount].some((value) => value === null)) throw new Error('provider_response_invalid');

  return {
    provider: 'jettythunder',
    quotaBytes,
    usedBytes,
    remainingBytes,
    usagePercent: numeric(quota.usagePercent),
    fileCount,
    observedAt: new Date().toISOString(),
  };
}
