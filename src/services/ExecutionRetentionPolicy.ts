const DEFAULT_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 2555;

export function getExecutionRetentionDays(): number {
  const configured = Number(process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= MIN_RETENTION_DAYS && configured <= MAX_RETENTION_DAYS
    ? configured
    : DEFAULT_RETENTION_DAYS;
}

export function executionRecordExpiresAt(now = new Date()): Date {
  const days = getExecutionRetentionDays();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export const executionRetentionBounds = {
  minimumDays: MIN_RETENTION_DAYS,
  maximumDays: MAX_RETENTION_DAYS,
  defaultDays: DEFAULT_RETENTION_DAYS,
};
