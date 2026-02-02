
export interface NodeContext {
    config: any;      // The specific config for this node (from sector.js)
    input: any;       // The payload (e.g., JSON request)
    sectorId: string; // 'healthcare', 'finance', etc.
}

export interface NodeResult {
    success: boolean;
    modifiedInput?: any; // If the node modified the data (e.g. redaction)
    logs: string[];      // Audit logs
    block?: boolean;     // If true, stop processing
}

export interface ExecutableNode {
    id: string;
    execute(ctx: NodeContext): Promise<NodeResult>;
}

import { PHIFilterNode } from './validation/PHIFilterNode.js';
import { KeywordRiskNode } from './validation/KeywordRiskNode.js';

export class NodeRegistry {
    private static nodes: Map<string, ExecutableNode> = new Map();

    static register(node: ExecutableNode) {
        this.nodes.set(node.id, node);
    }

    static get(nodeId: string): ExecutableNode | undefined {
        // Lazy registration of built-ins
        if (!this.nodes.has('phi_filter')) this.register(new PHIFilterNode());
        if (!this.nodes.has('keyword_risk_filter')) this.register(new KeywordRiskNode());

        return this.nodes.get(nodeId);
    }

    static async runPipeline(nodeIdList: string[], fullConfig: any, input: any, sectorId: string): Promise<NodeResult> {
        let currentInput = input;
        const allLogs: string[] = [];

        for (const nodeId of nodeIdList) {
            const node = this.get(nodeId);
            if (!node) {
                console.warn(`[NodeRegistry] Node '${nodeId}' not found. Skipping.`);
                continue;
            }

            // Extract specific config for this node
            // In api/sector.js structure, we might need to find the node config
            // For now, we pass the whole config and let the node find itself or receive a subset.
            // Simplified: We assume 'fullConfig' has a 'nodes' array or similar. 
            // Better: Services should extract the specific node config before calling.
            // For this phase, we pass fullConfig.

            const result = await node.execute({ config: fullConfig, input: currentInput, sectorId });
            allLogs.push(...result.logs);

            if (result.block) {
                return { success: false, logs: allLogs, block: true };
            }

            if (result.modifiedInput) {
                currentInput = result.modifiedInput;
            }
        }

        return { success: true, modifiedInput: currentInput, logs: allLogs };
    }
}
