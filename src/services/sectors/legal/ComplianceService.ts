
import { NodeRegistry } from '../../nodes/NodeRegistry.js';
import { BillingService, PRICING } from '../../BillingService.js';
import { redis } from '../../../lib/redis.js';

export interface AuditRequest {
    documentId: string;
    content: string | object;
    type: 'contract' | 'email' | 'report';
}

export interface AuditResult {
    risk_score: number;
    flags: string[];
    compliant: boolean;
    audit_id: string;
}

export class ComplianceService {

    async auditDocument(req: AuditRequest): Promise<AuditResult> {
        // 1. Billing
        const billing = new BillingService();
        await billing.charge(PRICING.RISK_ANALYSIS || 5, "Compliance: Audit");

        console.log(`[ComplianceService] ⚖️ Auditing document: ${req.documentId}`);

        // 2. Execution Engine: Run the filters
        const pipelineResult = await NodeRegistry.runPipeline(
            ['keyword_risk_filter', 'phi_filter'], // We run both for max safety
            {},
            { content: req.content },
            'legal'
        );

        // 3. Analysis
        const flags = pipelineResult.logs;
        const riskScore = flags.length * 10; // Simple heuristic: 10 points per flag
        const compliant = riskScore < 50;
        const auditId = `audit_${Date.now()}`;

        // 4. Persistence (Redis)
        // Store the detailed report
        const report = {
            req,
            flags,
            riskScore,
            timestamp: Date.now()
        };
        await redis.set(`compliance:report:${auditId}`, JSON.stringify(report));

        // 5. Dashboard Visibility
        if (!compliant || flags.length > 0) {
            const activityParams = {
                type: compliant ? 'warning' : 'alert', // Yellow if just a few, Red if high risk
                message: `Compliance Audit: ${req.documentId} flagged ${flags.length} risks.`,
                source: 'ComplianceService',
                timestamp: Date.now()
            };
            redis.lpush('dashboard:activity', JSON.stringify(activityParams)).catch(console.error);
        }

        return {
            risk_score: riskScore,
            flags,
            compliant,
            audit_id: auditId
        };
    }
}
