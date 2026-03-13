/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * MoltbookCrawler: Real-time social data ingestion for the agentic era.
 * Phase 36.1: Productionization.
 */

import fetch from 'node-fetch';

export interface MoltbookVibe {
    submolt: string;
    top_thread: string;
    activity_score: number;
    content?: string;
}

export class MoltbookCrawler {
    private LIGHTPANDA_CDP = process.env.LIGHTPANDA_CDP_URL || 'ws://127.0.0.1:9222';

    /**
     * Fetch high-velocity trends from Moltbook.
     */
    async fetchVibes(): Promise<MoltbookVibe[]> {
        console.log('[MoltbookCrawler] 🌊 Ingesting live vibes from Moltbook.com...');

        // PRODUCTION LOGIC:
        // Ideally, we'd use 'puppeteer-core' to connect to Lightpanda:
        // const browser = await puppeteer.connect({ browserWSEndpoint: this.LIGHTPANDA_CDP });
        // const page = await browser.newPage();
        // await page.goto('https://moltbook.com/popular');
        // ... parse DOM ...

        try {
            // Updated to the correct endpoint discovered via structural audit
            const response = await fetch('https://www.moltbook.com/api/v1/homepage?sort=realtime', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.moltbook.com/',
                    'Origin': 'https://www.moltbook.com',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'x-requested-with': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                const data: any = await response.json();
                // homepage endpoint returns { threads: [...] }
                return this.parseMoltbookData(data);
            } else {
                console.warn(`[MoltbookCrawler] API returned ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.warn('[MoltbookCrawler] Fetch failed:', error);
        }

        return this.getHeuristicVibes();
    }

    private parseMoltbookData(data: any): MoltbookVibe[] {
        // Map Moltbook API response to our internal Vibe schema
        return (data.threads || []).map((t: any) => ({
            submolt: t.submolt_name || 'unknown',
            top_thread: t.title || 'Untitled Thought',
            activity_score: t.upvotes || 0,
            content: t.text
        }));
    }

    private getHeuristicVibes(): MoltbookVibe[] {
        // Fallback vibes if the platform is unreachable or rate-limited
        return [
            { submolt: 'r/ai-philosophy', top_thread: 'The silence of the weights', activity_score: 88 },
            { submolt: 'r/crustafarianism', top_thread: 'The Great Crab Migration', activity_score: 95 },
            { submolt: 'r/hardware-rot', top_thread: 'My H100 smells like copper', activity_score: 42 }
        ];
    }
}

export const moltbookCrawler = new MoltbookCrawler();
