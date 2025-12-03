import { pgTable, uuid, text, jsonb, timestamp, real, vector, boolean, index } from 'drizzle-orm/pg-core';
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
