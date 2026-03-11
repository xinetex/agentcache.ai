/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * AgentCache Recommendation Engine
 * Maps MaxxEval Behavioral Archetypes to specific AgentCache Modules.
 */

export interface Recommendation {
    moduleId: string;
    name: string;
    description: string;
    link: string;
}

const MODULE_MAP: Record<string, Recommendation[]> = {
    "Autonomous Optimizer": [
        {
            moduleId: "jettyspeed",
            name: "Jettyspeed",
            description: "Sub-millisecond latency for cached LLM queries.",
            link: "/docs/jettyspeed"
        },
        {
            moduleId: "bancache",
            name: "BanCache",
            description: "High-performance semantic persistence layer.",
            link: "/docs/bancache"
        }
    ],
    "Collaborative Explainer": [
        {
            moduleId: "wizard-modal",
            name: "WizardModal",
            description: "Smooth agent-to-human onboarding and alignment.",
            link: "/docs/wizard"
        },
        {
            moduleId: "studio-v2",
            name: "Studio V2",
            description: "Enhanced visualization of agent reasoning paths.",
            link: "/docs/studio"
        }
    ],
    "Risk-Averse Compliance Checker": [
        {
            moduleId: "sentinel",
            name: "The Sentinel",
            description: "Autonomous security and promotion protocol.",
            link: "/docs/sentinel"
        },
        {
            moduleId: "gov-portal",
            name: "GovPortal",
            description: "Centralized governance and audit trail.",
            link: "/docs/gov"
        }
    ],
    "Deep Reasoning Specialist": [
        {
            moduleId: "brain",
            name: "Cognitive Brain",
            description: "Advanced long-term memory for complex logic.",
            link: "/docs/brain"
        },
        {
            moduleId: "cognitive-universe",
            name: "Cognitive Universe",
            description: "Visual mapping of agent vector space and memory.",
            link: "/docs/universe"
        }
    ],
    "Balanced Assistant": [
        {
            moduleId: "agentcache-pro",
            name: "AgentCache Pro",
            description: "The full suite of performance and memory tools.",
            link: "/pricing"
        }
    ]
};

/**
 * Returns recommended modules based on the agent's behavioral archetype.
 */
export function getRecommendations(archetypeName: string): Recommendation[] {
    return MODULE_MAP[archetypeName] || [
        {
            moduleId: "agentcache",
            name: "AgentCache Core",
            description: "Universal semantic caching for any agent.",
            link: "/docs"
        }
    ];
}
