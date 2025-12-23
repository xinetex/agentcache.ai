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
});

// --- Governance: Organizations & Access ---
export const organizations = pgTable('organizations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    plan: text('plan').default('free'), // 'free', 'pro', 'enterprise'
    region: text('region').default('us-east-1'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'), // Nullable for OAuth users, required for email
    name: text('name'),
    avatarUrl: text('avatar_url'),
    role: text('role').default('user'), // 'admin', 'user'
    plan: text('plan').default('free'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const members = pgTable('members', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    role: text('role').default('viewer'), // 'owner', 'admin', 'member', 'viewer'
    joinedAt: timestamp('joined_at').defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id),
    prefix: text('prefix').notNull(), // e.g., 'ac_live_'
    hash: text('hash').notNull(), // Hashed secret
    scopes: text('scopes').array(), // ['cache:read', 'cache:write']
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
});

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
