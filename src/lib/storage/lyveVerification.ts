import { HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { inferRegionFromStorageEndpoint, validateBlobStorageConfig } from '../agent-memory/layers/blob.js';

export type LyveVerificationConfig = {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  objectKey?: string;
  timeoutMs?: number;
};

export type LyveCheckStatus =
  | 'ok'
  | 'reachable'
  | 'access_denied'
  | 'not_found'
  | 'skipped'
  | 'error';

export type LyveCheckResult = {
  ok: boolean;
  status: LyveCheckStatus;
  detail: string;
};

export type LyveVerificationResult = {
  config: {
    endpoint?: string;
    bucket?: string;
    region?: string;
    inferredRegion?: string;
    hasCredentials: boolean;
    hasObjectKey: boolean;
  };
  warnings: string[];
  checks: {
    endpoint: LyveCheckResult;
    listScope: LyveCheckResult;
    objectScope: LyveCheckResult;
  };
  summary: {
    reachable: boolean;
    leastPrivilegeLikely: boolean;
    objectScopedReady: boolean;
  };
};

export function loadLyveVerificationConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<LyveVerificationConfig> = {}
): LyveVerificationConfig {
  return {
    endpoint: overrides.endpoint || env.LYVE_ENDPOINT || env.LYVE_CLOUD_ENDPOINT,
    region: overrides.region || env.LYVE_REGION || env.LYVE_CLOUD_REGION,
    accessKeyId:
      overrides.accessKeyId || env.LYVE_ACCESS_KEY_ID || env.LYVE_CLOUD_ACCESS_KEY || env.LYVE_CLOUD_ACCESS_KEY_ID,
    secretAccessKey:
      overrides.secretAccessKey || env.LYVE_SECRET_ACCESS_KEY || env.LYVE_CLOUD_SECRET_KEY || env.LYVE_CLOUD_SECRET_ACCESS_KEY,
    bucket: overrides.bucket || env.LYVE_BUCKET || env.LYVE_CLOUD_BUCKET,
    objectKey: overrides.objectKey || env.LYVE_OBJECT_KEY,
    timeoutMs: overrides.timeoutMs || 5000,
  };
}

function buildS3Client(config: LyveVerificationConfig): S3Client | null {
  if (!config.endpoint || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    return null;
  }

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function classifyError(error: unknown): LyveCheckResult {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('access denied') || normalized.includes('forbidden')) {
    return { ok: false, status: 'access_denied', detail: message };
  }

  if (normalized.includes('notfound') || normalized.includes('no such key') || normalized.includes('404')) {
    return { ok: false, status: 'not_found', detail: message };
  }

  return { ok: false, status: 'error', detail: message };
}

async function probeEndpoint(config: LyveVerificationConfig): Promise<LyveCheckResult> {
  if (!config.endpoint) {
    return { ok: false, status: 'skipped', detail: 'No LYVE endpoint configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 5000);

  try {
    const response = await fetch(config.endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    return {
      ok: true,
      status: 'reachable',
      detail: `Endpoint responded with HTTP ${response.status}`,
    };
  } catch (error) {
    return classifyError(error);
  } finally {
    clearTimeout(timer);
  }
}

async function probeListScope(config: LyveVerificationConfig, client: S3Client | null): Promise<LyveCheckResult> {
  if (!client || !config.bucket) {
    return { ok: false, status: 'skipped', detail: 'Missing bucket or credentials for list-scope probe' };
  }

  try {
    await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        MaxKeys: 1,
      })
    );

    return { ok: true, status: 'ok', detail: 'ListObjectsV2 succeeded' };
  } catch (error) {
    return classifyError(error);
  }
}

async function probeObjectScope(config: LyveVerificationConfig, client: S3Client | null): Promise<LyveCheckResult> {
  if (!client || !config.bucket) {
    return { ok: false, status: 'skipped', detail: 'Missing bucket or credentials for object-scope probe' };
  }

  if (!config.objectKey) {
    return { ok: false, status: 'skipped', detail: 'No object key provided for object-scope probe' };
  }

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: config.objectKey,
      })
    );

    return { ok: true, status: 'ok', detail: `HeadObject succeeded for ${config.objectKey}` };
  } catch (error) {
    return classifyError(error);
  }
}

export async function verifyLyveStorage(configOverrides: Partial<LyveVerificationConfig> = {}): Promise<LyveVerificationResult> {
  const config = loadLyveVerificationConfig(process.env, configOverrides);
  const warnings = validateBlobStorageConfig({
    endpoint: config.endpoint,
    region: config.region,
    accessKey: config.accessKeyId,
    secretKey: config.secretAccessKey,
    bucket: config.bucket,
  });
  const inferredRegion = inferRegionFromStorageEndpoint(config.endpoint);
  const client = buildS3Client(config);

  const endpoint = await probeEndpoint(config);
  const listScope = await probeListScope(config, client);
  const objectScope = await probeObjectScope(config, client);

  const leastPrivilegeLikely =
    endpoint.ok &&
    listScope.status === 'access_denied' &&
    (objectScope.status === 'ok' || objectScope.status === 'not_found' || objectScope.status === 'skipped');

  const objectScopedReady =
    endpoint.ok &&
    (objectScope.status === 'ok' || objectScope.status === 'not_found' || objectScope.status === 'skipped');

  return {
    config: {
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
      inferredRegion,
      hasCredentials: Boolean(config.accessKeyId && config.secretAccessKey),
      hasObjectKey: Boolean(config.objectKey),
    },
    warnings,
    checks: {
      endpoint,
      listScope,
      objectScope,
    },
    summary: {
      reachable: endpoint.ok,
      leastPrivilegeLikely,
      objectScopedReady,
    },
  };
}
