import { describe, expect, it } from 'vitest';
import { loadLyveVerificationConfig } from '../../src/lib/storage/lyveVerification.js';

describe('lyve verification config', () => {
  it('loads config from Lyve-specific environment variables', () => {
    const config = loadLyveVerificationConfig({
      LYVE_ENDPOINT: 'https://s3.us-west-1.lyvecloud.seagate.com',
      LYVE_REGION: 'us-west-1',
      LYVE_ACCESS_KEY_ID: 'access-key',
      LYVE_SECRET_ACCESS_KEY: 'secret-key',
      LYVE_BUCKET: 'jettydata-prod',
      LYVE_OBJECT_KEY: 'tenant/file.bin',
    });

    expect(config.endpoint).toBe('https://s3.us-west-1.lyvecloud.seagate.com');
    expect(config.region).toBe('us-west-1');
    expect(config.accessKeyId).toBe('access-key');
    expect(config.secretAccessKey).toBe('secret-key');
    expect(config.bucket).toBe('jettydata-prod');
    expect(config.objectKey).toBe('tenant/file.bin');
  });

  it('falls back to Lyve Cloud aliases when direct variables are missing', () => {
    const config = loadLyveVerificationConfig({
      LYVE_CLOUD_ENDPOINT: 'https://s3.us-west-1.lyvecloud.seagate.com',
      LYVE_CLOUD_REGION: 'us-west-1',
      LYVE_CLOUD_ACCESS_KEY: 'access-key',
      LYVE_CLOUD_SECRET_KEY: 'secret-key',
      LYVE_CLOUD_BUCKET: 'jettydata-prod',
    });

    expect(config.endpoint).toBe('https://s3.us-west-1.lyvecloud.seagate.com');
    expect(config.region).toBe('us-west-1');
    expect(config.accessKeyId).toBe('access-key');
    expect(config.secretAccessKey).toBe('secret-key');
    expect(config.bucket).toBe('jettydata-prod');
  });
});
