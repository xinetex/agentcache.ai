/**
 * Specialist Sub-Agent Manifest
 * 
 * Maps BuildoutLanes to specific agent profiles and instruction sets.
 */

import { type BuildoutLane } from './buildoutPlan.js';

export interface AgentProfile {
    role: string;
    description: string;
    instructions: string[];
    capabilities: string[];
}

export const AGENT_MANIFEST: Record<BuildoutLane, AgentProfile> = {
    'architecture': {
        role: 'Architect Agent',
        description: 'Handles high-level system design, schema definitions, and cross-repo contracts.',
        instructions: [
            'Ensure all changes follow the shared receipt contract.',
            'Prioritize modularity and service boundaries.',
            'Update buildoutPlan.ts when architectural milestones are reached.'
        ],
        capabilities: ['diagramming', 'schema-design', 'repo-mapping']
    },
    'software-quality': {
        role: 'QA/Verification Agent',
        description: 'Focuses on testing, contract validation, and health gates.',
        instructions: [
            'Every new feature must have a corresponding Vitest suite.',
            'Verify failure modes and fallback paths for all browser and storage adapters.',
            'Maintain the 100% pass rate for verification scripts.'
        ],
        capabilities: ['vitest', 'contract-testing', 'load-testing']
    },
    'storage-mesh': {
        role: 'Storage Specialist',
        description: 'Manages Lyve S3, transfer receipts, and cache-warming logic.',
        instructions: [
            'Optimize for multi-part transfer stability.',
            'Ensure region-endpoint alignment in all configs.',
            'Validate storage receipts against real head/get operations.'
        ],
        capabilities: ['s3-ops', 'transfer-optimization', 'cache-policy']
    },
    'trust-evidence': {
        role: 'Trust/Proof Specialist',
        description: 'Handles BrowserProofService, Soulprint, and receipt ingestion.',
        instructions: [
            'Maximize evidence density for all receipts.',
            'Implement multi-tier fallback for browser proofs.',
            'Verify signature integrity on every ingest.'
        ],
        capabilities: ['browser-automation', 'cryptography', 'soulprint-analysis']
    },
    'market-systems': {
        role: 'Marketplace/Bot Specialist',
        description: 'Manages bot preregistration, discovery, and frontend trust surfaces.',
        instructions: [
            'Sync Soulprint data to buyer-facing views.',
            'Ensure preregistration follows the Moltbook ownership flow.',
            'Optimize receipt filtering for buyer-facing selectors.'
        ],
        capabilities: ['react-ui', 'api-integration', 'bot-identity']
    },
    'revenue-ops': {
        role: 'Billing/ROI Specialist',
        description: 'Analyzes savings, metabolic pricing, and SKU performance.',
        instructions: [
            'Maintain the ROI ledger with hard evidence.',
            'Implement metabolic pricing based on actual latencies.',
            'Reconcile invoices against signed receipts.'
        ],
        capabilities: ['analytics', 'pricing-models', 'billing-integration']
    },
    'design-partners': {
        role: 'Partner Ops Agent',
        description: 'Handles onboarding, case studies, and partner-specific evidence exports.',
        instructions: [
            'Automate the onboarding task list for new design partners.',
            'Generate exportable evidence bundles for ROI reviews.',
            'Coordinate internal proving loops across repos.'
        ],
        capabilities: ['documentation', 'partner-relations', 'reporting']
    }
};
