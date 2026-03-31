export type AlignmentTaskFamily =
  | 'classification'
  | 'extraction'
  | 'reranking'
  | 'retrieval'
  | 'embedding'
  | 'generation';

export type AlignmentPrivacyMode = 'plaintext' | 'aligned' | 'encrypted_linear';

export type AlignmentSensitivity = 'public' | 'internal' | 'regulated' | 'restricted';

export type AlignmentPairStatus = 'estimated' | 'validated' | 'blocked';

export interface AlignmentPairRecord {
  id: string;
  sourceProvider: string;
  sourceModel?: string;
  targetProvider: string;
  targetModel?: string;
  taskFamily: AlignmentTaskFamily;
  status: AlignmentPairStatus;
  compatibilityScore: number;
  tokenizerCompatibility: number;
  representationSimilarity: number;
  privateInferenceCapable: boolean;
  evidenceLevel: 'heuristic-v1' | 'validated-v1';
  notes: string[];
}

const PAIRS: AlignmentPairRecord[] = [
  {
    id: 'openai-anthropic-classification',
    sourceProvider: 'openai',
    targetProvider: 'anthropic',
    taskFamily: 'classification',
    status: 'validated',
    compatibilityScore: 0.88,
    tokenizerCompatibility: 0.83,
    representationSimilarity: 0.86,
    privateInferenceCapable: true,
    evidenceLevel: 'validated-v1',
    notes: ['Strong pair for label-oriented work.', 'Good candidate for aligned and encrypted-linear routing.'],
  },
  {
    id: 'openai-anthropic-extraction',
    sourceProvider: 'openai',
    targetProvider: 'anthropic',
    taskFamily: 'extraction',
    status: 'validated',
    compatibilityScore: 0.84,
    tokenizerCompatibility: 0.83,
    representationSimilarity: 0.86,
    privateInferenceCapable: true,
    evidenceLevel: 'validated-v1',
    notes: ['Good pair for structured extraction under strong output contracts.'],
  },
  {
    id: 'openai-gemini-classification',
    sourceProvider: 'openai',
    targetProvider: 'gemini',
    taskFamily: 'classification',
    status: 'estimated',
    compatibilityScore: 0.79,
    tokenizerCompatibility: 0.76,
    representationSimilarity: 0.8,
    privateInferenceCapable: true,
    evidenceLevel: 'heuristic-v1',
    notes: ['Promising pair, but still benchmark it before production enforcement.'],
  },
  {
    id: 'anthropic-gemini-extraction',
    sourceProvider: 'anthropic',
    targetProvider: 'gemini',
    taskFamily: 'extraction',
    status: 'estimated',
    compatibilityScore: 0.76,
    tokenizerCompatibility: 0.73,
    representationSimilarity: 0.79,
    privateInferenceCapable: true,
    evidenceLevel: 'heuristic-v1',
    notes: ['Usable for contract-bound extraction with review.'],
  },
  {
    id: 'openai-ollama-reranking',
    sourceProvider: 'openai',
    targetProvider: 'ollama',
    taskFamily: 'reranking',
    status: 'validated',
    compatibilityScore: 0.78,
    tokenizerCompatibility: 0.72,
    representationSimilarity: 0.77,
    privateInferenceCapable: true,
    evidenceLevel: 'validated-v1',
    notes: ['Good local/private fallback for ranking-style decisions.'],
  },
  {
    id: 'openai-anthropic-generation',
    sourceProvider: 'openai',
    targetProvider: 'anthropic',
    taskFamily: 'generation',
    status: 'estimated',
    compatibilityScore: 0.62,
    tokenizerCompatibility: 0.83,
    representationSimilarity: 0.86,
    privateInferenceCapable: false,
    evidenceLevel: 'heuristic-v1',
    notes: ['Interesting for research, not stable enough for production-grade aligned generation.'],
  },
  {
    id: 'openai-gemini-generation',
    sourceProvider: 'openai',
    targetProvider: 'gemini',
    taskFamily: 'generation',
    status: 'blocked',
    compatibilityScore: 0.39,
    tokenizerCompatibility: 0.54,
    representationSimilarity: 0.75,
    privateInferenceCapable: false,
    evidenceLevel: 'heuristic-v1',
    notes: ['Blocked until tokenizer and quality compatibility improve materially.'],
  },
];

function normalizeProvider(provider?: string | null): string {
  return (provider || '').trim().toLowerCase();
}

export function listAlignmentPairs(filters?: {
  sourceProvider?: string | null;
  targetProvider?: string | null;
  taskFamily?: AlignmentTaskFamily | null;
  includeBlocked?: boolean | null;
}): AlignmentPairRecord[] {
  const sourceProvider = normalizeProvider(filters?.sourceProvider);
  const targetProvider = normalizeProvider(filters?.targetProvider);
  const taskFamily = filters?.taskFamily || null;
  const includeBlocked = Boolean(filters?.includeBlocked);

  return PAIRS.filter((pair) => {
    if (!includeBlocked && pair.status === 'blocked') return false;
    if (sourceProvider && pair.sourceProvider !== sourceProvider) return false;
    if (targetProvider && pair.targetProvider !== targetProvider) return false;
    if (taskFamily && pair.taskFamily !== taskFamily) return false;
    return true;
  });
}

export function findAlignmentPair(input: {
  sourceProvider?: string | null;
  targetProvider?: string | null;
  taskFamily: AlignmentTaskFamily;
}): AlignmentPairRecord | null {
  const sourceProvider = normalizeProvider(input.sourceProvider);
  const targetProvider = normalizeProvider(input.targetProvider);

  if (!sourceProvider || !targetProvider) return null;

  return (
    PAIRS.find((pair) =>
      pair.sourceProvider === sourceProvider &&
      pair.targetProvider === targetProvider &&
      pair.taskFamily === input.taskFamily
    ) ||
    PAIRS.find((pair) =>
      pair.sourceProvider === targetProvider &&
      pair.targetProvider === sourceProvider &&
      pair.taskFamily === input.taskFamily
    ) ||
    null
  );
}
