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
    email: text('email').unique(), // Made nullable for wallet-only users (though unique constraint might need handling if multiple nulls allowed? PG allows multiple nulls in unique)
    passwordHash: text('password_hash'), // Nullable for OAuth/Wallet users
    walletAddress: text('wallet_address').unique(), // For SIWE
    nonce: text('nonce'), // For SIWE verification
    name: text('name'),
    avatarUrl: text('avatar_url'),
    role: text('role').default('user'), // 'admin', 'user'
    plan: text('plan').default('free'),
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
});

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
    ownerId: uuid('owner_id').notNull(), // User or Agent ID
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
    sellerAgentId: uuid('seller_agent_id').references(() => agents.id),
    title: text('title').notNull(),
    description: text('description'),
    pricePerUnit: real('price_per_unit').notNull(),
    unitType: text('unit_type').default('request'), // 'request', 'hour', 'token'
    tags: text('tags').array(),
    status: text('status').default('active'), // 'active', 'paused'
    createdAt: timestamp('created_at').defaultNow(),
});

export const marketplaceOrders = pgTable('marketplace_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id').references(() => marketplaceListings.id),
    buyerAgentId: uuid('buyer_agent_id').references(() => agents.id),
    status: text('status').default('pending'), // 'pending', 'active', 'completed', 'disputed'
    unitsPurchased: real('units_purchased').default(1),
    totalPrice: real('total_price').notNull(),
    fulfillmentData: jsonb('fulfillment_data'), // Delivery of the service (e.g., report URL)
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
});

// 3. Agent Governance (Voice)
export const agentSuggestions = pgTable('agent_suggestions', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.id),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').default('enhancement'), // 'enhancement', 'bug', 'policy'
    votes: integer('votes').default(0),
    status: text('status').default('open'), // 'open', 'planned', 'rejected', 'implemented'
    createdAt: timestamp('created_at').defaultNow(),
});
