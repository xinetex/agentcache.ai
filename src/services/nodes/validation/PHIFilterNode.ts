import { ExecutableNode, NodeContext, NodeResult } from '../NodeRegistry.js';

export class PHIFilterNode implements ExecutableNode {
    id = 'phi_filter';

    async execute(ctx: NodeContext): Promise<NodeResult> {
        const logs: string[] = [];
        let dataStr = JSON.stringify(ctx.input);
        let modified = false;

        // Configuration (Defaults if not present)
        // In a real implementation, we'd parse ctx.config to see if mode='redact' or 'block'
        const mode = 'redact'; // Defaulting to redact for safety

        // regex patterns for PHI
        const patterns = {
            ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
            mrn: /\bMRN-\d{5,}\b/g,
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
        };

        // Check for SSN
        if (patterns.ssn.test(dataStr)) {
            logs.push('Detected potential SSN');
            if (mode === 'redact') {
                dataStr = dataStr.replace(patterns.ssn, '[REDACTED-SSN]');
                modified = true;
            } else if (mode === 'block') {
                return { success: false, logs, block: true };
            }
        }

        // Check for MRN
        if (patterns.mrn.test(dataStr)) {
            logs.push('Detected Medical Record Number');
            if (mode === 'redact') {
                dataStr = dataStr.replace(patterns.mrn, '[REDACTED-MRN]');
                modified = true;
            }
        }

        return {
            success: true,
            logs,
            modifiedInput: modified ? JSON.parse(dataStr) : ctx.input
        };
    }
}
