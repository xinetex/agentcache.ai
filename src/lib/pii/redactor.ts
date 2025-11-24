/**
 * AgentCache PII/PHI Redactor
 * 
 * Implements HIPAA-compliant redaction for:
 * - Social Security Numbers (SSN)
 * - Email Addresses
 * - Phone Numbers
 * - Medical Record Numbers (MRN) - Simulated pattern
 * - Credit Card Numbers
 * - Dates (potential DOB)
 */

export interface RedactionResult {
    original: string;
    redacted: string;
    findings: string[];
    riskScore: number; // 0-1
}

const PATTERNS = {
    // SSN: XXX-XX-XXXX
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Email: simple pattern
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone: (XXX) XXX-XXXX or XXX-XXX-XXXX
    PHONE: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

    // Credit Card: 16 digits, potentially spaced
    CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

    // MRN (Medical Record Number): Simulated as "MRN" followed by 6-9 digits
    MRN: /\bMRN[:#\s]?\d{6,9}\b/gi,

    // Date: MM/DD/YYYY or YYYY-MM-DD
    DATE: /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/g
};

export function redactPII(text: string): RedactionResult {
    let redacted = text;
    const findings: string[] = [];
    let riskScore = 0;

    // Helper to replace and track
    const replace = (pattern: RegExp, type: string, severity: number) => {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                if (!findings.includes(type)) findings.push(type);
                riskScore += severity;
            });
            redacted = redacted.replace(pattern, `[REDACTED ${type}]`);
        }
    };

    replace(PATTERNS.SSN, 'SSN', 0.5);
    replace(PATTERNS.EMAIL, 'EMAIL', 0.2);
    replace(PATTERNS.PHONE, 'PHONE', 0.2);
    replace(PATTERNS.CREDIT_CARD, 'PCI', 0.4);
    replace(PATTERNS.MRN, 'PHI_MRN', 0.8); // High severity for PHI
    replace(PATTERNS.DATE, 'DATE', 0.1);

    // Cap risk score
    riskScore = Math.min(riskScore, 1.0);

    return {
        original: text,
        redacted,
        findings,
        riskScore
    };
}
