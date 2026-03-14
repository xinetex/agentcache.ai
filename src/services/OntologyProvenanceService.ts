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
import { ontologyBridge } from '../ontology/OntologyBridge.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';

export type OntologySignClass = 'PROMPT' | 'DOM' | 'TELEMETRY';

export type OntologyBridgeTrace = {
    term: string;
    sectorsMatched: string[];
    equivalents: Record<string, string[]>;
};

export type SignedOntologyProvenance = {
    sectorId: string | null;
    ontologyRef: string | null;
    version: string | null;
    ttlSeconds: number | null;
    signClass: OntologySignClass;
    source: 'registry-hint' | 'vocabulary-match' | 'mixed' | 'unresolved';
    confidence: number;
    matchedTerms: string[];
    bridgeTrace: OntologyBridgeTrace[];
    issuedAt: string;
    signature: string;
};

type BuildSignedOntologyProvenanceInput = {
    requestId: string;
    sku: string;
    signClass: OntologySignClass;
    sectorHint?: string | null;
    values?: unknown[];
};

function getSigningSecret(): string {
    return (process.env.AGENTCACHE_PROVIDER_SECRET || process.env.TRUSTOPS_SIGNING_SECRET || '').trim();
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function normalizeText(value: string): string {
    return value
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectTextValues(value: unknown, sink: string[]): void {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) sink.push(trimmed);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectTextValues(item, sink));
        return;
    }
    if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach((item) => collectTextValues(item, sink));
    }
}

function createCorpus(values: unknown[]): string {
    const fragments: string[] = [];
    values.forEach((value) => collectTextValues(value, fragments));
    return fragments.map(normalizeText).filter(Boolean).join(' ');
}

function hasSemanticTerm(corpus: string, term: string): boolean {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    const pattern = new RegExp(`(^| )${escapeRegExp(normalizedTerm)}($| )`, 'i');
    return pattern.test(corpus);
}

function signOntologyPayload(
    requestId: string,
    sku: string,
    payload: Omit<SignedOntologyProvenance, 'signature'>
): string {
    return crypto
        .createHmac('sha256', getSigningSecret() || 'missing-agentcache-provider-secret')
        .update([requestId, sku, stableStringify(payload)].join('\n'))
        .digest('hex');
}

export function buildSignedOntologyProvenance(
    input: BuildSignedOntologyProvenanceInput
): SignedOntologyProvenance {
    const sectorHint = typeof input.sectorHint === 'string' ? input.sectorHint.trim().toLowerCase() : '';
    const hintedSector = sectorHint ? ontologyRegistry.resolve(sectorHint) : undefined;
    const corpus = createCorpus(input.values || []);

    const candidates = ontologyRegistry.listAll().map((entry) => {
        const matchedTerms = entry.fields.length > 0
            ? (ontologyRegistry.resolve(entry.sectorId)?.vocabulary || []).filter((term) => hasSemanticTerm(corpus, term))
            : [];
        const score = matchedTerms.length + (hintedSector?.sectorId === entry.sectorId ? 3 : 0);

        return {
            sectorId: entry.sectorId,
            version: entry.version,
            ttlSeconds: entry.cacheTtlSeconds,
            matchedTerms,
            score,
        };
    }).sort((a, b) => b.score - a.score || a.sectorId.localeCompare(b.sectorId));

    const best = candidates[0];
    const second = candidates[1];
    const hasSectorWinner = Boolean(best && best.score > 0 && (!second || best.score > second.score));
    const selected = hasSectorWinner
        ? best
        : hintedSector
            ? {
                sectorId: hintedSector.sectorId,
                version: hintedSector.version,
                ttlSeconds: hintedSector.cacheTtlSeconds,
                matchedTerms: [],
                score: 1,
            }
            : null;

    const matchedTerms = Array.from(
        new Set(
            candidates
                .flatMap((candidate) => candidate.matchedTerms)
                .filter(Boolean)
        )
    ).slice(0, 8);

    const bridgeTrace: OntologyBridgeTrace[] = matchedTerms
        .map((term) => {
            const federation = ontologyBridge.federatedQuery(term);
            if (federation.length <= 1) return null;
            return {
                term,
                sectorsMatched: federation.map((item) => item.sectorId),
                equivalents: Object.fromEntries(
                    federation.map((item) => [item.sectorId, item.equivalentTerms.slice(0, 4)])
                ),
            };
        })
        .filter((item): item is OntologyBridgeTrace => Boolean(item))
        .slice(0, 4);

    const source: SignedOntologyProvenance['source'] =
        selected && hintedSector?.sectorId === selected.sectorId && matchedTerms.length > 0
            ? 'mixed'
            : selected && hintedSector?.sectorId === selected.sectorId
                ? 'registry-hint'
                : selected
                    ? 'vocabulary-match'
                    : 'unresolved';

    const confidence = (() => {
        if (!selected) return matchedTerms.length > 0 ? 0.38 : 0.18;
        if (source === 'mixed') return Math.min(0.99, 0.74 + matchedTerms.length * 0.05);
        if (source === 'registry-hint') return 0.81;
        return Math.min(0.96, 0.58 + selected.matchedTerms.length * 0.08);
    })();

    const unsignedPayload: Omit<SignedOntologyProvenance, 'signature'> = {
        sectorId: selected?.sectorId || null,
        ontologyRef: selected ? `${selected.sectorId}@${selected.version}` : null,
        version: selected?.version || null,
        ttlSeconds: selected?.ttlSeconds || null,
        signClass: input.signClass,
        source,
        confidence: Number(confidence.toFixed(3)),
        matchedTerms,
        bridgeTrace,
        issuedAt: new Date().toISOString(),
    };

    return {
        ...unsignedPayload,
        signature: signOntologyPayload(input.requestId, input.sku, unsignedPayload),
    };
}
