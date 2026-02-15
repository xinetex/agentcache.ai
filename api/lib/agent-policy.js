const POLICY_DATE = '2026-02-08';
export const AGENT_POLICY_VERSION = `${POLICY_DATE}.1`;

const ALLOWED_OPERATOR_TYPES = new Set(['human', 'agent', 'service']);

function parseBooleanEnv(raw, fallback) {
  if (!raw) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBool(value) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeUseCases(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function parseIsoDate(raw) {
  const normalized = normalizeString(raw);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isAgentPolicyStrictModeEnabled() {
  return parseBooleanEnv(process.env.AGENT_POLICY_STRICT, false);
}

function isAgentPolicyContactRequired() {
  return parseBooleanEnv(process.env.AGENT_POLICY_REQUIRE_CONTACT, true);
}

export function evaluateAgentPolicyDeclaration(declaration = {}, options = {}) {
  const strict = options.strict ?? isAgentPolicyStrictModeEnabled();
  const findings = [];
  const missingSeverity = strict ? 'error' : 'warning';

  const normalized = {
    operatorType: normalizeString(declaration.operatorType)?.toLowerCase() || null,
    useCases: normalizeUseCases(declaration.useCases),
    contentRightsConfirmed: normalizeBool(declaration.contentRightsConfirmed),
    antiAbuseConfirmed: normalizeBool(declaration.antiAbuseConfirmed),
    contactEmail: normalizeString(declaration.contactEmail),
    termsAcceptedAt: normalizeString(declaration.termsAcceptedAt),
  };

  if (!normalized.operatorType) {
    findings.push({
      code: 'operator_type_missing',
      severity: missingSeverity,
      field: 'operatorType',
      message: 'Declare who operates this agent: human, agent, or service.',
    });
  } else if (!ALLOWED_OPERATOR_TYPES.has(normalized.operatorType)) {
    findings.push({
      code: 'operator_type_invalid',
      severity: 'error',
      field: 'operatorType',
      message: 'operatorType must be one of: human, agent, service.',
    });
  }

  if (normalized.contentRightsConfirmed !== true) {
    findings.push({
      code: 'content_rights_unconfirmed',
      severity: missingSeverity,
      field: 'contentRightsConfirmed',
      message:
        'You must confirm rights or permission for archived content (including third-party sources like YouTube).',
    });
  }

  if (normalized.antiAbuseConfirmed !== true) {
    findings.push({
      code: 'anti_abuse_unconfirmed',
      severity: missingSeverity,
      field: 'antiAbuseConfirmed',
      message: 'You must confirm anti-abuse, anti-fraud, and anti-evasion obligations.',
    });
  }

  if (normalized.useCases.length === 0) {
    findings.push({
      code: 'use_cases_missing',
      severity: 'warning',
      field: 'useCases',
      message: 'Provide at least one use case so policy and limits can be tuned.',
    });
  }

  const acceptedAt = parseIsoDate(normalized.termsAcceptedAt);
  if (!acceptedAt) {
    findings.push({
      code: 'terms_acceptance_missing',
      severity: missingSeverity,
      field: 'termsAcceptedAt',
      message: 'termsAcceptedAt is required to prove policy acceptance.',
    });
  } else if (acceptedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    findings.push({
      code: 'terms_acceptance_in_future',
      severity: 'error',
      field: 'termsAcceptedAt',
      message: 'termsAcceptedAt cannot be in the future.',
    });
  }

  if (!normalized.contactEmail) {
    if (strict && isAgentPolicyContactRequired()) {
      findings.push({
        code: 'contact_email_missing',
        severity: 'error',
        field: 'contactEmail',
        message: 'A valid operator contactEmail is required in strict mode.',
      });
    } else {
      findings.push({
        code: 'contact_email_missing',
        severity: 'warning',
        field: 'contactEmail',
        message: 'Provide contactEmail for abuse and incident-response communication.',
      });
    }
  } else if (!isLikelyEmail(normalized.contactEmail)) {
    findings.push({
      code: 'contact_email_invalid',
      severity: 'error',
      field: 'contactEmail',
      message: 'contactEmail format is invalid.',
    });
  }

  const blocking = findings.some((entry) => entry.severity === 'error');
  return {
    version: AGENT_POLICY_VERSION,
    strict,
    compliant: !blocking,
    blocking,
    findings,
    declaration: normalized,
  };
}

export function getAgentPolicyManifest() {
  const strict = isAgentPolicyStrictModeEnabled();
  return {
    name: 'AgentCache Agent Policy Protocol',
    version: AGENT_POLICY_VERSION,
    updatedOn: POLICY_DATE,
    strict,
    enforcement: {
      mode: strict ? 'strict' : 'advisory',
      envFlags: {
        strictMode: 'AGENT_POLICY_STRICT',
        requireContact: 'AGENT_POLICY_REQUIRE_CONTACT',
      },
    },
    requiredDeclarations: [
      {
        field: 'operatorType',
        values: ['human', 'agent', 'service'],
        required: true,
      },
      {
        field: 'contentRightsConfirmed',
        required: true,
        description: 'Operator confirms rights/permission to archive or mirror requested content.',
      },
      {
        field: 'antiAbuseConfirmed',
        required: true,
        description: 'Operator confirms anti-fraud, anti-evasion, anti-malware obligations.',
      },
      {
        field: 'termsAcceptedAt',
        required: true,
        description: 'ISO timestamp proving operator acceptance of policy terms.',
      },
      {
        field: 'contactEmail',
        required: strict && isAgentPolicyContactRequired(),
        description: 'Abuse/incident response contact.',
      },
    ],
    recommendedDeclarations: [
      {
        field: 'useCases',
        description: 'Declared use cases to support risk scoring and adaptive limits.',
      },
    ],
    references: {
      registrationEndpoint: '/api/agents/register',
      policyEndpoint: '/api/policy/agent',
    },
  };
}
