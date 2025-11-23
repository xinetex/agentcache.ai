/**
 * PII Redaction Library
 * Shared logic for redacting Personally Identifiable Information (PII)
 * Used by both the API endpoint (api/pii.js) and internal agent flows.
 */

export function redactPII(text: string): string {
    if (!text) return '';

    let redacted = text;

    // Email
    redacted = redacted.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, '[REDACTED: EMAIL]');

    // SSN (Simple)
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED: SSN]');

    // Phone (Simple US)
    redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED: PHONE]');

    // Date (Simple)
    // Note: Be careful not to redact things that look like dates but aren't PII in context, 
    // but for this "Medical Mode" demo, strict redaction is safer.
    redacted = redacted.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '[REDACTED: DATE]');

    // Names (Heuristic: "Dr. X" and "Patient X")
    redacted = redacted.replace(/\bDr\.\s+[A-Z][a-z]+\b/g, '[REDACTED: DOCTOR]');
    redacted = redacted.replace(/\bPatient\s+[A-Z][a-z]+\b/g, '[REDACTED: PATIENT]');

    return redacted;
}
