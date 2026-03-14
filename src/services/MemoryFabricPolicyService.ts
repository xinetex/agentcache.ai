/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import {
  type FabricSkuDef,
  type FabricSkuId,
  getDefaultFabricSkuForSector,
  getFabricSkuById,
  listFabricSkus,
} from '../config/fabricSkus.js';
import { getTierFeatures } from '../config/tiers.js';
import { ontologyRegistry } from '../ontology/OntologyRegistry.js';

export type MemoryFabricStorageTier = 'hot' | 'warm' | 'cold';

export interface MemoryFabricPolicy {
  verticalSku: FabricSkuId;
  sectorId: string;
  ontologyRef: string | null;
  tierId: string | null;
  eligible: boolean;
  recommendedTier: string;
  workloadProfile: FabricSkuDef['workloadProfile'];
  ttlClamped: boolean;
  effectiveTtlSeconds: number;
  storageTier: MemoryFabricStorageTier;
  namespaceMode: 'shared' | 'private';
  namespaceTemplate: string;
  complianceTags: string[];
  evidenceMode: 'standard' | 'audit' | 'clinical';
  semanticReuse: boolean;
  estimatedCredits: {
    read: number;
    write: number;
    semanticBonus: number;
  };
  notes: string[];
}

type ResolveMemoryFabricPolicyInput = {
  sector?: string | null;
  verticalSku?: string | null;
  requestedTtlSeconds?: number | null;
  tierId?: string | null;
};

function clampPositiveInt(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  if (!value || value <= 0) return null;
  return Math.floor(value);
}

function compareTierRank(a: string, b: string): number {
  const order = ['free', 'pro', 'enterprise'];
  return order.indexOf(a) - order.indexOf(b);
}

function resolveStorageTier(ttlSeconds: number): MemoryFabricStorageTier {
  if (ttlSeconds <= 900) return 'hot';
  if (ttlSeconds <= 86400) return 'warm';
  return 'cold';
}

function resolveEvidenceMode(sectorId: string, sku: FabricSkuDef): MemoryFabricPolicy['evidenceMode'] {
  if (sectorId === 'healthcare' || sectorId === 'biotech') return 'clinical';
  if (sectorId === 'finance' || sku.id === 'finance-memory-fabric') return 'audit';
  return 'standard';
}

export class MemoryFabricPolicyService {
  listSkus(): FabricSkuDef[] {
    return listFabricSkus();
  }

  resolve(input: ResolveMemoryFabricPolicyInput): MemoryFabricPolicy {
    const normalizedSector = (input.sector || '').trim().toLowerCase();
    const sku = getFabricSkuById(input.verticalSku) || getDefaultFabricSkuForSector(normalizedSector);
    const sector = ontologyRegistry.resolve(normalizedSector) || ontologyRegistry.resolve(sku.sectors[0]);
    const sectorId = sector?.sectorId || normalizedSector || sku.sectors[0] || 'general';
    const tierId = (input.tierId || '').trim().toLowerCase() || null;
    const requestedTtlSeconds = clampPositiveInt(input.requestedTtlSeconds);
    const tierFeatures = tierId ? getTierFeatures(tierId) : null;
    const tierCapSeconds =
      tierFeatures?.ttlMax === -1
        ? Number.POSITIVE_INFINITY
        : tierFeatures?.ttlMax
          ? Math.max(1, Math.floor(tierFeatures.ttlMax / 1000))
          : Number.POSITIVE_INFINITY;
    const ontologyTtlSeconds = sector?.cacheTtlSeconds || sku.defaultTtlSeconds;
    const effectiveTtlSeconds = Math.max(
      60,
      Math.min(requestedTtlSeconds || ontologyTtlSeconds, ontologyTtlSeconds, tierCapSeconds)
    );
    const namespaceMode: MemoryFabricPolicy['namespaceMode'] =
      tierFeatures?.privateNamespace ? 'private' : 'shared';
    const evidenceMode = resolveEvidenceMode(sectorId, sku);
    const notes: string[] = [];
    const ttlClamped = Boolean(requestedTtlSeconds && requestedTtlSeconds > effectiveTtlSeconds);

    if (ttlClamped) {
      notes.push('Requested TTL was reduced to stay within ontology freshness and plan limits.');
    }

    if (sector && sector.cacheTtlSeconds === effectiveTtlSeconds) {
      notes.push(`Sector ontology freshness guardrail applied from ${sector.sectorId}@${sector.version}.`);
    }

    if (namespaceMode === 'shared') {
      notes.push('Private namespace is unavailable on the current tier; community/shared namespace routing is recommended.');
    }

    const eligible = !tierId || compareTierRank(tierId, sku.minTier) >= 0;

    if (!eligible) {
      notes.push(`This SKU is optimized for ${sku.minTier} tier and above.`);
    }

    return {
      verticalSku: sku.id,
      sectorId,
      ontologyRef: sector ? `${sector.sectorId}@${sector.version}` : null,
      tierId,
      eligible,
      recommendedTier: sku.minTier,
      workloadProfile: sku.workloadProfile,
      ttlClamped,
      effectiveTtlSeconds,
      storageTier: resolveStorageTier(effectiveTtlSeconds),
      namespaceMode,
      namespaceTemplate:
        namespaceMode === 'private'
          ? `fabric:${sku.id}:${sectorId}:{workspace}`
          : `community:${sku.id}:${sectorId}`,
      complianceTags: [...new Set([...(sku.complianceTags || []), ...(sectorId ? [sectorId] : [])])],
      evidenceMode,
      semanticReuse: sku.workloadProfile !== 'transactional' || sectorId === 'finance',
      estimatedCredits: {
        read: evidenceMode === 'audit' ? 0.2 : evidenceMode === 'clinical' ? 0.3 : 0.1,
        write: evidenceMode === 'audit' ? 0.4 : evidenceMode === 'clinical' ? 0.5 : 0.2,
        semanticBonus: sku.workloadProfile === 'copilot' ? 0.5 : 0.2,
      },
      notes,
    };
  }
}

export const memoryFabricPolicyService = new MemoryFabricPolicyService();
