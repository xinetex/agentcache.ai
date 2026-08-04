import { describe, it, expect } from 'vitest';
import * as schema from '../../src/db/schema.js';

/**
 * Deployability regression guard.
 *
 * A prior refactor accidentally dropped ~58 tables from `src/db/schema.js`.
 * Because 52 files still imported those tables, every affected code path threw
 * `TypeError: Cannot read properties of undefined (reading ...)` at runtime —
 * silently breaking billing, credits, marketplace, hub, ontology, external
 * agents, and more. The unit suite stayed green; only the public API contract
 * tests caught it.
 *
 * This test fails loudly and immediately if the schema is mass-deleted or if any
 * business-critical table export disappears again, so it can never ship unnoticed.
 */

// Business-critical table exports that services depend on at runtime.
const REQUIRED_TABLES = [
  // Identity & access
  'users', 'organizations', 'apiKeys', 'agents', 'memories',
  // Revenue-critical: billing / credits / ledger / marketplace
  'creditTransactions', 'creditUsageDaily', 'ledgerAccounts', 'ledgerTransactions',
  'autoTopoffSettings', 'cards', 'marketplaceListings', 'marketplaceOrders',
  // Agent platform & guardrails
  'externalAgents', 'hubAgents', 'toolScanResults', 'needsSignals',
  'ontologyNodes', 'ontologyEdges',
  // AgentForge ("Folder That Thinks") control plane
  'smartNodes', 'nodeConnections', 'workflows', 'workflowExecutions',
];

describe('schema integrity (deployability regression guard)', () => {
  it('exports a healthy number of tables (guards against mass deletion)', () => {
    const objectExports = Object.values(schema).filter(
      (value) => value && typeof value === 'object'
    );
    // The full schema defines 70+ tables. A count below 40 means a large,
    // almost-certainly-accidental deletion has occurred.
    expect(objectExports.length).toBeGreaterThan(40);
  });

  for (const table of REQUIRED_TABLES) {
    it(`exports business-critical table: ${table}`, () => {
      expect(
        (schema as Record<string, unknown>)[table],
        `Missing schema export "${table}" — a service import will resolve to undefined and throw at runtime.`
      ).toBeDefined();
    });
  }
});
