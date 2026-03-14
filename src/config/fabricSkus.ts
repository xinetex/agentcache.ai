/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

export type FabricSkuId =
  | 'enterprise-copilot'
  | 'finance-memory-fabric'
  | 'healthcare-memory-fabric';

export interface FabricSkuDef {
  id: FabricSkuId;
  name: string;
  launchStage: 'ga' | 'beta';
  minTier: 'free' | 'pro' | 'enterprise';
  sectors: string[];
  workloadProfile: 'copilot' | 'transactional' | 'clinical';
  defaultTtlSeconds: number;
  description: string;
  northbound: string[];
  southbound: string[];
  complianceTags: string[];
}

export const FABRIC_SKUS: Record<FabricSkuId, FabricSkuDef> = {
  'enterprise-copilot': {
    id: 'enterprise-copilot',
    name: 'Enterprise Copilot Fabric',
    launchStage: 'ga',
    minTier: 'pro',
    sectors: ['general', 'legal', 'saas', 'energy'],
    workloadProfile: 'copilot',
    defaultTtlSeconds: 3600,
    description:
      'Shared semantic cache and memory fabric for enterprise copilots, workspace agents, and retrieval-heavy assistant workloads.',
    northbound: ['function-calling', 'tool APIs', 'vector retrieval', 'chat completions'],
    southbound: ['redis', 'object storage', 'vector store', 'browser proof'],
    complianceTags: ['workspace_isolation', 'traceability'],
  },
  'finance-memory-fabric': {
    id: 'finance-memory-fabric',
    name: 'Finance Memory Fabric',
    launchStage: 'ga',
    minTier: 'pro',
    sectors: ['finance', 'energy'],
    workloadProfile: 'transactional',
    defaultTtlSeconds: 300,
    description:
      'Low-latency cache and evidence fabric for quant research, risk, KYC, and transaction validation workloads.',
    northbound: ['agent tools', 'trade/risk services', 'retrieval APIs'],
    southbound: ['redis', 'object storage', 'databases', 'browser proof'],
    complianceTags: ['pci_dss', 'sox', 'audit_receipt'],
  },
  'healthcare-memory-fabric': {
    id: 'healthcare-memory-fabric',
    name: 'Healthcare Memory Fabric',
    launchStage: 'beta',
    minTier: 'enterprise',
    sectors: ['healthcare', 'biotech'],
    workloadProfile: 'clinical',
    defaultTtlSeconds: 86400,
    description:
      'PHI-aware memory routing and audited retrieval for clinical copilots, omics analysis, and healthcare knowledge workflows.',
    northbound: ['clinical copilots', 'retrieval APIs', 'workflow tools'],
    southbound: ['redis', 'object storage', 'vector store', 'document stores'],
    complianceTags: ['hipaa', 'phi_boundary', 'audit_receipt'],
  },
};

export function listFabricSkus(): FabricSkuDef[] {
  return Object.values(FABRIC_SKUS);
}

export function getFabricSkuById(id?: string | null): FabricSkuDef | null {
  if (!id) return null;
  return FABRIC_SKUS[id as FabricSkuId] || null;
}

export function getDefaultFabricSkuForSector(sectorId?: string | null): FabricSkuDef {
  const normalized = (sectorId || '').trim().toLowerCase();
  if (normalized === 'finance' || normalized === 'energy') {
    return FABRIC_SKUS['finance-memory-fabric'];
  }
  if (normalized === 'healthcare' || normalized === 'biotech') {
    return FABRIC_SKUS['healthcare-memory-fabric'];
  }
  return FABRIC_SKUS['enterprise-copilot'];
}
