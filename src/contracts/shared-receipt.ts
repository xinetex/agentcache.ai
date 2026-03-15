import crypto from 'node:crypto';
import { z } from 'zod';

export const SHARED_RECEIPT_SCHEMA = 'agentic.shared-receipt.v1';

export type SharedReceiptSystem =
  | 'AGENTCACHE'
  | 'MAXXEVAL'
  | 'CLAWSAVE'
  | 'JETTYAGENT'
  | 'SYMBIONT';

export type SharedReceiptVerdict = 'PASS' | 'REVIEW' | 'BLOCK' | 'INFO';

export type SharedReceiptSubjectKind =
  | 'API_CALL'
  | 'STATUS_SNAPSHOT'
  | 'PERFORMANCE_SNAPSHOT'
  | 'BOT_CYCLE'
  | 'PATHOLOGY_RUN'
  | 'TRADE_INTENT'
  | 'TRADE_EXECUTION'
  | 'TRUST_EXPORT'
  | 'BROWSER_TASK';

export type SharedReceiptParty = {
  system: SharedReceiptSystem;
  id: string;
  role?: string;
  profileId?: string;
  walletAddress?: string;
};

export type SharedReceiptSubject = {
  kind: SharedReceiptSubjectKind;
  id: string;
  ref?: string;
  route?: string;
};

export type SharedReceiptOntology = {
  sectorId?: string;
  ontologyRef?: string;
  version?: string;
  signClass?: string;
  confidence?: number;
  matchedTerms?: string[];
  bridgeTrace?: Array<Record<string, unknown>>;
};

export type SharedReceiptOperation = {
  action: string;
  provider?: string;
  route?: string;
  method?: string;
  environment?: string;
};

export type SharedReceiptEconomics = {
  sku?: string;
  priceMicros?: number | null;
  revenueMicros?: number | null;
  tokenCost?: number | null;
  latencyMs?: number | null;
};

export type SharedReceiptTrust = {
  verdict: SharedReceiptVerdict;
  status?: string;
  anomalyScore?: number | null;
  driftScore?: number | null;
  confidence?: number | null;
};

export type SharedReceiptEvidence = {
  payloadHash?: string | null;
  attachments?: Array<{
    kind: string;
    ref: string;
    hash?: string | null;
  }>;
  refs?: Record<string, string | null | undefined>;
};

export type SharedReceiptEnvelope = {
  schema: typeof SHARED_RECEIPT_SCHEMA;
  receiptId: string;
  issuedAt: string;
  producer: SharedReceiptParty;
  subject: SharedReceiptSubject;
  operation: SharedReceiptOperation;
  ontology?: SharedReceiptOntology;
  economics?: SharedReceiptEconomics;
  trust: SharedReceiptTrust;
  evidence?: SharedReceiptEvidence;
  telemetry?: Record<string, unknown>;
  refs?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  signature?: string;
};

const sharedReceiptSystemSchema = z.enum([
  'AGENTCACHE',
  'MAXXEVAL',
  'CLAWSAVE',
  'JETTYAGENT',
  'SYMBIONT',
]);

const sharedReceiptVerdictSchema = z.enum(['PASS', 'REVIEW', 'BLOCK', 'INFO']);

const sharedReceiptSubjectKindSchema = z.enum([
  'API_CALL',
  'STATUS_SNAPSHOT',
  'PERFORMANCE_SNAPSHOT',
  'BOT_CYCLE',
  'PATHOLOGY_RUN',
  'TRADE_INTENT',
  'TRADE_EXECUTION',
  'TRUST_EXPORT',
  'BROWSER_TASK',
]);

const sharedReceiptPartySchema = z.object({
  system: sharedReceiptSystemSchema,
  id: z.string().min(1),
  role: z.string().min(1).optional(),
  profileId: z.string().min(1).optional(),
  walletAddress: z.string().min(1).optional(),
});

const sharedReceiptSubjectSchema = z.object({
  kind: sharedReceiptSubjectKindSchema,
  id: z.string().min(1),
  ref: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
});

const sharedReceiptOntologySchema = z.object({
  sectorId: z.string().min(1).optional(),
  ontologyRef: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  signClass: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  matchedTerms: z.array(z.string().min(1)).optional(),
  bridgeTrace: z.array(z.record(z.string(), z.unknown())).optional(),
});

const sharedReceiptOperationSchema = z.object({
  action: z.string().min(1),
  provider: z.string().min(1).optional(),
  route: z.string().min(1).optional(),
  method: z.string().min(1).optional(),
  environment: z.string().min(1).optional(),
});

const sharedReceiptEconomicsSchema = z.object({
  sku: z.string().min(1).optional(),
  priceMicros: z.number().int().nullable().optional(),
  revenueMicros: z.number().int().nullable().optional(),
  tokenCost: z.number().nullable().optional(),
  latencyMs: z.number().min(0).nullable().optional(),
});

const sharedReceiptTrustSchema = z.object({
  verdict: sharedReceiptVerdictSchema,
  status: z.string().min(1).optional(),
  anomalyScore: z.number().min(0).nullable().optional(),
  driftScore: z.number().min(0).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const sharedReceiptEvidenceSchema = z.object({
  payloadHash: z.string().min(1).nullable().optional(),
  attachments: z.array(z.object({
    kind: z.string().min(1),
    ref: z.string().min(1),
    hash: z.string().min(1).nullable().optional(),
  })).optional(),
  refs: z.record(z.string(), z.union([z.string(), z.null(), z.undefined()])).optional(),
});

export const sharedReceiptEnvelopeSchema = z.object({
  schema: z.literal(SHARED_RECEIPT_SCHEMA),
  receiptId: z.string().min(1),
  issuedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'issuedAt must be a valid ISO timestamp',
  }),
  producer: sharedReceiptPartySchema,
  subject: sharedReceiptSubjectSchema,
  operation: sharedReceiptOperationSchema,
  ontology: sharedReceiptOntologySchema.optional(),
  economics: sharedReceiptEconomicsSchema.optional(),
  trust: sharedReceiptTrustSchema,
  evidence: sharedReceiptEvidenceSchema.optional(),
  telemetry: z.record(z.string(), z.unknown()).optional(),
  refs: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  signature: z.string().min(1).optional(),
});

export type SharedReceiptValidationResult =
  | { success: true; receipt: SharedReceiptEnvelope }
  | { success: false; issues: z.ZodIssue[] };

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function compactValue<T>(value: T): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => compactValue(item))
      .filter((item) => item !== undefined);
    return items as T;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, compactValue(item)] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function buildSharedReceipt(input: Omit<SharedReceiptEnvelope, 'schema'>): SharedReceiptEnvelope {
  return {
    schema: SHARED_RECEIPT_SCHEMA,
    ...((compactValue(input) as Omit<SharedReceiptEnvelope, 'schema'>) || input),
  };
}

export function normalizeSharedReceipt(receipt: SharedReceiptEnvelope): SharedReceiptEnvelope {
  const { schema: _schema, ...rest } = receipt;
  return buildSharedReceipt(rest);
}

export function validateSharedReceiptEnvelope(input: unknown): SharedReceiptValidationResult {
  const parsed = sharedReceiptEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, issues: parsed.error.issues };
  }

  return {
    success: true,
    receipt: normalizeSharedReceipt(parsed.data as SharedReceiptEnvelope),
  };
}

export function hashSharedReceipt(receipt: Omit<SharedReceiptEnvelope, 'signature'>): string {
  return crypto.createHash('sha256').update(stableStringify(receipt)).digest('hex');
}

export function signSharedReceipt(
  receipt: Omit<SharedReceiptEnvelope, 'signature'>,
  secret: string,
): string {
  return crypto.createHmac('sha256', secret).update(stableStringify(receipt)).digest('hex');
}

export function attachSharedReceiptSignature(
  receipt: Omit<SharedReceiptEnvelope, 'signature'>,
  secret: string,
): SharedReceiptEnvelope {
  return {
    ...receipt,
    signature: signSharedReceipt(receipt, secret),
  };
}

export function verifySharedReceiptSignature(receipt: SharedReceiptEnvelope, secret: string): boolean {
  if (!receipt.signature) return false;
  const { signature, ...unsigned } = receipt;
  const expected = signSharedReceipt(unsigned, secret);
  if (expected.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}
