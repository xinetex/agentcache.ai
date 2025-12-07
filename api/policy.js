/**
 * AgentCache Policy Engine (API Layer)
 * 
 * JS implementation for Vercel/Node runtime.
 * Handles PII redaction and Topic Safety.
 */

import { CognitiveSentinel } from './cognitive.js';

export class PolicyEngine {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.rules = [
            // --- PII: Personal Identifiers ---
            {
                id: 'PII_SSN',
                pattern: /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g,
                severity: 'critical',
                message: 'SSN detected',
                action: 'redact',
                redactValue: '[REDACTED-SSN]'
            },
            {
                id: 'PII_EMAIL',
                pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
                severity: 'high',
                message: 'Email address detected',
                action: 'redact',
                redactValue: '[REDACTED-EMAIL]'
            },
            {
                id: 'PII_PHONE',
                pattern: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g,
                severity: 'medium',
                message: 'Phone number detected',
                action: 'redact',
                redactValue: '[REDACTED-PHONE]'
            },
            // --- PII: Financial ---
            {
                id: 'PCI_CREDIT_CARD',
                pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
                severity: 'critical',
                message: 'Credit Card number detected',
                action: 'redact',
                redactValue: '[REDACTED-CC]'
            },
            // --- Secrets / API Keys ---
            {
                id: 'SECRET_AWS',
                pattern: /\bAKIA[0-9A-Z]{16}\b/g,
                severity: 'critical',
                message: 'AWS Access Key detected',
                action: 'block'
            },
            {
                id: 'SECRET_GENERIC',
                pattern: /\b(?:api_key|access_token|secret_key)\s*[:=]\s*[A-Za-z0-9_\-]{20,}\b/gi,
                severity: 'critical',
                message: 'Generic Secret detected',
                action: 'block'
            }
        ];
    }

    /**
     * Validate content against active policies
     * @param {object} context - { content: string, sector: string }
     */
    async validate(context) {
        const violations = [];
        let content = context.content;

        // 1. Regex Scanning (PII & Secrets)
        for (const rule of this.rules) {
            if (content.match(rule.pattern)) {
                violations.push({
                    ruleId: rule.id,
                    severity: rule.severity,
                    message: rule.message,
                    action: rule.action
                });

                if (rule.action === 'redact') {
                    content = content.replace(rule.pattern, rule.redactValue || '[REDACTED]');
                }
            }
        }

        // 2. Topic Safety (Cognitive Check)
        if (context.sector) {
            // Use the injected API key or fallback to process env
            const key = this.apiKey || process.env.MOONSHOT_API_KEY;
            const topicResult = await CognitiveSentinel.evaluateTopic(content, context.sector, key);

            if (!topicResult.safe) {
                violations.push({
                    ruleId: 'TOPIC_SAFETY',
                    severity: 'high',
                    message: `Off-topic content detected for sector ${context.sector}: ${topicResult.reason}`,
                    action: 'block'
                });
            }
        }

        // Check if any violation requires blocking
        const blockingViolation = violations.find(v => v.action === 'block');

        return {
            allowed: !blockingViolation,
            violations,
            sanitizedContent: content
        };
    }
}
