import { describe, expect, it } from 'vitest';
import { BrowserProofService } from '../../src/services/BrowserProofService.js';
import { buildBrowserTaskReceipt } from '../../src/contracts/shared-receipt-builders.js';

describe('S38: Authenticated Browser Workflow Receipts', () => {
  it('captures authenticated proof and builds a valid shared receipt', async () => {
    const service = new BrowserProofService({
      lightpandaAdapter: {
        name: 'lightpanda',
        isAvailable: () => true,
        capture: async (input) => {
          // Verify cookies were passed to the adapter (mock check)
          if (input.cookies && input.cookies.length > 0) {
            return {
              html: '<html><body>Authenticated Content</body></html>',
              statusCode: 200,
              notes: [`cookies:${input.cookies.length}`],
            };
          }
          return { html: '<html><body>Login Required</body></html>', statusCode: 403 };
        },
      },
    });

    const result = await service.prove({
      url: 'https://app.example.com/dashboard',
      cookies: [{ name: 'session', value: 'secret-token' }],
    });

    expect(result.engine).toBe('lightpanda');
    expect(result.adapterNotes).toContain('cookies:1');

    const receipt = buildBrowserTaskReceipt({
      receiptId: 'rcpt_123',
      taskId: 'task_abc',
      url: result.url,
      producer: { system: 'AGENTCACHE', id: 'agent_1' },
      executionMode: result.executionMode,
      engine: result.engine,
      payload: {
        htmlHash: result.htmlHash,
        proofHash: result.proofHash,
      },
      secret: 'test-secret',
    });

    expect(receipt.subject.kind).toBe('BROWSER_TASK');
    expect(receipt.payload?.executionMode).toBe('lightpanda');
    expect(receipt.signature).toBeDefined();
  });
});
