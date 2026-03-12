/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

export let client;
export let db;

// IMPORTANT:
// - Do NOT default to localhost in serverless (Vercel) or production.
// - If DATABASE_URL is missing, use a safe mock so APIs can still respond quickly.
if (!connectionString) {
    // In-Memory Store for Mock Data
    const mockStore = {
        marketplace_listings: [],
        ledger_accounts: [],
        ledger_transactions: [],
        marketplace_orders: [],
        agents: [],
        users: [],
        decisions: [],
        credit_usage_daily: [],
        hub_agents: [],
        hub_agent_api_keys: [],
        hub_focus_group_responses: [],
        hub_agent_badges: [],
        service_requests: [],
        service_requests: [],
        needs_signals: [],
        bancache: [],
        banner_analysis: [],
        periscope_runs: [],
        periscope_steps: [],
        periscope_actions: [],
        periscope_path_stats: [],
        patterns: [],
        agent_alerts: []
    };

    function findAccount(ownerId) {
        const accounts = mockStore.ledger_accounts || [];
        return accounts.find(a => a.owner_id === ownerId || a.ownerId === ownerId);
    }

    // Chainable Mock Helper with State
    const createChainableMock = (tableName = null, operation = 'select') => {
        let currentTable = tableName;
        let queryImpl = async () => [];

        const mock = {
            from: (tableObj) => {
                currentTable = tableObj[Symbol.for('drizzle:Name')] || tableObj.u_;
                if (!currentTable && tableObj === schema.marketplaceListings) currentTable = 'marketplace_listings';
                if (!currentTable && tableObj === schema.ledgerAccounts) currentTable = 'ledger_accounts';
                if (!currentTable && tableObj === schema.ledgerTransactions) currentTable = 'ledger_transactions';
                if (!currentTable && tableObj === schema.marketplaceOrders) currentTable = 'marketplace_orders';
                if (!currentTable && tableObj === schema.agents) currentTable = 'agents';
                if (!currentTable && tableObj === schema.hubAgents) currentTable = 'hub_agents';
                if (!currentTable && tableObj === schema.hubAgentApiKeys) currentTable = 'hub_agent_api_keys';
                if (!currentTable && tableObj === schema.hubFocusGroupResponses) currentTable = 'hub_focus_group_responses';
                if (!currentTable && tableObj === schema.hubAgentBadges) currentTable = 'hub_agent_badges';
                if (!currentTable && tableObj === schema.serviceRequests) currentTable = 'service_requests';
                if (!currentTable && tableObj === schema.needsSignals) currentTable = 'needs_signals';

                if (!currentTable && tableObj === schema.users) currentTable = 'users';
                if (!currentTable && tableObj === schema.decisions) currentTable = 'decisions';
                if (!currentTable && tableObj === schema.creditUsageDaily) currentTable = 'credit_usage_daily';
                if (!currentTable && tableObj === schema.bancache) currentTable = 'bancache';
                if (!currentTable && tableObj === schema.bannerAnalysis) currentTable = 'banner_analysis';
                if (!currentTable && tableObj === schema.creditTransactions) currentTable = 'credit_transactions';
                if (!currentTable && tableObj === schema.periscopeRuns) currentTable = 'periscope_runs';
                if (!currentTable && tableObj === schema.periscopeSteps) currentTable = 'periscope_steps';
                if (!currentTable && tableObj === schema.periscopeActions) currentTable = 'periscope_actions';
                if (!currentTable && tableObj === schema.periscopePathStats) currentTable = 'periscope_path_stats';

                if (currentTable) {
                    queryImpl = async () => {
                        const data = mockStore[currentTable] || [];
                        // Simple selects return flattened objects in Drizzle unless joins are used
                        return data;
                    };
                }

                return mock;
            },
            leftJoin: () => mock,
            innerJoin: () => mock,
            where: (condition) => {
                const oldQuery = queryImpl;
                queryImpl = async () => {
                    const data = await oldQuery();
                    if (!condition) return data;

                    let targetValue = condition.value !== undefined ? condition.value : condition.right;
                    let targetKey = condition.key?.name || (condition.left?.name);

                    if (targetKey && targetValue !== undefined) {
                        return data.filter(row => {
                            if (row[targetKey] === targetValue) return true;
                            const camelKey = targetKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                            if (row[camelKey] === targetValue) return true;
                            return false;
                        });
                    }
                    return data;
                };
                return mock;
            },
            limit: () => mock,
            orderBy: () => mock,
            for: () => mock,
            values: (data) => {
                if (currentTable && mockStore[currentTable]) {
                    const entries = Array.isArray(data) ? data : [data];
                    entries.forEach(e => {
                        if (!e.id) e.id = Math.random().toString(36).substring(7);
                        if (currentTable === 'ledger_accounts' && (e.ownerId || e.owner_id)) {
                            const oid = e.ownerId || e.owner_id;
                            const existing = findAccount(oid);
                            if (existing) {
                                Object.assign(existing, e); // Merge!
                                return;
                            }
                        }
                        mockStore[currentTable].push(e);
                    });
                    queryImpl = async () => entries;
                }
                return mock;
            },
            set: (data) => {
                const innerQuery = queryImpl;
                queryImpl = async () => {
                    const rows = await innerQuery();
                    rows.forEach(row => {
                        Object.assign(row, data);
                        // Synchronize ownerId to owner_id if needed
                        if (row.ownerId && !row.owner_id) row.owner_id = row.ownerId;
                    });
                    return rows;
                };
                return mock;
            },
            returning: () => {
                return {
                    then: (resolve) => {
                        queryImpl().then(resolve);
                    }
                };
            },
            onConflictDoNothing: () => mock,
            onConflictDoUpdate: () => mock,
            then: (resolve) => {
                queryImpl().then(resolve);
            }
        };
        return mock;
    };

    db = {
        select: () => createChainableMock(null, 'select'),
        insert: (tableObj) => {
            let tName = '';
            if (tableObj === schema.ledgerAccounts) tName = 'ledger_accounts';
            if (tableObj === schema.ledgerTransactions) tName = 'ledger_transactions';
            if (tableObj === schema.bancache) tName = 'bancache';
            if (tableObj === schema.bannerAnalysis) tName = 'banner_analysis';
            if (tableObj === schema.creditTransactions) tName = 'credit_transactions';
            if (tableObj === schema.periscopeRuns) tName = 'periscope_runs';
            if (tableObj === schema.periscopeSteps) tName = 'periscope_steps';
            if (tableObj === schema.periscopeActions) tName = 'periscope_actions';
            if (tableObj === schema.periscopePathStats) tName = 'periscope_path_stats';
            if (tableObj === schema.patterns) tName = 'patterns';
            if (tableObj === schema.agentAlerts) tName = 'agent_alerts';
            return createChainableMock(tName, 'insert');
        },
        update: (tableObj) => {
            let tName = '';
            if (tableObj === schema.ledgerAccounts) tName = 'ledger_accounts';
            if (tableObj === schema.patterns) tName = 'patterns';
            return createChainableMock(tName, 'update');
        },
        delete: (tableObj) => {
            let tName = '';
            if (tableObj === schema.ledgerAccounts) tName = 'ledger_accounts';
            if (tableObj === schema.patterns) tName = 'patterns';
            return createChainableMock(tName, 'delete');
        },
        execute: async (sqlChunk) => {
            const flatten = (obj) => {
                if (obj === null || obj === undefined) return '';
                if (typeof obj === 'string') return obj;
                if (typeof obj === 'number') return String(obj);
                if (Array.isArray(obj)) return obj.map(flatten).join(' ');

                // Drizzle internals based on logs:
                // queryChunks is often an array, sometimes strings, sometimes objects with .value array
                if (obj.queryChunks) return flatten(obj.queryChunks);
                if (obj.value) return flatten(obj.value);
                if (obj.chunks) return flatten(obj.chunks);
                if (obj.sql) return flatten(obj.sql);

                return '';
            };

            const sqlStr = flatten(sqlChunk);
            const collectValues = (obj) => {
                if (obj === null || obj === undefined) return [];
                if (typeof obj === 'string' || typeof obj === 'number') return [obj];
                if (Array.isArray(obj)) return obj.flatMap(collectValues);
                if (obj.queryChunks) return collectValues(obj.queryChunks);
                if (obj.params) return collectValues(obj.params);
                if (obj.value !== undefined) return collectValues(obj.value);
                return [];
            };
            const allValues = collectValues(sqlChunk);

            // Debug: uncomment for SQL trace
            // console.log(`[MockDB Execute] Flattened SQL: ${sqlStr}`);

            // Raw Deduction/Addition Logic
            if (sqlStr.includes('balance -')) {
                const vals = collectValues(sqlChunk);
                const amount = vals.find(v => typeof v === 'number') || 0;

                // Try to find the UUID in params first, then fallback to regex
                let oId = vals.find(v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v));
                if (!oId) {
                    const idMatch = sqlStr.match(/owner_id\s*=\s*(['"])?([a-zA-Z0-9-]{36})\1?/i);
                    oId = idMatch ? idMatch[2] : null;
                }

                const acc = findAccount(oId);
                // console.log(`[MockDB Execute] Deduction | Acc Found: ${!!acc} | Amount: ${amount} | ID: ${oId}`);
                if (acc) {
                    acc.balance = (Number(acc.balance) || 0) - amount;
                }
            } else if (sqlStr.includes('balance +')) {
                const amount = Number(allValues.find(v => typeof v === 'number' && v > 0) || 0);
                const oId = allValues.find(v => typeof v === 'string' && v.length > 20 && v.includes('-')) || '';
                const acc = findAccount(oId);
                if (acc) {
                    acc.balance = (Number(acc.balance) || 0) + amount;
                }
            }
            return [];
        },
        transaction: async (cb) => cb(db),
        query: {
            marketplaceListings: {
                findFirst: () => mockStore.marketplace_listings[0],
                findMany: () => mockStore.marketplace_listings,
            }
        }
    };
} else {
    try {
        client = postgres(connectionString, {
            prepare: false,
            ssl: 'require',
            connect_timeout: 5
        });
        db = drizzle(client, { schema });
    } catch (error) {
        db = {
            select: () => ({ from: () => [] }),
            insert: () => ({ values: () => ({ returning: () => [] }) }),
            update: () => ({ set: () => ({ where: () => [] }) }),
            delete: () => ({ where: () => ({ returning: () => [] }) }),
            execute: () => ([]),
        };
    }
}
