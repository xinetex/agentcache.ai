/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */
import crypto from 'crypto';
import { firecrawlService } from './FirecrawlService.js';

export type BrowserProofInput = {
    url: string;
    expectedSelectors?: string[];
    expectedText?: string[];
    sector?: string;
    timeoutMs?: number;
    waitForMs?: number;
    includeMarkdown?: boolean;
};

type SelectorObservation = {
    selector: string;
    supported: boolean;
    present: boolean;
    signal?: string | null;
};

export type BrowserProofResult = {
    url: string;
    sector?: string;
    observedAt: string;
    executionMode: 'firecrawl+http' | 'http' | 'firecrawl';
    title: string | null;
    metaDescription: string | null;
    htmlHash: string;
    markdownHash: string | null;
    textHash: string;
    statusCode: number;
    selectorObservations: SelectorObservation[];
    textObservations: Array<{ text: string; present: boolean }>;
    proofHash: string;
    proofSignature: string;
    witness: {
        titleMatched: boolean;
        matchedSelectors: number;
        matchedTexts: number;
    };
    snapshot: {
        title: string | null;
        excerpt: string | null;
    };
};

function hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function signProof(hash: string): string {
    const secret = (process.env.AGENTCACHE_PROVIDER_SECRET || process.env.TRUSTOPS_SIGNING_SECRET || 'agentcache-proof-dev-secret').trim();
    return crypto.createHmac('sha256', secret).update(hash).digest('hex');
}

function decodeHtmlEntity(input: string): string {
    return input
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
    return decodeHtmlEntity(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

function extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match ? decodeHtmlEntity(match[1].replace(/\s+/g, ' ').trim()) : null;
}

function extractMetaDescription(html: string): string | null {
    const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    return match ? decodeHtmlEntity(match[1].trim()) : null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function observeSelector(selector: string, html: string, title: string | null, metaDescription: string | null): SelectorObservation {
    if (selector === 'title') {
        return { selector, supported: true, present: Boolean(title), signal: title };
    }

    if (selector === 'meta[name="description"]') {
        return { selector, supported: true, present: Boolean(metaDescription), signal: metaDescription };
    }

    if (selector.startsWith('#')) {
        const id = escapeRegExp(selector.slice(1));
        const present = new RegExp(`id=["']${id}["']`, 'i').test(html);
        return { selector, supported: true, present, signal: present ? `id:${selector.slice(1)}` : null };
    }

    if (selector.startsWith('.')) {
        const className = escapeRegExp(selector.slice(1));
        const present = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'i').test(html);
        return { selector, supported: true, present, signal: present ? `class:${selector.slice(1)}` : null };
    }

    if (/^[a-z][a-z0-9-]*$/i.test(selector)) {
        const present = new RegExp(`<${escapeRegExp(selector)}\\b`, 'i').test(html);
        return { selector, supported: true, present, signal: present ? `tag:${selector}` : null };
    }

    return { selector, supported: false, present: false, signal: null };
}

async function fetchHtml(url: string, timeoutMs: number): Promise<{ html: string; statusCode: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AgentCacheBrowserProof/1.0 (+https://agentcache.ai)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
            },
            cache: 'no-store',
            signal: controller.signal,
        });

        const html = await response.text();
        return { html, statusCode: response.status };
    } finally {
        clearTimeout(timer);
    }
}

export class BrowserProofService {
    async prove(input: BrowserProofInput): Promise<BrowserProofResult> {
        const timeoutMs = Math.max(3_000, input.timeoutMs || 15_000);
        const waitForMs = Math.max(0, input.waitForMs || 1_000);

        const [htmlResult, markdownResult] = await Promise.allSettled([
            fetchHtml(input.url, timeoutMs),
            input.includeMarkdown === false
                ? Promise.resolve<string | null>(null)
                : firecrawlService.scrapeUrl(input.url, {
                    timeout: timeoutMs,
                    waitFor: waitForMs,
                }).then((value) => value).catch(() => null),
        ]);

        const html = htmlResult.status === 'fulfilled' ? htmlResult.value.html : '';
        const statusCode = htmlResult.status === 'fulfilled' ? htmlResult.value.statusCode : 0;
        const markdown = markdownResult.status === 'fulfilled' ? markdownResult.value : null;

        if (!html && !markdown) {
            throw new Error('Unable to capture browser proof from either HTTP fetch or Firecrawl.');
        }

        const title = extractTitle(html);
        const metaDescription = extractMetaDescription(html);
        const visibleText = stripTags(html);
        const effectiveText = markdown || visibleText;
        const selectorObservations = (input.expectedSelectors || []).map((selector) =>
            observeSelector(selector, html, title, metaDescription)
        );
        const textObservations = (input.expectedText || []).map((text) => ({
            text,
            present: effectiveText.toLowerCase().includes(text.toLowerCase()),
        }));

        const proofPayload = {
            url: input.url,
            sector: input.sector || null,
            observedAt: new Date().toISOString(),
            executionMode: html && markdown ? 'firecrawl+http' : markdown ? 'firecrawl' : 'http',
            title,
            metaDescription,
            statusCode,
            htmlHash: hashValue(html),
            markdownHash: markdown ? hashValue(markdown) : null,
            textHash: hashValue(effectiveText),
            selectorObservations,
            textObservations,
            snapshot: {
                title,
                excerpt: effectiveText.slice(0, 280) || null,
            },
        };

        const proofHash = hashValue(JSON.stringify(proofPayload));
        const proofSignature = signProof(proofHash);

        return {
            ...proofPayload,
            executionMode: html && markdown ? 'firecrawl+http' : markdown ? 'firecrawl' : 'http',
            proofHash,
            proofSignature,
            witness: {
                titleMatched: Boolean(title),
                matchedSelectors: selectorObservations.filter((item) => item.present).length,
                matchedTexts: textObservations.filter((item) => item.present).length,
            },
        };
    }
}

export const browserProofService = new BrowserProofService();
