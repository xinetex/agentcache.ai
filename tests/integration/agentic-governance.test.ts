import { beforeAll, describe, expect, it, vi } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { ledger } from '../../src/services/LedgerService.js';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../../src/services/OntologyService.js', () => ({
    ontologyService: {
        semanticMap: async () => ({ simulated: true })
    }
}));

let app: any;

vi.mock('../../src/lib/observability/tracer.js', () => ({
    Tracer: class {
        startSpan(name: string) { return { id: name, attributes: {} }; }
        endSpan() { }
        getTraceId() { return 'test-trace-id'; }
        async flush() { }
    }
}));

let agentId = uuidv4();
const apiKey = 'ac_demo_test_governance';

async function request(path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}) {
    const response = await app.request(path, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    let payload;
    try {
        payload = await response.json();
    } catch (e) { /* ignore */ }

    return { response, payload };
}

describe('Agentic Governance (The 2030 Leap)', () => {
    beforeAll(async () => {
        ({ app } = await import('../../src/index.js'));
        const { db } = await import('../../src/db/client.js');
        const { ledgerAccounts, ledgerTransactions } = await import('../../src/db/schema.js');
        // Clear previous test garbage (child table first to respect FK constraints)
        await db.delete(ledgerTransactions);
        await db.delete(ledgerAccounts);

        agentId = uuidv4(); // Fresh ID for this run
        // Provision agent account
        await ledger.createAccount(agentId, 'agent', 100);
    });

    it('traces a mission through the LemmaService', async () => {
        const { lemmaService } = await import('../../src/services/LemmaService.js');

        // Mock sub-task results to avoid real LLM calls
        vi.spyOn(lemmaService as any, 'decompose').mockResolvedValue([{ id: 'step_1', description: 'Test Task' }]);
        vi.spyOn(lemmaService as any, 'resolve').mockResolvedValue({
            results: { 'step_1': 'Solved' },
            metrics: { hits: 1, misses: 0, hit_ratio: 1.0 }
        });
        vi.spyOn(lemmaService as any, 'synthesize').mockResolvedValue('Unified Result');

        const result = await lemmaService.chat("Analyze the future of HPC");

        expect(result.response).toBe('Unified Result');
        expect(result.missionId).toBeDefined();

        // Check if mission trace ID was generated
        expect(result.missionId.length).toBeGreaterThan(0);
    });

    it('settles an x402 payment via AgentSettlementService', async () => {
        const preauth = '0xTestSettlementHash';

        // Initially, ensure the account has exactly $100
        const initialAcc = await ledger.getAccount(agentId);
        const initialBalance = Number(initialAcc?.balance || 0);

        // Hit settlement
        const res = await request('/api/ontology/map', {
            sourceData: "Messy Data",
            targetSchema: { type: "object" }
        }, {
            'Preauthorization': preauth,
            'X-API-Key': agentId
        });

        // Current implementation: return 200 (map) because service is mocked/simulated
        expect(res.response.status).toBe(200);

        // Verify balance deduction ($10.00 standard settlement)
        const finalAcc = await ledger.getAccount(agentId);
        const finalBalance = Number(finalAcc?.balance || 0);

        console.log(`[Test] 💰 Initial: ${initialBalance}, Final: ${finalBalance}`);

        // In the mock, initial is 100, deduction is 10
        expect(finalBalance).toBeLessThan(initialBalance);
        expect(finalBalance).toBe(90);
    });
});
