/**
 * Agentic Unit Schema
 * 
 * Defines the structure for deployable agent workflows.
 * Each "Agentic Unit" is a focused microservice with clear boundaries.
 */

export interface AgenticUnit {
    // Metadata
    id: string;
    name: string;
    description: string;
    version: string;
    vertical: 'software' | 'finance' | 'logistics' | 'custom';
    icon: string; // Emoji or icon name

    // Role Definition
    role: {
        persona: string;           // e.g., "Senior Code Auditor"
        capabilities: string[];    // What it can do
        limitations: string[];     // What it cannot do
        tone: 'formal' | 'casual' | 'technical';
    };

    // Tools (Connectors)
    tools: {
        required: ToolConfig[];    // Must be configured
        optional: ToolConfig[];    // Nice to have
    };

    // Memory Configuration
    memory: {
        shortTerm: {
            enabled: boolean;
            ttlMinutes: number;
        };
        longTerm: {
            enabled: boolean;
            vectorStore?: 'pinecone' | 'supabase' | 'none';
        };
    };

    // Autonomy Policy
    policy: {
        maxActionsPerRun: number;
        requiresApproval: string[];      // Actions that need human approval
        autoApprove: string[];           // Actions that can run autonomously
        escalationChannel?: string;       // Where to escalate (Slack channel, email)
        budgetLimitUSD?: number;         // Max spend per run
    };

    // Triggers
    triggers: TriggerConfig[];

    // Output Actions
    actions: ActionConfig[];
}

export interface ToolConfig {
    id: string;
    name: string;
    type: 'github' | 'slack' | 'sentry' | 'stripe' | 'database' | 'llm' | 'custom';
    description: string;
    requiredEnvVars: string[];
    optional?: boolean;
}

export interface TriggerConfig {
    id: string;
    type: 'webhook' | 'cron' | 'manual' | 'event';
    description: string;
    config: Record<string, any>;
}

export interface ActionConfig {
    id: string;
    type: 'comment' | 'label' | 'notify' | 'create_ticket' | 'api_call' | 'custom';
    description: string;
    config: Record<string, any>;
}

// ============================================
// Pre-built Templates
// ============================================

export const TEMPLATES: Record<string, AgenticUnit> = {
    'code-auditor': {
        id: 'code-auditor',
        name: 'Code Auditor',
        description: 'Automatically reviews PRs for security issues, bugs, and best practices.',
        version: '1.0.0',
        vertical: 'software',
        icon: '🔍',
        role: {
            persona: 'Senior Security Engineer',
            capabilities: [
                'Analyze code diffs for vulnerabilities',
                'Identify potential bugs and edge cases',
                'Suggest improvements',
                'Label PRs by risk level'
            ],
            limitations: [
                'Cannot merge PRs',
                'Cannot access production systems',
                'Cannot modify code directly'
            ],
            tone: 'technical'
        },
        tools: {
            required: [
                {
                    id: 'github',
                    name: 'GitHub',
                    type: 'github',
                    description: 'Access to repository for reading PRs and posting comments',
                    requiredEnvVars: ['GITHUB_TOKEN']
                },
                {
                    id: 'llm',
                    name: 'AI Model',
                    type: 'llm',
                    description: 'LLM for intelligent code analysis',
                    requiredEnvVars: ['AI_GATEWAY_API_KEY']
                }
            ],
            optional: [
                {
                    id: 'slack',
                    name: 'Slack',
                    type: 'slack',
                    description: 'Post high-risk alerts to team channel',
                    requiredEnvVars: ['SLACK_BOT_TOKEN'],
                    optional: true
                }
            ]
        },
        memory: {
            shortTerm: { enabled: true, ttlMinutes: 60 },
            longTerm: { enabled: false }
        },
        policy: {
            maxActionsPerRun: 10,
            requiresApproval: [],
            autoApprove: ['comment', 'label'],
            escalationChannel: '#eng-alerts'
        },
        triggers: [
            {
                id: 'pr-opened',
                type: 'webhook',
                description: 'Triggered when a PR is opened or updated',
                config: { events: ['pull_request.opened', 'pull_request.synchronize'] }
            }
        ],
        actions: [
            {
                id: 'post-review',
                type: 'comment',
                description: 'Post review findings as PR comment',
                config: { template: 'code-review' }
            },
            {
                id: 'label-risk',
                type: 'label',
                description: 'Add risk label to PR',
                config: { labels: ['low-risk', 'medium-risk', 'high-risk'] }
            }
        ]
    },

    'incident-commander': {
        id: 'incident-commander',
        name: 'Incident Commander',
        description: 'Triages production alerts, correlates incidents, and notifies the team.',
        version: '1.0.0',
        vertical: 'software',
        icon: '🚨',
        role: {
            persona: 'SRE On-Call Assistant',
            capabilities: [
                'Ingest alerts from Sentry/Datadog',
                'Correlate related incidents',
                'Identify root cause',
                'Draft remediation steps'
            ],
            limitations: [
                'Cannot restart services',
                'Cannot modify infrastructure',
                'Cannot acknowledge alerts in source system'
            ],
            tone: 'formal'
        },
        tools: {
            required: [
                {
                    id: 'sentry',
                    name: 'Sentry',
                    type: 'sentry',
                    description: 'Receive error alerts',
                    requiredEnvVars: ['SENTRY_WEBHOOK_SECRET']
                },
                {
                    id: 'slack',
                    name: 'Slack',
                    type: 'slack',
                    description: 'Post incident summaries',
                    requiredEnvVars: ['SLACK_BOT_TOKEN']
                }
            ],
            optional: [
                {
                    id: 'github',
                    name: 'GitHub',
                    type: 'github',
                    description: 'Fetch recent deploys for correlation',
                    requiredEnvVars: ['GITHUB_TOKEN'],
                    optional: true
                }
            ]
        },
        memory: {
            shortTerm: { enabled: true, ttlMinutes: 30 },
            longTerm: { enabled: true, vectorStore: 'supabase' }
        },
        policy: {
            maxActionsPerRun: 5,
            requiresApproval: ['create_ticket'],
            autoApprove: ['notify'],
            escalationChannel: '#incidents'
        },
        triggers: [
            {
                id: 'sentry-alert',
                type: 'webhook',
                description: 'Triggered when Sentry creates a new issue',
                config: { events: ['issue.created'] }
            }
        ],
        actions: [
            {
                id: 'slack-summary',
                type: 'notify',
                description: 'Post incident summary to Slack',
                config: { channel: '#incidents' }
            }
        ]
    },

    'risk-sentinel': {
        id: 'risk-sentinel',
        name: 'Risk Sentinel',
        description: 'Monitors financial transactions for anomalies and compliance violations.',
        version: '1.0.0',
        vertical: 'finance',
        icon: '💰',
        role: {
            persona: 'Compliance Analyst',
            capabilities: [
                'Monitor transaction streams',
                'Detect anomalous patterns',
                'Flag potential fraud',
                'Generate compliance reports'
            ],
            limitations: [
                'Cannot freeze accounts',
                'Cannot reverse transactions',
                'Cannot access PII directly'
            ],
            tone: 'formal'
        },
        tools: {
            required: [
                {
                    id: 'stripe',
                    name: 'Stripe',
                    type: 'stripe',
                    description: 'Access transaction data',
                    requiredEnvVars: ['STRIPE_SECRET_KEY']
                },
                {
                    id: 'llm',
                    name: 'AI Model',
                    type: 'llm',
                    description: 'Pattern analysis',
                    requiredEnvVars: ['AI_GATEWAY_API_KEY']
                }
            ],
            optional: [
                {
                    id: 'slack',
                    name: 'Slack',
                    type: 'slack',
                    description: 'Alert on anomalies',
                    requiredEnvVars: ['SLACK_BOT_TOKEN'],
                    optional: true
                }
            ]
        },
        memory: {
            shortTerm: { enabled: true, ttlMinutes: 120 },
            longTerm: { enabled: true, vectorStore: 'pinecone' }
        },
        policy: {
            maxActionsPerRun: 20,
            requiresApproval: ['freeze_transaction'],
            autoApprove: ['notify', 'log'],
            budgetLimitUSD: 0
        },
        triggers: [
            {
                id: 'transaction-webhook',
                type: 'webhook',
                description: 'Triggered on new transactions',
                config: { events: ['charge.succeeded', 'charge.failed'] }
            },
            {
                id: 'daily-audit',
                type: 'cron',
                description: 'Daily compliance check',
                config: { schedule: '0 9 * * *' }
            }
        ],
        actions: [
            {
                id: 'flag-anomaly',
                type: 'notify',
                description: 'Alert on suspicious activity',
                config: { channel: '#finance-alerts' }
            }
        ]
    }
};

/**
 * Get all available templates
 */
export function getTemplates(): AgenticUnit[] {
    return Object.values(TEMPLATES);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AgenticUnit | undefined {
    return TEMPLATES[id];
}

/**
 * Validate that required env vars are present for a template
 */
export function validateTemplateConfig(template: AgenticUnit): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const tool of template.tools.required) {
        for (const envVar of tool.requiredEnvVars) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }
    }

    return { valid: missing.length === 0, missing };
}
