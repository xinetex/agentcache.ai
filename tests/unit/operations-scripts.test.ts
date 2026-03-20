import { afterEach, describe, expect, it, vi } from 'vitest';

async function importFresh<T>(path: string): Promise<T> {
  vi.resetModules();
  return import(path) as Promise<T>;
}

describe('operations verification scripts', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unmock('../scripts/industrial_audit.ts');
    vi.unmock('../scripts/verify_lyve_storage.ts');
    vi.unmock('../scripts/verify_collective_state.ts');
    vi.unmock('../scripts/verify_marketplace.ts');
  });

  it('runs industrial audit through its exported entrypoint', async () => {
    vi.doMock('../../src/services/ResonanceService.js', () => ({
      resonanceService: {
        joinCircle: vi.fn().mockResolvedValue(undefined),
        calculateResonance: vi.fn().mockResolvedValue({ score: 0.91 }),
      },
    }));
    vi.doMock('../../src/infrastructure/CognitiveEngine.js', () => ({
      cognitiveEngine: {
        resolveConflicts: vi.fn().mockResolvedValue({}),
      },
    }));
    vi.doMock('../../src/services/PolicyEngine.js', () => ({
      policyEngine: {},
    }));
    vi.doMock('../../src/services/ObservabilityService.js', () => ({
      observabilityService: {
        getHistory: vi.fn().mockResolvedValue([
          { type: 'RESONANCE' },
          { type: 'CONFLICT' },
          { type: 'POLICY' },
        ]),
      },
    }));
    vi.doMock('../../src/services/SemanticBusService.js', () => ({
      semanticBusService: {
        publish: vi.fn().mockResolvedValue(undefined),
      },
    }));

    const { runIndustrialAudit } = await importFresh<typeof import('../../scripts/industrial_audit.ts')>(
      '../../scripts/industrial_audit.ts',
    );

    const result = await runIndustrialAudit();
    expect(result.success).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.eventTypes).toEqual(expect.arrayContaining(['RESONANCE', 'CONFLICT', 'POLICY']));
  });

  it('runs collective state verification through its exported entrypoint', async () => {
    vi.doMock('../../src/services/CollectiveCortex.js', () => ({
      collectiveCortex: {
        initiateSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
        listActiveSessions: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
        pushState: vi.fn().mockResolvedValue(undefined),
        getDirective: vi.fn()
          .mockResolvedValueOnce('Reduce risk exposure')
          .mockResolvedValueOnce('Finalize compliance attestation'),
      },
    }));
    vi.doMock('../../src/services/SectorSolutionOrchestrator.js', () => ({
      sectorSolutionOrchestrator: {
        spawnSectorAgent: vi.fn()
          .mockResolvedValueOnce({ name: 'Fintech Agent', agentId: 'fin-agent' })
          .mockResolvedValueOnce({ name: 'Legal Agent', agentId: 'legal-agent' }),
      },
    }));

    const { verifyCollectiveState } = await importFresh<typeof import('../../scripts/verify_collective_state.ts')>(
      '../../scripts/verify_collective_state.ts',
    );

    const result = await verifyCollectiveState();
    expect(result.success).toBe(true);
    expect(result.indexed).toBe(true);
    expect(result.fintechDirective).toContain('Reduce risk');
    expect(result.legalDirective).toContain('compliance');
  });

  it('runs Lyve storage verification through its exported entrypoint', async () => {
    vi.doMock('../../src/lib/storage/lyveVerification.js', () => ({
      verifyLyveStorage: vi.fn().mockResolvedValue({
        config: {
          endpoint: 'https://s3.us-west-1.lyvecloud.seagate.com',
          bucket: 'jettydata-prod',
          region: 'us-west-1',
          inferredRegion: 'us-west-1',
          hasCredentials: true,
          hasObjectKey: false,
        },
        warnings: [],
        checks: {
          endpoint: { ok: true, status: 'reachable', detail: 'Endpoint responded with HTTP 403' },
          listScope: { ok: false, status: 'access_denied', detail: 'Access Denied' },
          objectScope: { ok: false, status: 'skipped', detail: 'No object key provided for object-scope probe' },
        },
        summary: {
          reachable: true,
          leastPrivilegeLikely: true,
          objectScopedReady: true,
        },
      }),
    }));

    const { verifyLyveStorageScript } = await importFresh<typeof import('../../scripts/verify_lyve_storage.ts')>(
      '../../scripts/verify_lyve_storage.ts',
    );

    const result = await verifyLyveStorageScript();
    expect(result.summary.reachable).toBe(true);
    expect(result.summary.leastPrivilegeLikely).toBe(true);
    expect(result.checks.listScope.status).toBe('access_denied');
  });

  it('runs marketplace verification through its exported entrypoint', async () => {
    vi.doMock('../../src/services/MarketplaceService.js', () => ({
      marketplace: {
        createListing: vi.fn().mockResolvedValue({ id: 'listing-1' }),
        purchaseListing: vi.fn().mockResolvedValue({ id: 'order-1', totalPrice: 0.2 }),
      },
    }));
    vi.doMock('../../src/services/SolanaEconomyService.js', () => ({
      solanaEconomyService: {
        initializeWallet: vi.fn().mockResolvedValue(undefined),
        getBalance: vi.fn()
          .mockResolvedValueOnce(1.0)
          .mockResolvedValueOnce(0.75)
          .mockResolvedValueOnce(0.3),
      },
    }));
    vi.doMock('../../src/db/schema.js', () => ({
      hubAgents: { name: 'hubAgents' },
      agentToolAccess: { name: 'agentToolAccess', agentId: 'agentId' },
    }));
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn().mockReturnValue('eq-clause'),
    }));
    vi.doMock('../../src/db/client.js', () => {
      const insertValues = vi.fn().mockResolvedValue(undefined);
      const where = vi.fn().mockResolvedValue([{ toolName: 'Legal Compliance Audit', status: 'active' }]);
      const from = vi.fn().mockReturnValue({ where });
      const select = vi.fn().mockReturnValue({ from });

      return {
        db: {
          insert: vi.fn().mockReturnValue({ values: insertValues }),
          select,
        },
      };
    });

    const { verifyMarketplace } = await importFresh<typeof import('../../scripts/verify_marketplace.ts')>(
      '../../scripts/verify_marketplace.ts',
    );

    const result = await verifyMarketplace();
    expect(result.success).toBe(true);
    expect(result.listingId).toBe('listing-1');
    expect(result.orderId).toBe('order-1');
    expect(result.accessCount).toBe(1);
    expect(result.finalBuyerBalance).toBeLessThan(result.initialBuyerBalance);
  });
});
