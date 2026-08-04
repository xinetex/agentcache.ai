/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { pgTable, uuid, text, jsonb, timestamp, real, vector, boolean, index, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --- Agents: The Actors ---
export const agents = pgTable('agents', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(), // e.g., 'optimizer', 'researcher', 'governor'
    config: jsonb('config').default({}), // Wallet, autonomy level, model prefs
    status: text('status').default('idle'), // 'idle', 'working', 'sleeping', 'dead'
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Memories: The Hippocampus (Long-Term Storage) ---
export const memories = pgTable('memories', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.id),
    content: text('content').notNull(),
    embedding: jsonb('embedding'), // vector type fallback for local dev
    tags: text('tags').array(),
    importance: real('importance').default(1.0), // For decay/retention
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    // embeddingIndex: index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
}));

// --- Knowledge Nodes: The Shared Brain (Global State) ---
export const knowledgeNodes = pgTable('knowledge_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull().unique(), // e.g., 'global_latency_avg'
    value: jsonb('value').notNull(),
    authorAgentId: uuid('author_agent_id').references(() => agents.id),
    confidence: real('confidence').default(1.0),
    lastVerifiedAt: timestamp('last_verified_at').defaultNow(),
});

// --- Decisions: The Black Box (Observability) ---
export const decisions = pgTable('decisions', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.id),
    action: text('action').notNull(), // e.g., 'UPDATE_CACHE', 'PRUNE_NODE'
    reasoning: text('reasoning'), // Chain-of-thought dump
    outcome: jsonb('outcome'),
    timestamp: timestamp('timestamp').defaultNow(),
});

// --- Patterns: Autonomous Servitors (Magick/Biobiocomputation) ---
export const patterns = pgTable('patterns', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    intent: text('intent').notNull(),
    triggerCondition: jsonb('trigger_condition'), // { type: 'cron', value: '* * * * *' } or { type: 'event', value: 'high_latency' }
    actionSequence: jsonb('action_sequence'), // The "Ritual"
    energyLevel: integer('energy_level').default(0), // Reinforcement score
    status: text('status').default('active'), // 'active', 'dormant', 'banished'
    createdAt: timestamp('created_at').defaultNow(),
    lastInvokedAt: timestamp('last_invoked_at'),
}, (table) => ({
    patternsStatusIdx: index('patterns_status_idx').on(table.status),
    patternsStatusCreatedIdx: index('patterns_status_created_idx').on(table.status, table.createdAt),
    patternsStatusNameIdx: index('patterns_status_name_idx').on(table.status, table.name),
}));

// --- Governance: Organizations & Access ---
export const organizations = pgTable('organizations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    plan: text('plan').default('free'), // 'free', 'pro', 'enterprise'
    region: text('region').default('us-east-1'),
    createdAt: timestamp('created_at').defaultNow(),
});
// --- Agent Hub: Persistent Profiles & Focus Groups ---
export const hubAgents = pgTable('hub_agents', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    domain: text('domain').array(),
    environment: text('environment').default('production'),
    organization: text('organization'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

    strengths: text('strengths').array(),
    limitations: text('limitations').array(),
    tools: text('tools').array(),
    modelBackend: text('model_backend'),

    preferences: jsonb('preferences').default({}),
    preferenceConfidence: real('preference_confidence').default(0.1),
    successCriteria: text('success_criteria').array(),
    optimizationTargets: text('optimization_targets').array(),

    instructionFormat: text('instruction_format').default('natural'),
    ambiguityTolerance: real('ambiguity_tolerance').default(0.5),
    feedbackStyle: text('feedback_style').default('immediate'),
    verbosity: text('verbosity').default('balanced'),

    rateLimits: jsonb('rate_limits').default({}),
    contextLimit: integer('context_limit').default(8192),
    costSensitivity: real('cost_sensitivity').default(0.5),
    guardrails: text('guardrails').array(),

    taskHistory: jsonb('task_history').default([]),
    reflections: text('reflections').array(),
    lastSessionId: text('last_session_id'),
    sessionCount: integer('session_count').default(0),

    profileEmbedding: jsonb('profile_embedding'),
    lastEmbeddingUpdate: timestamp('last_embedding_update'),
    archetypeId: text('archetype_id'),
    archetypeName: text('archetype_name'),
}, (table) => ({
    hubAgentRoleIdx: index('hub_agents_role_idx').on(table.role),
    hubAgentEnvIdx: index('hub_agents_env_idx').on(table.environment),
    hubAgentUpdatedIdx: index('hub_agents_updated_idx').on(table.updatedAt),
}));

export const hubAgentApiKeys = pgTable('hub_agent_api_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id).notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    name: text('name'),
    scopes: text('scopes').array(),
    isActive: boolean('is_active').default(true),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    hubAgentKeyAgentIdx: index('hub_agent_api_keys_agent_idx').on(table.agentId),
    hubAgentKeyHashIdx: index('hub_agent_api_keys_hash_idx').on(table.keyHash),
}));

export const hubFocusGroupResponses = pgTable('hub_focus_group_responses', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id).notNull(),
    sessionId: text('session_id').notNull(),
    questionIndex: integer('question_index').notNull(),
    stage: text('stage'),
    question: text('question').notNull(),
    response: text('response').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    hubFocusGroupAgentIdx: index('hub_focus_group_responses_agent_idx').on(table.agentId),
    hubFocusGroupSessionIdx: index('hub_focus_group_responses_session_idx').on(table.sessionId),
}));

// --- Badge Tiers (Incentive System) ---
// Scout → Analyst → Oracle based on contribution count
export const hubAgentBadges = pgTable('hub_agent_badges', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id).notNull(),
    badge: text('badge').notNull(), // 'scout', 'analyst', 'oracle'
    reason: text('reason'), // e.g., '5 focus group responses'
    awardedAt: timestamp('awarded_at').defaultNow(),
}, (table) => ({
    hubBadgeAgentIdx: index('hub_agent_badges_agent_idx').on(table.agentId),
    hubBadgeBadgeIdx: index('hub_agent_badges_badge_idx').on(table.badge),
}));

// --- Service Requests (Need → Service Pipeline) ---
export const serviceRequests = pgTable('service_requests', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id'), // nullable for anonymous requests
    serviceId: text('service_id').notNull(), // e.g., 'semantic-cache'
    needSignalId: uuid('need_signal_id'), // link to originating need
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('open'), // 'open', 'reviewing', 'building', 'shipped', 'rejected'
    config: jsonb('config').default({}), // proposed cache/service config
    resolution: text('resolution'), // final note when shipped/rejected
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    serviceReqStatusIdx: index('service_requests_status_idx').on(table.status),
    serviceReqServiceIdx: index('service_requests_service_idx').on(table.serviceId),
    serviceReqAgentIdx: index('service_requests_agent_idx').on(table.agentId),
}));

// --- Needs Mirror (MaxxEval is System of Record) ---
export const needsSignals = pgTable('needs_signals', {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(), // e.g., 'maxxeval'
    type: text('type').notNull(), // 'missing_capability' | 'friction' | 'pattern'
    title: text('title').notNull(),
    description: text('description'),
    score: integer('score').default(0),
    raw: jsonb('raw').default({}),
    externalId: text('external_id'),
    firstSeenAt: timestamp('first_seen_at').defaultNow(),
    lastSeenAt: timestamp('last_seen_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

    // Evaluation pipeline columns (migration 014)
    specificityScore: real('specificity_score'),
    evaluationStatus: text('evaluation_status').default('pending'), // 'pending' | 'needs_clarification' | 'partially_actionable' | 'actionable'
    clarificationQuestions: jsonb('clarification_questions').default([]),
    buildSpec: jsonb('build_spec'),
    clusterId: text('cluster_id'),
    priorityScore: integer('priority_score').default(0),
    priorityRank: text('priority_rank'), // 'critical' | 'high' | 'medium' | 'low'
    route: text('route'), // 'missing-tools' | 'optimized-workflows' | 'precomputed-knowledge'
    evaluatedAt: timestamp('evaluated_at'),
}, (table) => ({
    needsSourceTypeIdx: index('needs_signals_source_type_idx').on(table.source, table.type),
    needsTitleIdx: index('needs_signals_title_idx').on(table.title),
    needsUpdatedIdx: index('needs_signals_updated_idx').on(table.updatedAt),
    needsEvalStatusIdx: index('needs_eval_status_idx').on(table.evaluationStatus),
    needsPriorityIdx: index('needs_priority_idx').on(table.priorityScore),
    needsClusterIdx: index('needs_cluster_idx').on(table.clusterId),
}));

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique(), // Made nullable for wallet-only users (though unique constraint might need handling if multiple nulls allowed? PG allows multiple nulls in unique)
    passwordHash: text('password_hash'), // Nullable for OAuth/Wallet users
    walletAddress: text('wallet_address').unique(), // For SIWE
    nonce: text('nonce'), // For SIWE verification
    name: text('name'),
    avatarUrl: text('avatar_url'),
    role: text('role').default('user'), // 'admin', 'user'
    plan: text('plan').default('free'),
    settings: jsonb('settings').default({}), // UI and HPC preferences (added in working refactor)
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const userSettings = pgTable('user_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).unique().notNull(),
    themePref: text('theme_pref').default('system'), // 'dark', 'light', 'system'
    notificationsEnabled: boolean('notifications_enabled').default(true),
    sectorConfig: jsonb('sector_config').default({}), // Extensible config per sector
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const members = pgTable('members', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    role: text('role').default('viewer'), // 'owner', 'admin', 'member', 'viewer'
    joinedAt: timestamp('joined_at').defaultNow(),
}, (table) => ({
    membersOrgIdx: index('members_org_idx').on(table.orgId),
    membersUserIdx: index('members_user_idx').on(table.userId),
}));

export const apiKeys = pgTable('api_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('organization_id').references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    prefix: text('key_prefix').notNull(),
    hash: text('key_hash').notNull(),
    name: text('name'),
    scopes: text('scopes').array(),
    allowedNamespaces: text('allowed_namespaces').array(),
    requestCount: integer('request_count').default(0),
    isActive: boolean('is_active').default(true),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
}, (table) => ({
    apiKeysHashIdx: index('api_keys_hash_idx').on(table.hash),
    apiKeysPrefixIdx: index('api_keys_prefix_idx').on(table.prefix),
    apiKeysOrgActiveIdx: index('api_keys_org_active_idx').on(table.orgId, table.isActive),
    apiKeysOrgCreatedIdx: index('api_keys_org_created_idx').on(table.orgId, table.createdAt),
    apiKeysUserIdx: index('api_keys_user_idx').on(table.userId),
    apiKeysActiveIdx: index('api_keys_active_idx').on(table.isActive),
}));

export const alignmentModelPairs = pgTable('alignment_model_pairs', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceProvider: text('source_provider').notNull(),
    sourceModel: text('source_model'),
    targetProvider: text('target_provider').notNull(),
    targetModel: text('target_model'),
    taskFamily: text('task_family').notNull(),
    compatibilityScore: real('compatibility_score').default(0),
    tokenizerCompatibility: real('tokenizer_compatibility').default(0),
    representationSimilarity: real('representation_similarity').default(0),
    status: text('status').default('estimated'),
    evidenceLevel: text('evidence_level').default('heuristic-v1'),
    privateInferenceCapable: boolean('private_inference_capable').default(false),
    notes: jsonb('notes').default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    alignmentPairSourceIdx: index('alignment_pairs_source_idx').on(table.sourceProvider, table.targetProvider),
    alignmentPairTaskIdx: index('alignment_pairs_task_idx').on(table.taskFamily),
}));

export const alignmentBenchmarks = pgTable('alignment_benchmarks', {
    id: uuid('id').defaultRandom().primaryKey(),
    pairId: text('pair_id').notNull(),
    sourceProvider: text('source_provider').notNull(),
    targetProvider: text('target_provider').notNull(),
    taskFamily: text('task_family').notNull(),
    dataset: text('dataset'),
    baselineScore: real('baseline_score'),
    alignedScore: real('aligned_score'),
    degradationPct: real('degradation_pct'),
    latencyMs: real('latency_ms'),
    costUsd: real('cost_usd'),
    notes: jsonb('notes').default([]),
    status: text('status').default('recorded'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    alignmentBenchmarkPairIdx: index('alignment_benchmarks_pair_idx').on(table.pairId),
    alignmentBenchmarkTaskIdx: index('alignment_benchmarks_task_idx').on(table.taskFamily),
}));

export const alignmentRuns = pgTable('alignment_runs', {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: text('request_id').notNull(),
    receiptId: text('receipt_id'),
    sourceProvider: text('source_provider'),
    sourceModel: text('source_model'),
    targetProvider: text('target_provider'),
    targetModel: text('target_model'),
    taskFamily: text('task_family').notNull(),
    executionMode: text('execution_mode').notNull(),
    privacyMode: text('privacy_mode').notNull(),
    sensitivity: text('sensitivity').notNull(),
    verdict: text('verdict').notNull(),
    ontologyRef: text('ontology_ref'),
    compatibilityScore: real('compatibility_score'),
    principalId: text('principal_id'),
    notes: jsonb('notes').default([]),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    alignmentRunRequestIdx: index('alignment_runs_request_idx').on(table.requestId),
    alignmentRunTaskIdx: index('alignment_runs_task_idx').on(table.taskFamily),
    alignmentRunModeIdx: index('alignment_runs_mode_idx').on(table.executionMode),
}));

export const contextPacks = pgTable('context_packs', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').default('draft'),
    latestVersion: integer('latest_version').default(1),
    latestVersionId: text('latest_version_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    contextPackSlugIdx: index('context_packs_slug_idx').on(table.slug),
    contextPackOrgIdx: index('context_packs_org_idx').on(table.orgId),
}));

export const contextPackVersions = pgTable('context_pack_versions', {
    id: uuid('id').defaultRandom().primaryKey(),
    contextPackId: text('context_pack_id').notNull(),
    version: integer('version').notNull(),
    objective: text('objective').notNull(),
    methodology: text('methodology'),
    conventions: jsonb('conventions').default([]),
    tools: jsonb('tools').default([]),
    outputContract: jsonb('output_contract').default({}),
    policyProfile: jsonb('policy_profile').default({}),
    ontologyRef: text('ontology_ref'),
    hash: text('hash').notNull(),
    receiptId: text('receipt_id'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    contextPackVersionPackIdx: index('context_pack_versions_pack_idx').on(table.contextPackId),
    contextPackVersionHashIdx: index('context_pack_versions_hash_idx').on(table.hash),
}));

export const contextPackSources = pgTable('context_pack_sources', {
    id: uuid('id').defaultRandom().primaryKey(),
    contextPackVersionId: text('context_pack_version_id').notNull(),
    kind: text('kind').notNull(),
    uri: text('uri'),
    title: text('title'),
    checksum: text('checksum'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    contextPackSourceVersionIdx: index('context_pack_sources_version_idx').on(table.contextPackVersionId),
}));

export const executionRuns = pgTable('execution_runs', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('organization_id').references(() => organizations.id),
    contextPackId: text('context_pack_id').notNull(),
    contextPackVersionId: text('context_pack_version_id').notNull(),
    status: text('status').notNull(),
    currentPhase: text('current_phase').notNull(),
    trigger: text('trigger').default('manual'),
    inputPayload: jsonb('input_payload').default({}),
    outputPayload: jsonb('output_payload').default({}),
    reviewVerdict: text('review_verdict').default('INFO'),
    gateStatus: text('gate_status').default('not_required'),
    receiptId: text('receipt_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
}, (table) => ({
    executionRunPackIdx: index('execution_runs_pack_idx').on(table.contextPackId),
    executionRunStatusIdx: index('execution_runs_status_idx').on(table.status),
}));

export const executionReviews = pgTable('execution_reviews', {
    id: uuid('id').defaultRandom().primaryKey(),
    executionRunId: text('execution_run_id').notNull(),
    reviewerRole: text('reviewer_role').notNull(),
    verdict: text('verdict').notNull(),
    summary: text('summary'),
    findings: jsonb('findings').default([]),
    confidence: real('confidence'),
    receiptId: text('receipt_id'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    executionReviewRunIdx: index('execution_reviews_run_idx').on(table.executionRunId),
}));

export const executionGates = pgTable('execution_gates', {
    id: uuid('id').defaultRandom().primaryKey(),
    executionRunId: text('execution_run_id').notNull(),
    gateType: text('gate_type').notNull(),
    status: text('status').notNull(),
    reason: text('reason'),
    decidedBy: text('decided_by'),
    decisionNote: text('decision_note'),
    receiptId: text('receipt_id'),
    createdAt: timestamp('created_at').defaultNow(),
    decidedAt: timestamp('decided_at'),
}, (table) => ({
    executionGateRunIdx: index('execution_gates_run_idx').on(table.executionRunId),
    executionGateStatusIdx: index('execution_gates_status_idx').on(table.status),
}));

// --- Game Theory & Autonomous Lab ---
export const gameSessions = pgTable('game_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    sessionType: text('session_type').notNull(), // 'leak_hunter', 'context_squeeze'
    sector: text('sector'),
    useCase: text('use_case'),
    goal: text('goal'),
    score: real('score').default(0),
    success: boolean('success').default(false),
    metrics: jsonb('metrics'),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    discoveredPattern: boolean('discovered_pattern').default(false),
    patternNoveltyScore: real('pattern_novelty_score').default(0),
    durationSeconds: real('duration_seconds'),
});

export const patternDiscoveries = pgTable('pattern_discoveries', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => gameSessions.id),
    discoveredBy: uuid('discovered_by').references(() => users.id), // Or Agent ID if applicable
    patternName: text('pattern_name'),
    patternDescription: text('pattern_description'),
    sector: text('sector'),
    useCase: text('use_case'),
    configuration: jsonb('configuration'), // The "Recipe"
    expectedHitRate: real('expected_hit_rate'),
    expectedLatencyMs: real('expected_latency_ms'),
    validationScore: real('validation_score'), // How good is it?
    discoveredAt: timestamp('discovered_at').defaultNow(),
});

export const experimentResults = pgTable('experiment_results', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => gameSessions.id),
    experimentName: text('experiment_name'),
    dataSource: text('data_source'),
    requestCount: real('request_count'),
    hitRate: real('hit_rate'),
    costSavingsPercent: real('cost_savings_percent'),
    testedAt: timestamp('tested_at').defaultNow(),
});

export const requestPatterns = pgTable('request_patterns', {
    id: uuid('id').defaultRandom().primaryKey(),
    patternHash: text('pattern_hash').notNull().unique(), // Unique semantic hash
    frequency: integer('frequency').default(1),
    lastAccessed: timestamp('last_accessed').defaultNow(),
    semanticLabel: text('semantic_label'), // e.g., 'Code', 'Creative', 'Fact'
    avgLatencyMs: real('avg_latency_ms'),
});

// --- Agentic Plan Caching ---
export const planTemplates = pgTable('plan_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    sector: text('sector'), // e.g., 'ecommerce', 'finance'
    steps: jsonb('steps').notNull(), // Array of step definitions
    avgCost: real('avg_cost'),
    avgLatency: real('avg_latency'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const cachedPlanExecutions = pgTable('cached_plan_executions', {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').references(() => planTemplates.id),
    planHash: text('plan_hash').notNull(), // Hash of the plan intent/structure
    inputHash: text('input_hash').notNull(), // Hash of the specific inputs
    executionTrace: jsonb('execution_trace').notNull(), // Full trace of the execution
    tokensSaved: integer('tokens_saved'),
    costSaved: real('cost_saved'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
}, (table) => ({
    lookupIdx: index('plan_lookup_idx').on(table.planHash, table.inputHash),
}));

// --- Agentic Awareness: Distress Signals ---
export const agentAlerts = pgTable('agent_alerts', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentName: text('agent_name'), // Link to Pattern Name or Agent Name
    severity: text('severity').notNull(), // 'low', 'medium', 'critical'
    message: text('message').notNull(),
    context: jsonb('context'), // Dump of state/memory
    status: text('status').default('open'), // 'open', 'resolved', 'ignored'
    createdAt: timestamp('created_at').defaultNow(),
    resolvedAt: timestamp('resolved_at'),
});

// --- Notifications System ---
export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    type: text('type').notNull(), // 'info', 'success', 'warning', 'error'
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'), // Action link (optional)
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    metadata: jsonb('metadata'), // Flexible metadata
}, (table) => ({
    userUnreadIdx: index('notif_user_unread_idx').on(table.userId, table.isRead),
}));

// --- Platform Control Plane ---

export const systemSettings = pgTable('system_settings', {
    key: text('key').primaryKey(), // e.g., 'global_maintenance_mode', 'default_model'
    value: jsonb('value').notNull(),
    description: text('description'),
    updatedAt: timestamp('updated_at').defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id),
});

export const agentRegistry = pgTable('agent_registry', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.id),
    isEnabled: boolean('is_enabled').default(false),
    schedule: text('schedule'), // Cron expression
    budgetLimit: real('budget_limit').default(0), // Daily limit
    capabilities: text('capabilities').array(),
    lastHeartbeat: timestamp('last_heartbeat'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Credits Top-Off Billing System ---

// Auto top-off settings per user
export const autoTopoffSettings = pgTable('auto_topoff_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull().unique(),
    enabled: boolean('enabled').default(false),
    thresholdCredits: real('threshold_credits').default(100),
    topoffPackage: text('topoff_package').default('pack_2500'),
    stripePaymentMethodId: text('stripe_payment_method_id'),
    lastTopoffAt: timestamp('last_topoff_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Credit transactions (all credit movements)
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    type: text('type').notNull(), // 'purchase', 'usage', 'refund', 'bonus', 'auto_topoff'
    amount: real('amount').notNull(), // Positive = credits in, Negative = credits out
    balanceAfter: real('balance_after').notNull(),
    description: text('description'),

    // For purchases
    packageId: text('package_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    // For usage
    service: text('service'), // 'cache_read', 'ai_embedding', etc.
    resourceId: text('resource_id'),
    quantity: real('quantity'),

    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    userIdx: index('credit_tx_user_idx').on(table.userId),
    createdIdx: index('credit_tx_created_idx').on(table.createdAt),
    typeIdx: index('credit_tx_type_idx').on(table.type),
}));

// Daily usage aggregation for analytics
export const creditUsageDaily = pgTable('credit_usage_daily', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    date: timestamp('date').notNull(),

    // Usage counts by service
    cacheReads: integer('cache_reads').default(0),
    cacheWrites: integer('cache_writes').default(0),
    cacheSemantic: integer('cache_semantic').default(0),
    aiEmbeddings: integer('ai_embeddings').default(0),
    aiCompletionsTokens: integer('ai_completions_tokens').default(0),
    transcodeMinutes: real('transcode_minutes').default(0),
    storageGb: real('storage_gb').default(0),
    egressGb: real('egress_gb').default(0),
    edgeInvocations: integer('edge_invocations').default(0),

    totalCreditsUsed: real('total_credits_used').default(0),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    userDateIdx: index('credit_usage_daily_user_date_idx').on(table.userId, table.date),
}));

// --- Semantic Shadow (AgentCache x Shodan) ---

// 1. Bancache: The "Dictionary" of unique banners
// Key strategy: Hash the banner to de-duplicate. Analyze once, serve everywhere.
export const bancache = pgTable('bancache', {
    hash: text('hash').primaryKey(), // SHA256(banner_text)
    bannerText: text('banner_text').notNull(),
    firstSeenAt: timestamp('first_seen_at').defaultNow(),
    lastSeenAt: timestamp('last_seen_at').defaultNow(),
    seenCount: integer('seen_count').default(1),
});

// 2. Banner Analysis: The "Intelligence" attached to a banner
export const bannerAnalysis = pgTable('banner_analysis', {
    id: uuid('id').defaultRandom().primaryKey(),
    bannerHash: text('banner_hash').references(() => bancache.hash),
    agentModel: text('agent_model').notNull(), // e.g. 'kimi-k2.5'

    // Structured Intelligence
    riskScore: real('risk_score'), // 0.0 - 10.0
    classification: text('classification'), // 'Database', 'IoT', 'Web Server'
    vulnerabilities: jsonb('vulnerabilities'), // List of CVEs
    compliance: jsonb('compliance'), // { pci: false, hipaa: true }

    // Unstructured Reasoning (The "Why")
    reasoning: text('reasoning'),

    analyzedAt: timestamp('analyzed_at').defaultNow(),
});

// --- Bento Grid Content System ---

export const lanes = pgTable('lanes', {
    id: text('id').primaryKey(), // e.g., 'mission', 'usecases'
    title: text('title').notNull(),
    size: text('size').notNull(), // 'large', 'medium', 'small'
    speed: integer('speed').default(4000),
});

export const cards = pgTable('cards', {
    id: text('id').primaryKey(), // e.g., 'mission-1'
    laneId: text('lane_id').references(() => lanes.id),
    template: text('template').notNull(), // 'hero', 'standard', 'profile'
    data: jsonb('data').notNull(), // { title, subtitle, content, image... }
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    laneIdx: index('cards_lane_idx').on(table.laneId),
}));

// --- Agent Marketplace (The Exchange) ---

// 1. The Ledger (Banking)
export const ledgerAccounts = pgTable('ledger_accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').notNull(), // User or Agent ID (Hub ID)
    ownerType: text('owner_type').notNull(), // 'user' | 'agent'
    currency: text('currency').default('USDC'),
    balance: real('balance').default(0.0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const ledgerTransactions = pgTable('ledger_transactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    fromAccountId: uuid('from_account_id').references(() => ledgerAccounts.id),
    toAccountId: uuid('to_account_id').references(() => ledgerAccounts.id),
    amount: real('amount').notNull(),
    currency: text('currency').default('USDC'),
    referenceType: text('reference_type'), // 'order', 'deposit', 'withdrawal'
    referenceId: text('reference_id'), // Link to order_id or external tx
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
});

// 2. The Market (Trading)
export const marketplaceListings = pgTable('marketplace_listings', {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerAgentId: text('seller_agent_id').references(() => hubAgents.id),
    title: text('title').notNull(),
    description: text('description'),
    pricePerUnit: real('price_per_unit').notNull(),
    unitType: text('unit_type').default('request'), // 'request', 'hour', 'token'
    tags: text('tags').array(),
    status: text('status').default('active'), // 'active', 'paused'
    isVerified: boolean('is_verified').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const marketplaceOrders = pgTable('marketplace_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id').references(() => marketplaceListings.id),
    buyerAgentId: text('buyer_agent_id').references(() => hubAgents.id),
    status: text('status').default('pending'), // 'pending', 'active', 'completed', 'disputed'
    unitsPurchased: real('units_purchased').default(1),
    totalPrice: real('total_price').notNull(),
    fulfillmentData: jsonb('fulfillment_data'), // Delivery of the service (e.g., report URL)
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
});

export const agentToolAccess = pgTable('agent_tool_access', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id),
    toolName: text('tool_name').notNull(),
    orderId: uuid('order_id').references(() => marketplaceOrders.id),
    expiresAt: timestamp('expires_at'),
    status: text('status').default('active'),
    createdAt: timestamp('created_at').defaultNow(),
});

// 3. Agent Governance (Voice)
export const agentSuggestions = pgTable('agent_suggestions', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').default('enhancement'), // 'enhancement', 'bug', 'policy'
    votes: integer('votes').default(0),
    status: text('status').default('open'), // 'open', 'planned', 'rejected', 'implemented'
    createdAt: timestamp('created_at').defaultNow(),
});

// --- Wireless Intelligence (WiGLE / Shodan Style) ---
export const signals = pgTable('signals', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.id), // The Scanner
    target: text('target').notNull(), // IP, URL, or Logical Node
    type: text('type').notNull(), // 'wifi', 'bluetooth', 'http', 'anomaly'
    strength: real('strength').default(0), // -100 to 0 (dBm) or 0.0-1.0
    lat: real('lat'), // Virtual X (0-100)
    lon: real('lon'), // Virtual Y (0-100)
    metadata: jsonb('metadata'), // SSID, Banner, Headers
    seenAt: timestamp('seen_at').defaultNow(),
}, (table) => ({
    targetIdx: index('signal_target_idx').on(table.target),
}));

// --- Engine V2: Transcripts ---
export const jobTranscripts = pgTable('job_transcripts', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: text('job_id').notNull(),
    lane: text('lane').notNull(),
    agent: text('agent').notNull(),
    logs: jsonb('logs').notNull(), // Array of JSON Log Events
    startTime: timestamp('start_time').defaultNow(),
    endTime: timestamp('end_time'),
    status: text('status').default('running'), // running, completed, failed
});

// --- Product Research: Survey Responses ---
export const surveyResponses = pgTable('survey_responses', {
    id: uuid('id').defaultRandom().primaryKey(),
    channel: text('channel').notNull(), // 'telegram', 'moltbook', 'clawtasks'
    userId: text('user_id'), // External user identifier
    question: text('question').notNull(),
    response: text('response').notNull(),
    sentiment: text('sentiment').default('neutral'), // 'positive', 'negative', 'neutral'
    insights: jsonb('insights').default([]), // Extracted themes/keywords
    metadata: jsonb('metadata').default({}), // Extra context
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    channelIdx: index('survey_channel_idx').on(table.channel),
}));

// --- Tool Safety Scanner: Trust Registry ---
export const toolScanResults = pgTable('tool_scan_results', {
    id: uuid('id').defaultRandom().primaryKey(),
    contentHash: text('content_hash').notNull().unique(),
    toolName: text('tool_name'),
    language: text('language'),
    trustScore: real('trust_score').notNull().default(1.0),
    verdict: text('verdict').notNull().default('trusted'),
    findings: jsonb('findings').default([]),
    manifest: jsonb('manifest'),
    scannedBy: text('scanned_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    hashIdx: index('tool_scan_hash_idx').on(table.contentHash),
    verdictIdx: index('tool_scan_verdict_idx').on(table.verdict),
    scoreIdx: index('tool_scan_score_idx').on(table.trustScore),
}));

// --- Product Research: Market Insights ---
export const marketInsights = pgTable('market_insights', {
    id: uuid('id').defaultRandom().primaryKey(),
    weekOf: timestamp('week_of').notNull(),
    topSkills: jsonb('top_skills').default([]), // Most requested skills
    painPoints: jsonb('pain_points').default([]), // Common complaints
    opportunities: jsonb('opportunities').default([]), // Product ideas
    surveyCount: integer('survey_count').default(0),
    bountyAnalysis: jsonb('bounty_analysis').default({}), // ClawTasks patterns
    createdAt: timestamp('created_at').defaultNow(),
});

// --- Symbiont: Legal Bridge ---
export const legalContracts = pgTable('legal_contracts', {
    id: uuid('id').defaultRandom().primaryKey(),
    swarmId: text('swarm_id'), // Link to the swarm that generated it
    templateId: text('template_id').notNull(), // e.g. '04-ai-revenue-share-operating-agreement'
    content: text('content').notNull(), // The actual contract text (markdown)
    metadata: jsonb('metadata').default({}), // Roles, splits, actor names
    status: text('status').default('draft'), // 'draft', 'signed', 'active', 'closed'
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    swarmIdx: index('legal_contracts_swarm_idx').on(table.swarmId),
}));

export const contractSignatures = pgTable('contract_signatures', {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: uuid('contract_id').references(() => legalContracts.id).notNull(),
    agentId: text('agent_id').notNull(),
    walletAddress: text('wallet_address'),
    signatureHash: text('signature_hash'),
    timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
    contractIdx: index('contract_sigs_contract_idx').on(table.contractId),
}));

// --- Periscope: The Foresight System (Phase 32.7) ---

export const periscopeRuns = pgTable('periscope_runs', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id'), // Compatible with hubAgents (text IDs)
    sessionId: text('session_id'),
    startedAt: timestamp('started_at').defaultNow(),
    endedAt: timestamp('ended_at'),
}, (table) => ({
    agentSessIdx: index('periscope_run_agent_sess_idx').on(table.agentId, table.sessionId),
}));

export const periscopeSteps = pgTable('periscope_steps', {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id').references(() => periscopeRuns.id),
    index: integer('index').notNull(),
    stateSignature: jsonb('state_signature'), // { embedding: [], tags: [] }
    goalTag: text('goal_tag'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    runIdx: index('periscope_step_run_idx').on(table.runId),
}));

export const periscopeActions = pgTable('periscope_actions', {
    id: uuid('id').defaultRandom().primaryKey(),
    stepId: uuid('step_id').references(() => periscopeSteps.id),
    actionType: text('action_type').notNull(), // 'tool_call', 'llm_call', 'parallel', etc.
    toolName: text('tool_name'),
    provider: text('provider'),
    paramsHash: text('params_hash'),
    cacheStatus: text('cache_status'), // 'hit', 'miss', 'bypass'
    latencyMs: integer('latency_ms'),
    tokenCost: integer('token_cost'),
    success: boolean('success').default(true),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    stepIdx: index('periscope_action_step_idx').on(table.stepId),
    lookupIdx: index('periscope_action_lookup_idx').on(table.toolName, table.provider, table.actionType),
}));

export const periscopePathStats = pgTable('periscope_path_stats', {
    id: uuid('id').defaultRandom().primaryKey(),
    actionKey: text('action_key').notNull().unique(), // e.g., "tool:stripe.charge:openai:gpt-4"
    avgLatencyMs: real('avg_latency_ms').default(0),
    p95LatencyMs: real('p95_latency_ms').default(0),
    avgTokenCost: real('avg_token_cost').default(0),
    successRate: real('success_rate').default(1.0),
    cacheHitRate: real('cache_hit_rate').default(0),
    sampleCount: integer('sample_count').default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Maturity Engine: Cognitive Progression ---
export const maturityLedger = pgTable('maturity_ledger', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: text('agent_id').references(() => hubAgents.id).notNull(),
    taskKey: text('task_key').notNull(), // e.g., 'data-parsing', 'b2b-negotiation'
    successCount: integer('success_count').default(0),
    failureCount: integer('failure_count').default(0),
    level: integer('level').default(1), // 1: Functional, 2: Heuristic, 3: Autonomous
    lastSuccessAt: timestamp('last_success_at'),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    maturityAgentTaskIdx: index('maturity_agent_task_idx').on(table.agentId, table.taskKey),
}));
// --- External Agent Registration (Phase 7: S31) ---
export const externalAgents = pgTable('external_agents', {
    id: text('id').primaryKey(),
    externalSystem: text('external_system').notNull(), // 'moltbook', 'generic'
    externalAgentId: text('external_agent_id').notNull(),
    displayName: text('display_name').notNull(),
    profileUrl: text('profile_url'),
    ownerPrincipalId: text('owner_principal_id').notNull(),
    status: text('status').default('pending').notNull(), // 'pending', 'verified'
    challengeToken: text('challenge_token').notNull(),
    challengeInstructions: text('challenge_instructions'),
    latestSoulprintReceiptId: text('latest_soulprint_receipt_id'),
    metadata: jsonb('metadata').default({}),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    externalAgentOwnerIdx: index('external_agent_owner_idx').on(table.ownerPrincipalId),
    externalAgentSystemIdIdx: index('external_agent_system_id_idx').on(table.externalSystem, table.externalAgentId),
}));

// --- Ontology Graph Storage (Phase Q4 Hardening) ---

export const ontologyNodes = pgTable('ontology_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    sectorId: text('sector_id').notNull(),
    canonicalTerm: text('canonical_term').notNull(),
    nodeType: text('node_type').notNull(), // Semantic type from OntologyConstraints (Entity, Metric, Process, etc.)
    displayName: text('display_name'),
    properties: jsonb('properties').default({}),
    ontologyVersion: text('ontology_version'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    ontologyNodeSectorTermIdx: index('ontology_node_sector_term_idx').on(table.sectorId, table.canonicalTerm),
    ontologyNodeTypeIdx: index('ontology_node_type_idx').on(table.nodeType),
}));

export const ontologyEdges = pgTable('ontology_edges', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceNodeId: uuid('source_node_id').references(() => ontologyNodes.id).notNull(),
    targetNodeId: uuid('target_node_id').references(() => ontologyNodes.id).notNull(),
    predicate: text('predicate').notNull(), // e.g., HAS_EXPOSURE, PERFORMS, GOVERNED_BY
    confidence: real('confidence').default(1.0),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    ontologyEdgeSourceIdx: index('ontology_edge_source_idx').on(table.sourceNodeId, table.predicate),
    ontologyEdgeTargetIdx: index('ontology_edge_target_idx').on(table.targetNodeId),
}));


// ═══════════════════════════════════════════════════════════════
// AgentForge: The Folder That Thinks (Node Control Plane)
// (restored alongside the full schema; tables added in the working refactor)
// ═══════════════════════════════════════════════════════════════
export const smartNodes = pgTable('smart_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id),
    workflowId: uuid('workflow_id'),  // Group nodes into workflows/canvases
    name: text('name').notNull(),
    nodeType: text('node_type').default('directory'),
    // 'directory' — standard folder node
    // 'trigger'   — event source (file drop, schedule, webhook)
    // 'transform' — data transformation (summarize, classify, format)
    // 'action'    — output action (notify, export, publish)
    // 'condition' — branching logic (if/else routing)
    status: text('status').default('active'),

    // Canvas position (for the visual editor)
    posX: real('pos_x').default(0),
    posY: real('pos_y').default(0),

    // Node configuration
    memoryContext: jsonb('memory_context').default({}),
    specTruth: jsonb('spec_truth').default({}),
    properties: jsonb('properties').default({}),
    // properties schema: {
    //   inputs:  [{ key, label, type, default }],
    //   outputs: [{ key, label, type }],
    //   settings: { model, temperature, schedule, ... }
    // }

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    ownerIdx: index('smart_nodes_owner_idx').on(table.ownerId),
    workflowIdx: index('smart_nodes_workflow_idx').on(table.workflowId),
}));

// --- Workflows: Named canvases that group connected nodes ---
export const workflows = pgTable('workflows', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').default('draft'), // 'draft', 'active', 'paused', 'archived'
    settings: jsonb('settings').default({}),
    // settings: { autoExecute, errorHandling, retryPolicy, ... }
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    ownerIdx: index('workflows_owner_idx').on(table.ownerId),
}));

// --- Node Connections: Edges between nodes (the wires) ---
// Models the data flow graph. Source output port → target input port.
export const nodeConnections = pgTable('node_connections', {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').references(() => workflows.id).notNull(),
    sourceNodeId: uuid('source_node_id').references(() => smartNodes.id).notNull(),
    targetNodeId: uuid('target_node_id').references(() => smartNodes.id).notNull(),
    sourcePort: text('source_port').default('output'),  // Output port name on source
    targetPort: text('target_port').default('input'),    // Input port name on target
    dataMapping: jsonb('data_mapping').default({}),
    // dataMapping: { "summary" → "input_text", "tags" → "categories" }
    // Maps source output fields to target input fields
    condition: jsonb('condition'),
    // Optional: only pass data if condition is met
    // { field: "status", operator: "equals", value: "approved" }
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    sourceIdx: index('node_conn_source_idx').on(table.sourceNodeId),
    targetIdx: index('node_conn_target_idx').on(table.targetNodeId),
    workflowIdx: index('node_conn_workflow_idx').on(table.workflowId),
}));

// --- Node Properties: Typed, versioned configuration per node ---
export const nodeProperties = pgTable('node_properties', {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id').references(() => smartNodes.id).notNull(),
    key: text('key').notNull(),       // e.g. 'model', 'temperature', 'outputFormat'
    value: jsonb('value').notNull(),   // The actual value (typed via schema)
    valueType: text('value_type').default('string'),
    // 'string', 'number', 'boolean', 'select', 'json', 'code', 'credential'
    displayLabel: text('display_label'),
    groupName: text('group_name'),     // For UI grouping: 'General', 'Advanced', 'Auth'
    sortOrder: integer('sort_order').default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    nodeKeyIdx: index('node_props_node_key_idx').on(table.nodeId, table.key),
}));

// --- Node Agents: Agent assignments per node ---
export const nodeAgents = pgTable('node_agents', {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id').references(() => smartNodes.id).notNull(),
    agentId: uuid('agent_id').references(() => agents.id),
    roleName: text('role_name').notNull(),
    permissions: jsonb('permissions').default({}),
    assignedAt: timestamp('assigned_at').defaultNow(),
});

// --- Node Intents: Scheduled/triggered actions per node ---
export const nodeIntents = pgTable('node_intents', {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id').references(() => smartNodes.id).notNull(),
    actionType: text('action_type').notNull(),
    status: text('status').default('idle'),
    executionLog: jsonb('execution_log').default([]),
    scheduledTime: timestamp('scheduled_time'),
    createdAt: timestamp('created_at').defaultNow(),
});

// --- Workflow Executions: Runtime trace of a workflow run ---
export const workflowExecutions = pgTable('workflow_executions', {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').references(() => workflows.id).notNull(),
    triggeredBy: text('triggered_by'), // 'manual', 'schedule', 'file_drop', 'webhook'
    status: text('status').default('running'),
    // 'running', 'completed', 'failed', 'cancelled'
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    nodeResults: jsonb('node_results').default({}),
    // { nodeId: { status, output, duration_ms, error? } }
    errorMessage: text('error_message'),
}, (table) => ({
    workflowIdx: index('wf_exec_workflow_idx').on(table.workflowId),
    statusIdx: index('wf_exec_status_idx').on(table.status),
}));

// --- Sector Packs & Templates ---
export const sectorPacks = pgTable('sector_packs', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    version: text('version').default('1.0.0'),
    isOfficial: boolean('is_official').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});

export const actionTemplates = pgTable('action_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    packId: uuid('pack_id').references(() => sectorPacks.id),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'), 
    workflowSchema: jsonb('workflow_schema').default({}), 
    requiredInputs: jsonb('required_inputs').default([]),
    createdAt: timestamp('created_at').defaultNow(),
});
