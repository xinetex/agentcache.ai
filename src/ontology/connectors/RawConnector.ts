/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { DataLakeConnector, DataLakeSource } from '../DataLakeConnector.js';

/**
 * RawConnector: Pass-through connector for inline data payloads.
 * Useful for agent-to-agent data handoff where the data is already in memory.
 */
export class RawConnector extends DataLakeConnector {

    async ingest(source: DataLakeSource): Promise<string> {
        if (!source.data) {
            throw new Error('[RawConnector] Inline data is required. Provide source.data as string or object.');
        }

        const raw = typeof source.data === 'string'
            ? source.data
            : JSON.stringify(source.data, null, 2);

        console.log(`[RawConnector] Ingested ${raw.length} chars of inline ${typeof source.data} data.`);

        return raw;
    }
}

export const rawConnector = new RawConnector();
