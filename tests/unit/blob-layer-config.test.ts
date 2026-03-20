import { describe, expect, it } from 'vitest';
import {
  inferRegionFromStorageEndpoint,
  validateBlobStorageConfig,
} from '../../src/lib/agent-memory/layers/blob.js';

describe('blob layer storage config validation', () => {
  it('infers the region from a Lyve endpoint', () => {
    expect(
      inferRegionFromStorageEndpoint('https://s3.us-west-1.lyvecloud.seagate.com')
    ).toBe('us-west-1');
  });

  it('flags endpoint and region mismatches', () => {
    const warnings = validateBlobStorageConfig({
      endpoint: 'https://s3.us-east-1.lyvecloud.seagate.com',
      region: 'us-west-1',
      accessKey: 'test-key',
      secretKey: 'test-secret',
      bucket: 'jettydata-prod',
    });

    expect(warnings).toContain(
      'Blob storage region mismatch: endpoint implies us-east-1 but config uses us-west-1'
    );
  });

  it('flags incomplete credential configuration', () => {
    const warnings = validateBlobStorageConfig({
      endpoint: 'https://s3.us-west-1.lyvecloud.seagate.com',
      region: 'us-west-1',
      accessKey: 'test-key',
      bucket: 'jettydata-prod',
    });

    expect(warnings).toContain(
      'Blob storage endpoint is configured without complete credentials or bucket settings'
    );
  });
});
