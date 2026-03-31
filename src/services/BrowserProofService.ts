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
import { setTimeout as sleep } from 'node:timers/promises';
import { firecrawlService } from './FirecrawlService.js';

export type BrowserProofInput = {
    url: string;
    expectedSelectors?: string[];
    expectedText?: string[];
    sector?: string;
    timeoutMs?: number;
    waitForMs?: number;
    includeMarkdown?: boolean;
    cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
};

type SelectorObservation = {
    selector: string;
    supported: boolean;
    present: boolean;
    signal?: string | null;
};

export type BrowserProofExecutionMode =
    | 'firecrawl+http'
    | 'http'
    | 'firecrawl'
    | 'lightpanda'
    | 'lightpanda+firecrawl'
    | 'lightpanda+http'
    | 'lightpanda+firecrawl+http';

export type BrowserProofResult = {
    url: string;
    sector?: string;
    observedAt: string;
    executionMode: BrowserProofExecutionMode;
    engine: 'lightpanda' | 'http-fallback';
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
    adapterNotes?: string[];
};

type HtmlCapture = {
    html: string;
    statusCode: number;
    notes?: string[];
};

type BrowserProofAdapter = {
    name: 'lightpanda' | 'http-fallback';
    isAvailable(): boolean;
    capture(input: BrowserProofInput, timeoutMs: number, waitForMs: number): Promise<HtmlCapture | null>;
};

type BrowserProofServiceDeps = {
    lightpandaAdapter?: BrowserProofAdapter;
    httpFetch?: (url: string, timeoutMs: number) => Promise<HtmlCapture>;
    markdownFetch?: (url: string, timeoutMs: number, waitForMs: number) => Promise<string | null>;
};

type CdpMessage = {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    sessionId?: string;
    result?: Record<string, unknown>;
    error?: { message?: string };
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

async function fetchHtml(url: string, timeoutMs: number): Promise<HtmlCapture> {
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

async function fetchMarkdown(url: string, timeoutMs: number, waitForMs: number): Promise<string | null> {
    return firecrawlService.scrapeUrl(url, {
        timeout: timeoutMs,
        waitFor: waitForMs,
    }).then((value) => value).catch(() => null);
}

class LightpandaCdpClient {
    private ws: WebSocket;
    private nextId = 1;
    private pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
    private listeners = new Set<(message: CdpMessage) => void>();

    private constructor(ws: WebSocket) {
        this.ws = ws;
        this.ws.addEventListener('message', (event) => {
            const payload = typeof event.data === 'string' ? event.data : String(event.data);
            const message = JSON.parse(payload) as CdpMessage;

            if (typeof message.id === 'number') {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message || 'CDP request failed.'));
                    return;
                }
                pending.resolve(message.result || {});
                return;
            }

            for (const listener of this.listeners) {
                listener(message);
            }
        });

        this.ws.addEventListener('close', () => {
            for (const [, pending] of this.pending) {
                pending.reject(new Error('CDP connection closed.'));
            }
            this.pending.clear();
        });
    }

    static async connect(endpoint: string, timeoutMs: number): Promise<LightpandaCdpClient> {
        const ws = new WebSocket(endpoint);
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timed out opening Lightpanda CDP connection.')), timeoutMs);
            ws.addEventListener('open', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
            ws.addEventListener('error', () => {
                clearTimeout(timer);
                reject(new Error('Failed to connect to Lightpanda CDP.'));
            }, { once: true });
        });
        return new LightpandaCdpClient(ws);
    }

    async send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
        const id = this.nextId++;
        const payload: CdpMessage = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;

        const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });

        this.ws.send(JSON.stringify(payload));
        return promise;
    }

    async waitForEvent(method: string, sessionId: string | undefined, timeoutMs: number): Promise<CdpMessage> {
        return new Promise<CdpMessage>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.listeners.delete(handler);
                reject(new Error(`Timed out waiting for CDP event ${method}.`));
            }, timeoutMs);

            const handler = (message: CdpMessage) => {
                if (message.method !== method) return;
                if (sessionId && message.sessionId !== sessionId) return;
                clearTimeout(timer);
                this.listeners.delete(handler);
                resolve(message);
            };

            this.listeners.add(handler);
        });
    }

    async close() {
        try {
            this.ws.close();
        } catch {
            // Best effort.
        }
    }
}

async function resolveLightpandaEndpoint(timeoutMs: number): Promise<string | null> {
    const configured = (
        process.env.LIGHTPANDA_CDP_URL
        || process.env.LIGHTPANDA_CDP
        || process.env.LIGHTPANDA_BROWSER_WS
        || ''
    ).trim();

    if (!configured) return null;
    if (configured.startsWith('ws://') || configured.startsWith('wss://')) {
        return configured;
    }

    if (!configured.startsWith('http://') && !configured.startsWith('https://')) {
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${configured.replace(/\/$/, '')}/json/version`, {
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) return null;
        const payload = await response.json() as { webSocketDebuggerUrl?: string };
        return payload.webSocketDebuggerUrl || null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export class LightpandaBrowserAdapter implements BrowserProofAdapter {
    readonly name = 'lightpanda' as const;

    isAvailable(): boolean {
        return Boolean(
            (process.env.LIGHTPANDA_CDP_URL || process.env.LIGHTPANDA_CDP || process.env.LIGHTPANDA_BROWSER_WS || '').trim(),
        );
    }

    async capture(input: BrowserProofInput, timeoutMs: number, waitForMs: number): Promise<HtmlCapture | null> {
        const endpoint = await resolveLightpandaEndpoint(Math.min(timeoutMs, 5_000));
        if (!endpoint) return null;

        const client = await LightpandaCdpClient.connect(endpoint, Math.min(timeoutMs, 5_000));

        try {
            const created = await client.send('Target.createTarget', { url: 'about:blank' });
            const targetId = String(created.targetId || '');
            if (!targetId) {
                throw new Error('Lightpanda did not return a target id.');
            }

            const attached = await client.send('Target.attachToTarget', { targetId, flatten: true });
            const sessionId = String(attached.sessionId || '');
            if (!sessionId) {
                throw new Error('Lightpanda did not return a session id.');
            }

            await client.send('Page.enable', {}, sessionId);
            await client.send('Runtime.enable', {}, sessionId);

            if (input.cookies && input.cookies.length > 0) {
                for (const cookie of input.cookies) {
                    await client.send('Network.setCookie', {
                        ...cookie,
                        url: cookie.domain ? undefined : input.url,
                    }, sessionId);
                }
            }

            await client.send('Page.navigate', { url: input.url }, sessionId);

            try {
                await client.waitForEvent('Page.loadEventFired', sessionId, Math.max(2_000, timeoutMs - 1_000));
            } catch {
                // Lightpanda coverage is still evolving. We fall back to the post-navigation delay below.
            }

            if (waitForMs > 0) {
                await sleep(waitForMs);
            }

            const evaluated = await client.send('Runtime.evaluate', {
                expression: 'document.documentElement ? document.documentElement.outerHTML : ""',
                returnByValue: true,
            }, sessionId);

            const html = typeof evaluated.result === 'object' && evaluated.result
                ? String((evaluated.result as { value?: unknown }).value || '')
                : '';

            if (!html) return null;

            return {
                html,
                statusCode: 200,
                notes: [`cdp:${endpoint}`],
            };
        } finally {
            await client.close();
        }
    }
}

function buildExecutionMode(args: {
    usedLightpanda: boolean;
    usedHttp: boolean;
    usedMarkdown: boolean;
}): BrowserProofExecutionMode {
    if (args.usedLightpanda && args.usedHttp && args.usedMarkdown) return 'lightpanda+firecrawl+http';
    if (args.usedLightpanda && args.usedMarkdown) return 'lightpanda+firecrawl';
    if (args.usedLightpanda && args.usedHttp) return 'lightpanda+http';
    if (args.usedLightpanda) return 'lightpanda';
    if (args.usedHttp && args.usedMarkdown) return 'firecrawl+http';
    if (args.usedMarkdown) return 'firecrawl';
    return 'http';
}

export class BrowserProofService {
    private readonly lightpandaAdapter: BrowserProofAdapter;
    private readonly httpFetch: (url: string, timeoutMs: number) => Promise<HtmlCapture>;
    private readonly markdownFetch: (url: string, timeoutMs: number, waitForMs: number) => Promise<string | null>;

    constructor(deps: BrowserProofServiceDeps = {}) {
        this.lightpandaAdapter = deps.lightpandaAdapter || new LightpandaBrowserAdapter();
        this.httpFetch = deps.httpFetch || fetchHtml;
        this.markdownFetch = deps.markdownFetch || fetchMarkdown;
    }

    async prove(input: BrowserProofInput): Promise<BrowserProofResult> {
        const timeoutMs = Math.max(3_000, input.timeoutMs || 15_000);
        const waitForMs = Math.max(0, input.waitForMs || 1_000);

        const lightpandaPromise = this.lightpandaAdapter.isAvailable()
            ? this.lightpandaAdapter.capture(input, timeoutMs, waitForMs).catch(() => null)
            : Promise.resolve(null);

        const httpPromise = this.httpFetch(input.url, timeoutMs).catch(() => ({ html: '', statusCode: 0 }));
        const markdownPromise = input.includeMarkdown === false
            ? Promise.resolve<string | null>(null)
            : this.markdownFetch(input.url, timeoutMs, waitForMs);

        const [lightpandaCapture, httpCapture, markdown] = await Promise.all([
            lightpandaPromise,
            httpPromise,
            markdownPromise,
        ]);

        const html = lightpandaCapture?.html || httpCapture.html;
        const statusCode = httpCapture.statusCode || lightpandaCapture?.statusCode || 0;

        if (!html && !markdown) {
            throw new Error('Unable to capture browser proof from Lightpanda, HTTP fetch, or Firecrawl.');
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
        const usedLightpanda = Boolean(lightpandaCapture?.html);
        const usedHttp = Boolean(httpCapture.html);
        const usedMarkdown = Boolean(markdown);

        const proofPayload = {
            url: input.url,
            sector: input.sector || null,
            observedAt: new Date().toISOString(),
            executionMode: buildExecutionMode({ usedLightpanda, usedHttp, usedMarkdown }),
            engine: usedLightpanda ? 'lightpanda' as const : 'http-fallback' as const,
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
            adapterNotes: lightpandaCapture?.notes || [],
        };

        const proofHash = hashValue(JSON.stringify(proofPayload));
        const proofSignature = signProof(proofHash);

        return {
            ...proofPayload,
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
