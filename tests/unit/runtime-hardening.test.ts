import { describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { marketplace } from '../../src/services/MarketplaceService.js';

describe('runtime hardening', () => {
  it('delivers published messages through the mock redis pubsub path', async () => {
    const subscriber = redis.duplicate();

    const received = new Promise<{ channel: string; message: string }>((resolve) => {
      subscriber.on('message', (channel: string, message: string) => {
        resolve({ channel, message });
      });
    });

    await subscriber.subscribe('phase1:test');
    const published = await redis.publish('phase1:test', 'hello-world');
    const event = await received;

    expect(published).toBeGreaterThanOrEqual(1);
    expect(event).toEqual({
      channel: 'phase1:test',
      message: 'hello-world',
    });

    await subscriber.quit();
  });

  it('updates marketplace suggestion votes in the mock db path', async () => {
    const created = await marketplace.submitSuggestion(
      `agent-${Date.now()}`,
      `Phase 1 Suggestion ${Date.now()}`,
      'Harden mock execution paths'
    );

    const suggestionId = created[0].id;
    await marketplace.voteSuggestion(suggestionId);

    const suggestions = await marketplace.getSuggestions();
    const updated = suggestions.find((item: any) => item.id === suggestionId);

    expect(updated).toBeDefined();
    expect(updated.votes).toBe(1);
  });
});
