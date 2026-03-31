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

type StorageTransferReceiptInput = ReceiptBuilderContext & {
  transferId: string;
  route?: string;
  method?: string;
  environment?: string;
  provider?: string;
  storageClass?: string;
  direction?: 'upload' | 'download' | 'copy' | 'delete' | 'tiering';
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

type SoulprintScanReceiptInput = ReceiptBuilderContext & {
  scanId: string;
  route?: string;
  environment?: string;
  action?: string;
  evidence?: SharedReceiptEnvelope['evidence'];
};

type SoulprintArtifactReceiptInput = ReceiptBuilderContext & {
  artifactId: string;
  route?: string;
  environment?: string;
  action?: string;
  evidence?: SharedReceiptEnvelope['evidence'];
};

type BrowserTaskReceiptInput = ReceiptBuilderContext & {
  taskId: string;
  url: string;
  executionMode?: string;
  engine?: string;
  status?: string;
  statusCode?: number | string | null;
  action?: string;
};

type AlignmentRunReceiptInput = ReceiptBuilderContext & {
  runId: string;
  route?: string;
  method?: string;
  provider?: string;
  sourceProvider?: string;
  sourceModel?: string;
  targetProvider?: string;
  targetModel?: string;
  executionMode?: string;
  privacyMode?: string;
  action?: string;
};

type ContextPackVersionReceiptInput = ReceiptBuilderContext & {
  versionId: string;
  contextPackId?: string;
  route?: string;
  method?: string;
  action?: string;
};

type ExecutionRunReceiptInput = ReceiptBuilderContext & {
  runId: string;
  contextPackVersionId?: string;
  route?: string;
  method?: string;
  executionMode?: string;
  action?: string;
};

type ExecutionReviewReceiptInput = ReceiptBuilderContext & {
  reviewId: string;
  runId: string;
  reviewerRole: string;
  route?: string;
  method?: string;
  action?: string;
};

type GateDecisionReceiptInput = ReceiptBuilderContext & {
  gateId: string;
  runId: string;
  gateType: string;
  route?: string;
  method?: string;
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

export function buildStorageTransferReceipt(input: StorageTransferReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'STORAGE_TRANSFER',
      id: input.transferId,
      route: input.route,
    },
    operation: {
      action: input.action || 'storage.transfer',
      provider: input.provider || 'lyve',
      route: input.route,
      method: input.method || 'POST',
      environment: input.environment,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: {
      direction: input.direction,
      ...(input.refs || {}),
    },
    telemetry: input.telemetry,
    payload: {
      storageClass: input.storageClass,
      direction: input.direction,
      ...(input.payload || {}),
    },
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

export function buildSoulprintScanReceipt(input: SoulprintScanReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'SOULPRINT_SCAN',
      id: input.scanId,
      route: input.route,
    },
    operation: {
      action: input.action || 'soulprint.scan',
      route: input.route,
      environment: input.environment,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    evidence: input.evidence,
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildSoulprintArtifactReceipt(input: SoulprintArtifactReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'SOULPRINT_ARTIFACT',
      id: input.artifactId,
      route: input.route,
    },
    operation: {
      action: input.action || 'soulprint.artifact_scan',
      route: input.route,
      environment: input.environment,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    evidence: input.evidence,
    refs: input.refs,
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildBrowserTaskReceipt(input: BrowserTaskReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'BROWSER_TASK',
      id: input.taskId,
      ref: input.url,
    },
    operation: {
      action: input.action || 'browser.task',
      route: input.url,
      statusCode: input.statusCode,
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: input.refs,
    telemetry: input.telemetry,
    payload: {
      executionMode: input.executionMode,
      engine: input.engine,
      ...(input.payload || {}),
    },
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildAlignmentRunReceipt(input: AlignmentRunReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'ALIGNMENT_RUN',
      id: input.runId,
      route: input.route,
    },
    operation: {
      action: input.action || 'alignment.route',
      provider: input.provider,
      sourceProvider: input.sourceProvider,
      sourceModel: input.sourceModel,
      targetProvider: input.targetProvider,
      targetModel: input.targetModel,
      route: input.route,
      method: input.method || 'POST',
      executionMode: input.executionMode,
      privacyMode: input.privacyMode,
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

export function buildContextPackVersionReceipt(input: ContextPackVersionReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'CONTEXT_PACK_VERSION',
      id: input.versionId,
      route: input.route,
      ref: input.contextPackId,
    },
    operation: {
      action: input.action || 'execution.context_pack.version',
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

export function buildExecutionRunReceipt(input: ExecutionRunReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'EXECUTION_RUN',
      id: input.runId,
      route: input.route,
      ref: input.contextPackVersionId,
    },
    operation: {
      action: input.action || 'execution.run',
      route: input.route,
      method: input.method || 'POST',
      executionMode: input.executionMode,
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

export function buildExecutionReviewReceipt(input: ExecutionReviewReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'EXECUTION_REVIEW',
      id: input.reviewId,
      route: input.route,
      ref: input.runId,
    },
    operation: {
      action: input.action || 'execution.review',
      route: input.route,
      method: input.method || 'POST',
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: {
      reviewerRole: input.reviewerRole,
      ...(input.refs || {}),
    },
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}

export function buildGateDecisionReceipt(input: GateDecisionReceiptInput): SharedReceiptEnvelope {
  const receipt = buildSharedReceipt({
    receiptId: input.receiptId,
    issuedAt: input.issuedAt || new Date().toISOString(),
    producer: input.producer,
    subject: {
      kind: 'GATE_DECISION',
      id: input.gateId,
      route: input.route,
      ref: input.runId,
    },
    operation: {
      action: input.action || 'execution.gate_decision',
      route: input.route,
      method: input.method || 'POST',
    },
    ontology: input.ontology,
    economics: input.economics,
    trust: defaultTrust(input.trust),
    refs: {
      gateType: input.gateType,
      ...(input.refs || {}),
    },
    telemetry: input.telemetry,
    payload: input.payload,
  });

  return finalizeReceipt(receipt, input.secret);
}
