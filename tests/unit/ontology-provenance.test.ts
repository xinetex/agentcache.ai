import { describe, expect, it } from 'vitest';
import { buildSignedOntologyProvenance } from '../../src/services/OntologyProvenanceService.js';
import { memoryFabricPolicyService } from '../../src/services/MemoryFabricPolicyService.js';

describe('ontology provenance sector selection', () => {
  it('uses an explicit general hint for ambiguous software storage language', () => {
    const ontology = buildSignedOntologyProvenance({
      requestId: 'general-storage-workflow',
      sku: 'execution-control-v1',
      signClass: 'PROMPT',
      sectorHint: 'general',
      values: ['JettyThunder storage review', 'Read aggregate storage quota and file count.'],
    });

    expect(ontology.sectorId).toBe('general');
    expect(memoryFabricPolicyService.resolve({ sector: ontology.sectorId }).evidenceMode).toBe('standard');
  });

  it('keeps a strong finance vocabulary match above a general hint', () => {
    const ontology = buildSignedOntologyProvenance({
      requestId: 'financial-risk-workflow',
      sku: 'execution-control-v1',
      signClass: 'PROMPT',
      sectorHint: 'general',
      values: ['Portfolio risk exposure, settlement compliance, volatility, instrument margin, and counterparty.'],
    });

    expect(ontology.sectorId).toBe('finance');
    expect(memoryFabricPolicyService.resolve({ sector: ontology.sectorId }).evidenceMode).toBe('audit');
  });
});
