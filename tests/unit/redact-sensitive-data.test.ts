import { describe, expect, it } from 'vitest';
import { redactSensitiveData } from '../../src/lib/redact-sensitive-data.js';

describe('redactSensitiveData', () => {
  it('redacts credential-like fields recursively while preserving ordinary data', () => {
    expect(redactSensitiveData({
      documentId: 'doc-1',
      credentials: { accessToken: 'provider-token' },
      headers: [{ Authorization: 'Bearer abcdef1234567890' }],
      note: 'using ghp_abcdefghijklmnopqrstuvwxyz1234567890 safely',
    })).toEqual({
      documentId: 'doc-1',
      credentials: '[REDACTED]',
      headers: [{ Authorization: '[REDACTED]' }],
      note: 'using [REDACTED] safely',
    });
  });

  it('preserves nulls, numbers, and arrays', () => {
    expect(redactSensitiveData({ count: 2, value: null, ids: ['a', 'b'] })).toEqual({
      count: 2,
      value: null,
      ids: ['a', 'b'],
    });
  });
});
