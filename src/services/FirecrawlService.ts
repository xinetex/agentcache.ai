import { z } from 'zod';
import { redis } from '../lib/redis.js';

/**
 * Firecrawl API Service
 * 
 * Responsible for ingesting raw URL content and converting it to clean Markdown
 * for use in the Ontology Excavator.
 * 
 * Requires: process.env.FIRECRAWL_API_KEY
 */
export class FirecrawlService {
    private apiKey: string;
    private baseUrl = 'https://api.firecrawl.dev/v1';

    constructor() {
        this.apiKey = process.env.FIRECRAWL_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[FirecrawlService] FIRECRAWL_API_KEY is not set. Scraping will fail.');
        }
    }

    /**
     * Scrape a single URL and return clean markdown content.
     */
    async scrapeUrl(url: string, options: {
        timeout?: number,
        waitFor?: number,
        bypassCache?: boolean
    } = {}): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Firecrawl API key not configured');
        }

        const cacheKey = `firecrawl:scrape:${Buffer.from(url).toString('base64')}`;

        // 1. Check Redis Cache (Default 24h TTL)
        if (!options.bypassCache) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return cached as string;
            }
        }

        // 2. Perform Scrape
        try {
            const response = await fetch(`${this.baseUrl}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    url,
                    formats: ['markdown'],
                    waitFor: options.waitFor || 1000,
                    timeout: options.timeout || 30000
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Firecrawl API error (${response.status}): ${errText}`);
            }

            const data = await response.json();

            if (!data.success || !data.data || !data.data.markdown) {
                throw new Error('Firecrawl returned invalid or empty markdown data');
            }

            const markdown = data.data.markdown;

            // 3. Cache the result for 24 hours to save Firecrawl credits
            await redis.setex(cacheKey, 86400, markdown).catch(e => console.error('[Firecrawl] Cache Set Error:', e));

            return markdown;

        } catch (error: any) {
            console.error(`[FirecrawlService] Failed to scrape ${url}:`, error);
            throw error;
        }
    }
}

export const firecrawlService = new FirecrawlService();
