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

let _client;
let _db;

function shouldUseMockDb() {
    return process.env.NODE_ENV === 'test' || !!process.env.VITEST || process.env.AGENTCACHE_FORCE_MOCK_DB === '1';
}

/**
 * Lazy-initialization of the database connection.
 * Ensures process.env is populated (e.g. by dotenv) before connecting.
 */
function getDb() {
    if (_db) return _db;
    
    const connectionString = process.env.DATABASE_URL;

    if (shouldUseMockDb() || !connectionString) {
        console.warn("[DB] ⚠️ Using internal mock DB.");
        _db = createMockDb();
        return _db;
    }

    console.log('[DB] 🔌 Connecting to Postgres:', connectionString.substring(0, 15) + '...');

    try {
        if (connectionString === 'mock' || connectionString.includes('bogus')) {
            throw new Error('Using Mock DB');
        }
        _client = postgres(connectionString, {
            prepare: false,
            ssl: 'require',
            connect_timeout: 5,
            idle_timeout: 5,
            max: 10
        });
        _db = drizzle(_client, { schema });
    } catch (error) {
        console.warn("[DB] ⚠️ Connection failed or Mock requested. Falling back to internal mock engine.", error.message);
        _db = createMockDb();
    }
    return _db;
}

/** @type {any} */
export const db = new Proxy({}, {
    get: (target, prop) => {
        const d = getDb();
        if (prop === '__isMock') {
            return !!d.__isMock;
        }
        const val = d[prop];
        if (typeof val === 'function') {
            return val.bind(d);
        }
        return val;
    }
});

/**
 * Creates a chainable mock DB for environments without a real connection.
 */
function createMockDb() {
    const mockStore = {
        marketplace_listings: [],
        ledger_accounts: [],
        ledger_transactions: [],
        marketplace_orders: [],
        agent_tool_access: [],
        agent_suggestions: [],
        agents: [],
        users: [],
        decisions: [],
        credit_usage_daily: [],
        hub_agents: [],
        hub_agent_api_keys: [],
        hub_focus_group_responses: [],
        hub_agent_badges: [],
        service_requests: [],
        needs_signals: [],
        bancache: [],
        banner_analysis: [],
        periscope_runs: [],
        periscope_steps: [],
        periscope_actions: [],
        periscope_path_stats: [],
        patterns: [],
        agent_alerts: [],
        maturity_ledger: []
    };

    const toCamelCase = (value) => value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    const getTableName = (tableObj) => tableObj?.[Symbol.for('drizzle:Name')] || tableObj?.u_ || tableObj?.[Symbol.for('drizzle:BaseName')] || 'unknown';
    const getColumnValue = (row, columnName) => row?.[columnName] ?? row?.[toCamelCase(columnName)];
    const setColumnValue = (row, columnName, value) => {
        const camelKey = toCamelCase(columnName);
        if (columnName in row) row[columnName] = value;
        else row[camelKey] = value;
    };

    function projectRow(row, selectShape) {
        if (!selectShape) return row;

        const projected = {};
        for (const [alias, column] of Object.entries(selectShape)) {
            const columnName = column?.name || alias;
            projected[alias] = getColumnValue(row, columnName);
        }
        return projected;
    }

    function matchesWhere(row, expr) {
        if (!expr?.queryChunks) return true;

        const [, column, operatorChunk, rawValue] = expr.queryChunks;
        const columnName = column?.name;
        const operator = operatorChunk?.value?.[0]?.trim();
        const rowValue = getColumnValue(row, columnName);
        const comparisonValue = rawValue?.value ?? rawValue;

        if (operator === '=') {
            return rowValue === comparisonValue;
        }

        if (operator === 'IN') {
            return Array.isArray(comparisonValue) ? comparisonValue.includes(rowValue) : false;
        }

        return true;
    }

    const createChainableMock = (tableName = null, mode = 'select', selectShape = null) => {
        let currentTable = tableName;
        let filters = [];
        let maxRows = null;
        let updateValues = null;
        let insertedRows = [];

        const execute = async () => {
            const tableRows = currentTable && mockStore[currentTable] ? mockStore[currentTable] : [];
            const filteredRows = tableRows.filter((row) => filters.every((expr) => matchesWhere(row, expr)));

            if (mode === 'select') {
                const rows = filteredRows.slice(0, maxRows ?? filteredRows.length);
                return rows.map((row) => projectRow(row, selectShape));
            }

            if (mode === 'insert') {
                return insertedRows;
            }

            if (mode === 'delete') {
                if (filters.length === 0) {
                    mockStore[currentTable] = [];
                } else {
                    mockStore[currentTable] = tableRows.filter((row) => !filters.every((expr) => matchesWhere(row, expr)));
                }
                return [];
            }

            if (mode === 'update') {
                for (const row of filteredRows) {
                    for (const [key, value] of Object.entries(updateValues || {})) {
                        setColumnValue(row, key, value);
                    }
                }
                return filteredRows;
            }

            return [];
        };

        const mock = {
            from: (tableObj) => {
                currentTable = getTableName(tableObj);
                return mock;
            },
            where: (expr) => {
                filters.push(expr);
                return mock;
            },
            limit: (count) => {
                maxRows = count;
                return mock;
            },
            orderBy: () => mock,
            innerJoin: () => mock,
            leftJoin: () => mock,
            for: () => mock,
            values: (data) => {
                if (currentTable && mockStore[currentTable]) {
                    const entries = Array.isArray(data) ? data : [data];
                    entries.forEach(e => {
                        const entry = { ...e };
                        if (!entry.id) entry.id = Math.random().toString(36).substring(7);
                        mockStore[currentTable].push(entry);
                        insertedRows.push(entry);
                    });
                }
                return mock;
            },
            set: (data) => {
                updateValues = data;
                return mock;
            },
            returning: () => {
                return {
                    then: (resolve) => {
                        execute().then(resolve);
                    }
                };
            },
            then: (resolve) => {
                execute().then(resolve);
            }
        };
        return mock;
    };

    const api = {
        __isMock: true,
        select: (fields) => createChainableMock(null, 'select', fields || null),
        insert: (tableObj) => {
            const tName = getTableName(tableObj);
            return createChainableMock(tName, 'insert');
        },
        update: (tableObj) => {
            const tName = getTableName(tableObj);
            return createChainableMock(tName, 'update');
        },
        delete: (tableObj) => {
            const tName = getTableName(tableObj);
            return createChainableMock(tName, 'delete');
        },
        execute: async () => [],
        transaction: async (cb) => cb(api),
    };

    return api;
}
