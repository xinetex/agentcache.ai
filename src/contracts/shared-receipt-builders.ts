import {
  attachSharedReceiptSignature,
  buildSharedReceipt,
  type SharedReceiptEconomics,
  type SharedReceiptEnvelope,
  type SharedReceiptOntology,
  type SharedReceiptSystem,
  type SharedReceiptTrust,
} from './shared-receipt.js';

type ReceiptBuilderContext = {
  receiptId: string;
  issuedAt?: string;
  producer: {
    system: SharedReceiptSystem;
    id: string;
    role?: string;
    profileId?: string;
    walletAddress?: string;
  };
  ontology?: SharedReceiptOntology;
  economics?: SharedReceiptEconomics;
  trust?: SharedReceiptTrust;
  refs?: Record<string, unknown>;
  telemetry?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  secret?: string;
};

type BotCycleReceiptInput = ReceiptBuilderContext & {
  cycleId: string;
  environment?: string;
  status?: string;
  action?: string;
};

type PerformanceSnapshotReceiptInput = ReceiptBuilderContext & {
  snapshotId: string;
  route?: string;
  status?: string;
  action?: string;
};

type ApiCallReceiptInput = ReceiptBuilderContext & {
  callId: string;
  route: string;
  method?: string;
  provider?: string;
  status?: string;
  action?: string;
};

type TrustExportReceiptInput = ReceiptBuilderContext & {
  exportId: string;
  route?: string;
  status?: string;
  action?: string;
};

type PathologyRunReceiptInput = ReceiptBuilderContext & {
  runId: string;
  route?: string;
  environment?: string;
  action?: string;
};

function finalizeReceipt(receipt: SharedReceiptEnvelope, secret?: string): SharedReceiptEnvelope {
  return secret ? attachSharedReceiptSignature(receipt, secret) : receipt;
}

function defaultTrust(input?: SharedReceiptTrust): SharedReceiptTrust {
  return input || { verdict: 'INFO' };
}

export function buildBotCycleReceipt(input: BotCycleReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'BOT_CYCLE',
      id: input.cycleId,
    },
    operation: {
      action: input.action || 'bot.cycle',
      environment: input.environment,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildPerformanceSnapshotReceipt(input: PerformanceSnapshotReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'PERFORMANCE_SNAPSHOT',
      id: input.snapshotId,
      route: input.route,
    },
    operation: {
      action: input.action || 'performance.snapshot',
      route: input.route,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildApiCallReceipt(input: ApiCallReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'API_CALL',
      id: input.callId,
      route: input.route,
    },
    operation: {
      action: input.action || 'api.call',
      provider: input.provider,
      route: input.route,
      method: input.method || 'POST',
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildTrustExportReceipt(input: TrustExportReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'TRUST_EXPORT',
      id: input.exportId,
      route: input.route,
    },
    operation: {
      action: input.action || 'trust.export',
      route: input.route,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildPathologyRunReceipt(input: PathologyRunReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'PATHOLOGY_RUN',
      id: input.runId,
      route: input.route,
    },
    operation: {
      action: input.action || 'pathology.assess',
      route: input.route,
      environment: input.environment,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}
