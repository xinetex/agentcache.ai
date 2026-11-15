const SENSITIVE_FIELD = /(?:secret|credential|password|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization|cookie|session)/i;
const SENSITIVE_VALUE = /(?:\bBearer\s+)[A-Za-z0-9._~+\/-]+=*|\b(?:sk-[A-Za-z0-9_-]{12,}|ac_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/gi;

/** Redact common credential fields and recognizable token strings before data is stored or returned. */
export function redactSensitiveData<T>(value: T, fieldName = ''): T {
  if (SENSITIVE_FIELD.test(fieldName)) return '[REDACTED]' as T;
  if (typeof value === 'string') return value.replace(SENSITIVE_VALUE, '[REDACTED]') as T;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, redactSensitiveData(item, key)]),
    ) as T;
  }
  return value;
}
