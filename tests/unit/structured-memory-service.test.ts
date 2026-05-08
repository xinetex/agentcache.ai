import { describe, expect, it } from 'vitest';
import { StructuredMemoryService } from '../../src/services/StructuredMemoryService.js';

describe('StructuredMemoryService', () => {
  const service = new StructuredMemoryService();

  it('normalizes explicit structure into a stable path', () => {
    const structure = service.normalize({
      structure: {
        wing: 'Acme Workspace',
        hall: 'facts',
        room: 'Auth Decisions',
        layer: 'critical_facts',
      },
      metadata: {},
      tags: [],
      content: 'We migrated auth to Clerk.',
    });

    expect(structure).toEqual({
      wing: 'acme-workspace',
      hall: 'facts',
      room: 'auth-decisions',
      layer: 'critical_facts',
      path: 'acme-workspace/facts/auth-decisions',
    });
  });

  it('decorates metadata with inferred structure when none is supplied', () => {
    const result = service.decorateMetadata({
      metadata: {
        namespace: 'jettythunder-prod',
        query: 'why we changed upload routing',
      },
      tags: ['event'],
      content: 'We changed upload routing after preview timeouts.',
    });

    expect(result.structure.wing).toBe('jettythunder-prod');
    expect(result.structure.hall).toBe('events');
    expect(result.metadata.memoryPath).toBe(
      `${result.metadata.memoryWing}/${result.metadata.memoryHall}/${result.metadata.memoryRoom}`
    );
  });

  it('builds filters and summarizes grouped results', () => {
    const filter = service.buildFilter({
      structure: {
        wing: 'agentcache-prod',
        hall: 'discoveries',
        layer: 'room_recall',
      },
      namespace: 'agentcache-prod',
    });

    expect(filter).toEqual({
      memoryWing: 'agentcache-prod',
      memoryHall: 'discoveries',
      memoryLayer: 'room_recall',
      namespace: 'agentcache-prod',
    });

    const summary = service.summarize([
      { metadata: { memoryWing: 'agentcache-prod', memoryHall: 'discoveries', memoryLayer: 'room_recall' } },
      { metadata: { memoryWing: 'agentcache-prod', memoryHall: 'discoveries', memoryLayer: 'room_recall' } },
      { metadata: { memoryWing: 'jettythunder', memoryHall: 'facts', memoryLayer: 'deep_search' } },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.byWing['agentcache-prod']).toBe(2);
    expect(summary.byHall['discoveries']).toBe(2);
    expect(summary.byLayer['room_recall']).toBe(2);
  });
});
