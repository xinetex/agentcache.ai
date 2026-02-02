import { ExecutableNode, NodeContext, NodeResult } from '../NodeRegistry.js';

export class KeywordRiskNode implements ExecutableNode {
    id = 'keyword_risk_filter';

    async execute(ctx: NodeContext): Promise<NodeResult> {
        const logs: string[] = [];
        const content = JSON.stringify(ctx.input).toLowerCase();

        // Risk Categories
        const risks = {
            bribery: ['kickback', 'bribe', 'facilitation payment', 'under the table'],
            insider_trading: ['non-public', 'pre-release', 'insider', 'confidential results', 'earnings leak'],
            coercion: ['must sign', 'or else', 'consequences', 'immediate payment required']
        };

        const foundRisks: string[] = [];

        // Scan
        for (const [category, keywords] of Object.entries(risks)) {
            for (const word of keywords) {
                if (content.includes(word)) {
                    foundRisks.push(`${category.toUpperCase()}: "${word}"`);
                    logs.push(`⚠️ Risk Detected: ${category.toUpperCase()} keyword found: "${word}"`);
                }
            }
        }

        if (foundRisks.length > 0) {
            // We append the analysis to the result, but don't necessarily block unless configured
            return {
                success: true,
                logs,
                // We add a metadata field to the input (if it's an object) to tag it
                modifiedInput: typeof ctx.input === 'object' ? { ...ctx.input, _risk_analysis: foundRisks } : ctx.input
            };
        }

        return { success: true, logs: [] };
    }
}
