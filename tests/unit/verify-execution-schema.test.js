import { describe, expect, it, vi } from 'vitest';
import { compareExecutionSchema, REQUIRED_COLUMNS, REQUIRED_INDEXES, verifyExecutionSchema } from '../../scripts/verify-execution-schema.mjs';

describe('execution schema verification', () => {
  it('reports missing tables, columns, and safety indexes', () => {
    const result = compareExecutionSchema([], []);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('table execution_action_budgets');
    expect(result.missing).toContain('index execution_action_reservations_invocation_unique');
  });

  it('accepts a complete execution schema', () => {
    const columns = Object.entries(REQUIRED_COLUMNS).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name })));
    const indexes = REQUIRED_INDEXES.map((indexname) => ({ indexname }));
    expect(compareExecutionSchema(columns, indexes)).toEqual({ ready: true, missing: [] });
  });

  it('refuses mock URLs before opening a connection', async () => {
    const clientFactory = vi.fn();
    await expect(verifyExecutionSchema({ databaseUrl: 'mock', clientFactory })).rejects.toThrow('mock database');
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('queries the configured database and closes it after verification', async () => {
    const columns = Object.entries(REQUIRED_COLUMNS).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name })));
    const indexes = REQUIRED_INDEXES.map((indexname) => ({ indexname }));
    const client = {
      unsafe: vi.fn().mockResolvedValueOnce(columns).mockResolvedValueOnce(indexes),
      end: vi.fn().mockResolvedValue(undefined),
    };
    const clientFactory = vi.fn(() => client);

    const result = await verifyExecutionSchema({ databaseUrl: 'postgresql://user:pass@db.example/agentcache', clientFactory });

    expect(result).toEqual({ ready: true, missing: [] });
    expect(client.unsafe).toHaveBeenCalledTimes(2);
    expect(client.end).toHaveBeenCalledWith({ timeout: 5 });
    expect(JSON.stringify(result)).not.toContain('pass');
  });
});
