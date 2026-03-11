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
import { firecrawlService } from '../../services/FirecrawlService.js';

/**
 * HttpConnector: Ingests data from HTTP/HTTPS endpoints.
 * Uses Firecrawl for HTML pages, raw fetch for JSON/CSV APIs.
 */
export class HttpConnector extends DataLakeConnector {

    async ingest(source: DataLakeSource): Promise<string> {
        if (!source.uri) {
            throw new Error('[HttpConnector] URI is required for HTTP ingestion.');
        }

        const url = source.uri;
        const format = source.format || this.inferFormat(url);

        console.log(`[HttpConnector] Fetching ${url} (format: ${format})`);

        if (format === 'markdown' || this.isHtmlUrl(url)) {
            // HTML pages → Firecrawl for clean markdown extraction
            return await firecrawlService.scrapeUrl(url);
        }

        // JSON/CSV APIs → direct fetch
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json, text/csv, text/plain' },
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
            throw new Error(`[HttpConnector] HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }

    private inferFormat(url: string): string {
        if (url.endsWith('.json')) return 'json';
        if (url.endsWith('.csv')) return 'csv';
        if (url.endsWith('.md')) return 'markdown';
        return 'markdown'; // Default: treat as HTML, use Firecrawl
    }

    private isHtmlUrl(url: string): boolean {
        // If no file extension or .html/.htm → treat as HTML
        const path = new URL(url).pathname;
        return !path.includes('.') || path.endsWith('.html') || path.endsWith('.htm');
    }
}

export const httpConnector = new HttpConnector();
