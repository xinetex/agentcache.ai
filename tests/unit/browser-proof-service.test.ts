import { describe, expect, it } from 'vitest';
import { BrowserProofService, type BrowserProofInput } from '../../src/services/BrowserProofService.js';

function makeInput(overrides: Partial<BrowserProofInput> = {}): BrowserProofInput {
  return {
    url: 'https://example.com',
    expectedSelectors: ['title'],
    expectedText: ['Example Domain'],
    includeMarkdown: true,
    ...overrides,
  };
}

describe('BrowserProofService', () => {
  it('uses Lightpanda when available and keeps markdown as additive evidence', async () => {
    const service = new BrowserProofService({
      lightpandaAdapter: {
        name: 'lightpanda',
        isAvailable: () => true,
        capture: async () => ({
          html: '<html><head><title>Example Domain</title></head><body><main>Example Domain</main></body></html>',
          statusCode: 200,
          notes: ['cdp:ws://127.0.0.1:9222'],
        }),
      },
      httpFetch: async () => ({
        html: '<html><head><title>HTTP Fallback</title></head><body>HTTP Fallback</body></html>',
        statusCode: 200,
      }),
      markdownFetch: async () => '# Example Domain\n\nRendered through markdown.',
    });

    const result = await service.prove(makeInput());

    expect(result.engine).toBe('lightpanda');
    expect(result.executionMode).toBe('lightpanda+firecrawl+http');
    expect(result.title).toBe('Example Domain');
    expect(result.adapterNotes).toEqual(['cdp:ws://127.0.0.1:9222']);
    expect(result.witness.matchedTexts).toBe(1);
  });

  it('falls back cleanly to HTTP and markdown when Lightpanda is unavailable', async () => {
    const service = new BrowserProofService({
      lightpandaAdapter: {
        name: 'lightpanda',
        isAvailable: () => false,
        capture: async () => null,
      },
      httpFetch: async () => ({
        html: '<html><head><title>HTTP Example</title></head><body><main>Example Domain</main></body></html>',
        statusCode: 200,
      }),
      markdownFetch: async () => 'Example Domain from Firecrawl',
    });

    const result = await service.prove(makeInput());

    expect(result.engine).toBe('http-fallback');
    expect(result.executionMode).toBe('firecrawl+http');
    expect(result.title).toBe('HTTP Example');
    expect(result.witness.matchedTexts).toBe(1);
  });
});
