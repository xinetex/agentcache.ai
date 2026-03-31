import {
  type AlignmentPairRecord,
  type AlignmentPrivacyMode,
  type AlignmentSensitivity,
  type AlignmentTaskFamily,
} from '../lib/alignment/pair-registry.js';
import { alignmentPersistenceService } from './AlignmentPersistenceService.js';

export interface CompatibilityScoreInput {
  sourceProvider?: string | null;
  sourceModel?: string | null;
  targetProvider?: string | null;
  targetModel?: string | null;
  taskFamily: AlignmentTaskFamily;
  privacyMode?: AlignmentPrivacyMode | null;
  sensitivity?: AlignmentSensitivity | null;
}

export interface CompatibilityScoreReport {
  compatible: boolean;
  verdict: 'PASS' | 'REVIEW' | 'BLOCK';
  executionMode: 'native' | 'aligned' | 'encrypted_linear' | 'blocked';
  sourceProvider: string | null;
  sourceModel: string | null;
  targetProvider: string | null;
  targetModel: string | null;
  taskFamily: AlignmentTaskFamily;
  privacyMode: AlignmentPrivacyMode;
  sensitivity: AlignmentSensitivity;
  pairStatus: AlignmentPairRecord['status'] | 'native' | 'unknown';
  compatibilityScore: number;
  tokenizerCompatibility: number;
  representationSimilarity: number;
  privateInferenceCapable: boolean;
  evidenceLevel: AlignmentPairRecord['evidenceLevel'] | 'native';
  notes: string[];
}

const LINEAR_TASKS = new Set<AlignmentTaskFamily>(['classification', 'extraction', 'reranking', 'retrieval', 'embedding']);

function normalizeProvider(provider?: string | null): string | null {
  const normalized = (provider || '').trim().toLowerCase();
  return normalized || null;
}

function thresholdForTask(taskFamily: AlignmentTaskFamily): number {
  if (taskFamily === 'generation') return 0.9;
  if (taskFamily === 'retrieval' || taskFamily === 'embedding') return 0.72;
  return 0.75;
}

export class ModelCompatibilityLabService {
  async listPairs(filters?: {
    sourceProvider?: string | null;
    targetProvider?: string | null;
    taskFamily?: AlignmentTaskFamily | null;
    includeBlocked?: boolean | null;
  }) {
    return alignmentPersistenceService.listEffectivePairs(filters);
  }

  async score(input: CompatibilityScoreInput): Promise<CompatibilityScoreReport> {
    const sourceProvider = normalizeProvider(input.sourceProvider);
    const targetProvider = normalizeProvider(input.targetProvider);
    const privacyMode = input.privacyMode || 'plaintext';
    const sensitivity = input.sensitivity || 'internal';
    const notes: string[] = [];

    if (sourceProvider && targetProvider && sourceProvider === targetProvider) {
      if (privacyMode === 'encrypted_linear' && !LINEAR_TASKS.has(input.taskFamily)) {
        return {
          compatible: false,
          verdict: 'BLOCK',
          executionMode: 'blocked',
          sourceProvider,
          sourceModel: input.sourceModel || null,
          targetProvider,
          targetModel: input.targetModel || null,
          taskFamily: input.taskFamily,
          privacyMode,
          sensitivity,
          pairStatus: 'native',
          compatibilityScore: 1,
          tokenizerCompatibility: 1,
          representationSimilarity: 1,
          privateInferenceCapable: false,
          evidenceLevel: 'native',
          notes: ['Encrypted-linear mode is limited to embedding and linear-head task families.'],
        };
      }

      return {
        compatible: true,
        verdict: 'PASS',
        executionMode: privacyMode === 'encrypted_linear' ? 'encrypted_linear' : 'native',
        sourceProvider,
        sourceModel: input.sourceModel || null,
        targetProvider,
        targetModel: input.targetModel || null,
        taskFamily: input.taskFamily,
        privacyMode,
        sensitivity,
        pairStatus: 'native',
        compatibilityScore: 1,
        tokenizerCompatibility: 1,
        representationSimilarity: 1,
        privateInferenceCapable: LINEAR_TASKS.has(input.taskFamily),
        evidenceLevel: 'native',
        notes: ['Native same-provider route selected.'],
      };
    }

    const pair = await alignmentPersistenceService.findEffectivePair({
      sourceProvider,
      targetProvider,
      taskFamily: input.taskFamily,
    });

    if (!pair) {
      return {
        compatible: false,
        verdict: 'BLOCK',
        executionMode: 'blocked',
        sourceProvider,
        sourceModel: input.sourceModel || null,
        targetProvider,
        targetModel: input.targetModel || null,
        taskFamily: input.taskFamily,
        privacyMode,
        sensitivity,
        pairStatus: 'unknown',
        compatibilityScore: 0,
        tokenizerCompatibility: 0,
        representationSimilarity: 0,
        privateInferenceCapable: false,
        evidenceLevel: 'heuristic-v1',
        notes: ['No provider-pair compatibility entry exists for this task family yet.'],
      };
    }

    const threshold = thresholdForTask(input.taskFamily);
    const executionMode = privacyMode === 'encrypted_linear'
      ? 'encrypted_linear'
      : privacyMode === 'aligned'
        ? 'aligned'
        : 'aligned';

    notes.push(...pair.notes);

    if (input.taskFamily === 'generation') {
      notes.push('Generation-grade cross-provider alignment remains research-grade and should default to review or native routing.');
    }

    if (privacyMode === 'encrypted_linear') {
      if (!LINEAR_TASKS.has(input.taskFamily)) {
        return {
          compatible: false,
          verdict: 'BLOCK',
          executionMode: 'blocked',
          sourceProvider,
          sourceModel: input.sourceModel || null,
          targetProvider,
          targetModel: input.targetModel || null,
          taskFamily: input.taskFamily,
          privacyMode,
          sensitivity,
          pairStatus: pair.status,
          compatibilityScore: pair.compatibilityScore,
          tokenizerCompatibility: pair.tokenizerCompatibility,
          representationSimilarity: pair.representationSimilarity,
          privateInferenceCapable: pair.privateInferenceCapable,
          evidenceLevel: pair.evidenceLevel,
          notes: [...notes, 'Encrypted-linear mode only applies to linear-head compatible tasks.'],
        };
      }

      if (!pair.privateInferenceCapable || pair.status === 'blocked') {
        return {
          compatible: false,
          verdict: 'BLOCK',
          executionMode: 'blocked',
          sourceProvider,
          sourceModel: input.sourceModel || null,
          targetProvider,
          targetModel: input.targetModel || null,
          taskFamily: input.taskFamily,
          privacyMode,
          sensitivity,
          pairStatus: pair.status,
          compatibilityScore: pair.compatibilityScore,
          tokenizerCompatibility: pair.tokenizerCompatibility,
          representationSimilarity: pair.representationSimilarity,
          privateInferenceCapable: pair.privateInferenceCapable,
          evidenceLevel: pair.evidenceLevel,
          notes: [...notes, 'This provider pair is not approved for encrypted-linear execution.'],
        };
      }
    }

    let verdict: CompatibilityScoreReport['verdict'] = pair.status === 'validated' && pair.compatibilityScore >= threshold
      ? 'PASS'
      : pair.compatibilityScore >= threshold - 0.08
        ? 'REVIEW'
        : 'BLOCK';

    if (sensitivity === 'restricted' && pair.status !== 'validated') {
      verdict = 'BLOCK';
      notes.push('Restricted workloads require validated provider pairs only.');
    } else if (sensitivity === 'regulated' && verdict === 'PASS' && pair.status !== 'validated') {
      verdict = 'REVIEW';
      notes.push('Regulated workloads downgrade estimated pairs to review until benchmarked locally.');
    }

    return {
      compatible: verdict !== 'BLOCK',
      verdict,
      executionMode: verdict === 'BLOCK' ? 'blocked' : executionMode,
      sourceProvider,
      sourceModel: input.sourceModel || null,
      targetProvider,
      targetModel: input.targetModel || null,
      taskFamily: input.taskFamily,
      privacyMode,
      sensitivity,
      pairStatus: pair.status,
      compatibilityScore: pair.compatibilityScore,
      tokenizerCompatibility: pair.tokenizerCompatibility,
      representationSimilarity: pair.representationSimilarity,
      privateInferenceCapable: pair.privateInferenceCapable,
      evidenceLevel: pair.evidenceLevel,
      notes,
    };
  }
}

export const modelCompatibilityLabService = new ModelCompatibilityLabService();
