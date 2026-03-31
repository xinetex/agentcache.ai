import { randomUUID } from 'node:crypto';
import { buildAlignmentRunReceipt } from '../contracts/shared-receipt-builders.js';
import type { SharedReceiptEnvelope } from '../contracts/shared-receipt.js';
import type {
  AlignmentPrivacyMode,
  AlignmentSensitivity,
  AlignmentTaskFamily,
} from '../lib/alignment/pair-registry.js';
import { router, type TaskType } from '../lib/llm/router.js';
import {
  buildSignedOntologyProvenance,
  type SignedOntologyProvenance,
} from './OntologyProvenanceService.js';
import { memoryFabricPolicyService } from './MemoryFabricPolicyService.js';
import {
  modelCompatibilityLabService,
  type CompatibilityScoreReport,
} from './ModelCompatibilityLabService.js';

export interface AlignmentRoutingInput {
  prompt?: string | null;
  values?: unknown[];
  taskFamily: AlignmentTaskFamily;
  sectorHint?: string | null;
  sourceProvider?: string | null;
  sourceModel?: string | null;
  preferredProvider?: string | null;
  allowedProviders?: string[] | null;
  privacyMode?: AlignmentPrivacyMode | null;
  sensitivity?: AlignmentSensitivity | null;
  tierId?: string | null;
  apiKey?: string | null;
}

export interface AlignmentRoutingDecision {
  requestId: string;
  executionMode: 'native' | 'aligned' | 'encrypted_linear' | 'blocked';
  verdict: 'PASS' | 'REVIEW' | 'BLOCK' | 'INFO';
  chosenProvider: string | null;
  chosenModel: string | null;
  taskFamily: AlignmentTaskFamily;
  privacyMode: AlignmentPrivacyMode;
  sensitivity: AlignmentSensitivity;
  compatibility: CompatibilityScoreReport | null;
  ontology: SignedOntologyProvenance;
  policy: ReturnType<typeof memoryFabricPolicyService.resolve>;
  notes: string[];
  receipt: SharedReceiptEnvelope;
}

function mapTaskFamily(taskFamily: AlignmentTaskFamily): TaskType {
  if (taskFamily === 'classification') return 'classification';
  if (taskFamily === 'extraction') return 'extraction';
  if (taskFamily === 'reranking') return 'verification';
  if (taskFamily === 'retrieval') return 'research';
  if (taskFamily === 'generation') return 'general';
  return 'classification';
}

function normalizeProvider(provider?: string | null): string | null {
  const normalized = (provider || '').trim().toLowerCase();
  return normalized || null;
}

function uniqueProviders(providers: string[]): string[] {
  return Array.from(new Set(providers.filter(Boolean).map((provider) => provider.trim().toLowerCase())));
}

export class AlignmentRoutingService {
  async route(input: AlignmentRoutingInput): Promise<AlignmentRoutingDecision> {
    const requestId = `align_${randomUUID()}`;
    const privacyMode = input.privacyMode || 'plaintext';
    const sensitivity = input.sensitivity || 'internal';
    const prompt = (input.prompt || '').trim();
    const sourceProvider = normalizeProvider(input.sourceProvider);
    const sourceModel = input.sourceModel?.trim() || null;
    const preferredProvider = normalizeProvider(input.preferredProvider);
    const baseRoute = router.routeByTaskType(mapTaskFamily(input.taskFamily));
    const allowedProviders = uniqueProviders(
      (input.allowedProviders && input.allowedProviders.length > 0
        ? input.allowedProviders
        : [preferredProvider || '', baseRoute.provider]
      ).filter(Boolean) as string[]
    );

    const ontology = buildSignedOntologyProvenance({
      requestId,
      sku: 'alignment-fabric-v1',
      signClass: 'PROMPT',
      sectorHint: input.sectorHint || null,
      values: [prompt, ...(input.values || [])],
    });

    const policy = memoryFabricPolicyService.resolve({
      sector: ontology.sectorId || input.sectorHint || undefined,
      tierId: input.tierId || undefined,
    });

    const notes: string[] = [];
    let compatibility: CompatibilityScoreReport | null = null;
    let chosenProvider: string | null = preferredProvider || baseRoute.provider;
    let chosenModel: string | null = baseRoute.model;
    let executionMode: AlignmentRoutingDecision['executionMode'] = 'native';
    let verdict: AlignmentRoutingDecision['verdict'] = 'INFO';

    if (privacyMode !== 'plaintext' && !sourceProvider) {
      executionMode = 'blocked';
      verdict = 'BLOCK';
      notes.push('Aligned and encrypted-linear routing require a declared source provider.');
      chosenProvider = null;
      chosenModel = null;
    } else if (sourceProvider) {
      const providerCandidates = uniqueProviders([
        ...allowedProviders,
        preferredProvider || '',
        baseRoute.provider,
        sourceProvider,
      ]);

      const scoredCandidates = providerCandidates
        .filter((provider) => provider !== sourceProvider || privacyMode === 'plaintext')
        .map(async (provider) => modelCompatibilityLabService.score({
          sourceProvider,
          sourceModel,
          targetProvider: provider,
          targetModel: provider === baseRoute.provider ? baseRoute.model : null,
          taskFamily: input.taskFamily,
          privacyMode,
          sensitivity,
        }));

      const compatibilityReports = await Promise.all(scoredCandidates);
      compatibilityReports
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore || a.targetProvider!.localeCompare(b.targetProvider!));

      compatibility = compatibilityReports[0] || null;

      if (compatibility && compatibility.compatible) {
        chosenProvider = compatibility.targetProvider;
        chosenModel = compatibility.targetProvider === baseRoute.provider ? baseRoute.model : chosenModel;
        executionMode = compatibility.executionMode;
        verdict = compatibility.verdict;
        notes.push(...compatibility.notes);
      } else if (privacyMode === 'plaintext') {
        executionMode = 'native';
        verdict = 'INFO';
        chosenProvider = preferredProvider || baseRoute.provider;
        chosenModel = baseRoute.model;
        notes.push('Falling back to native provider routing because no compatible alignment pair was approved.');
        if (compatibility) {
          notes.push(...compatibility.notes);
        }
      } else {
        executionMode = 'blocked';
        verdict = 'BLOCK';
        chosenProvider = null;
        chosenModel = null;
        notes.push('No approved provider pair satisfied the requested privacy mode.');
        if (compatibility) {
          notes.push(...compatibility.notes);
        }
      }
    } else {
      notes.push('No source provider supplied, so native provider routing was selected.');
    }

    const receipt = buildAlignmentRunReceipt({
      receiptId: `rcpt_${requestId}`,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'alignment-router',
      },
      runId: requestId,
      route: '/api/alignment/route',
      provider: chosenProvider || undefined,
      sourceProvider: sourceProvider || undefined,
      sourceModel: sourceModel || undefined,
      targetProvider: chosenProvider || undefined,
      targetModel: chosenModel || undefined,
      executionMode,
      privacyMode,
      ontology: {
        sectorId: ontology.sectorId || undefined,
        ontologyRef: ontology.ontologyRef || undefined,
        version: ontology.version || undefined,
        signClass: ontology.signClass,
        confidence: ontology.confidence,
        matchedTerms: ontology.matchedTerms,
        bridgeTrace: ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict,
        confidence: compatibility?.compatibilityScore ?? ontology.confidence,
      },
      refs: {
        requestId,
        pairStatus: compatibility?.pairStatus || 'native',
        source: compatibility?.evidenceLevel || 'native',
      },
      payload: {
        taskFamily: input.taskFamily,
        sensitivity,
        policy,
        compatibility,
        ontologySignature: ontology.signature,
        notes,
      },
    });

    return {
      requestId,
      executionMode,
      verdict,
      chosenProvider,
      chosenModel,
      taskFamily: input.taskFamily,
      privacyMode,
      sensitivity,
      compatibility,
      ontology,
      policy,
      notes,
      receipt,
    };
  }
}

export const alignmentRoutingService = new AlignmentRoutingService();
