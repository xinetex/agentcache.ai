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
        agents: []
    };

    // Chainable Mock Helper with State
    const createChainableMock = (tableName = null, operation = 'select') => {
        let currentTable = tableName;
        let queryImpl = async () => [];

        const mock = {
            from: (tableObj) => {
                // Infer table name from Drizzle schema object if possible, or string
                currentTable = tableObj[Symbol.for('drizzle:Name')] || tableObj.u_; // .u_ is minified name property often
                // Fallback: simplified logic for our specific schema imports
                if (!currentTable && tableObj === schema.marketplaceListings) currentTable = 'marketplace_listings';
                if (!currentTable && tableObj === schema.ledgerAccounts) currentTable = 'ledger_accounts';
                if (!currentTable && tableObj === schema.ledgerTransactions) currentTable = 'ledger_transactions';
                if (!currentTable && tableObj === schema.marketplaceOrders) currentTable = 'marketplace_orders';
                if (!currentTable && tableObj === schema.agents) currentTable = 'agents';

                return mock;
            },
            where: (condition) => {
                // Attempt to filter mockStore based on Drizzle EQ condition
                if (currentTable && mockStore[currentTable] && condition) {
                    // Drizzle EQ often looks like { key: { name: 'colName' }, value: 'val' } OR internal structure
                    // We try to find the value and the key name.
                    // This is heuristic-based for the Mock.

                    let targetValue = condition.value;
                    let targetKey = condition.key?.name;

                    // Fallback for different Drizzle versions/structures
                    if (!targetKey && condition.u_) targetKey = condition.u_.name; // Minified

                    if (targetKey && targetValue !== undefined) {
                        // DEBUG: Log matching attempt
                        console.log(`[MockDB] Filtering ${currentTable} by ${targetKey}=${targetValue} (Camel: ${targetKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase())})`);

                        const filtered = mockStore[currentTable].filter(row => {
                            // console.log(`[MockDB] Row Keys: ${Object.keys(row)}`); // Very verbose, be careful
                            // Try exact match
                            if (row[targetKey] === targetValue) return true;
                            // Try camelCase match (e.g. owner_id -> ownerId)
                            const camelKey = targetKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                            if (row[camelKey] === targetValue) return true;
                            return false;
                        });

                        console.log(`[MockDB] Matched ${filtered.length} rows`);

                        queryImpl = async () => filtered;

                        // Update the .then / .returning to use this filtered result
                        return {
                            ...mock,
                            then: (resolve) => resolve(filtered),
                            returning: () => ({ then: (r) => r(filtered) })
                        };
                    } else {
                        // console.log("[MockDB] Failed to parse WHERE condition", condition);
                    }
                }
                return mock;
            },
            limit: () => mock,
            orderBy: () => mock,
            values: (data) => {
                if (currentTable && mockStore[currentTable]) {
                    const entries = Array.isArray(data) ? data : [data];
                    // Add mock IDs if missing
                    entries.forEach(e => { if (!e.id) e.id = Math.random().toString(36).substring(7); });
                    mockStore[currentTable].push(...entries);
                    queryImpl = async () => entries; // Return inserted items
                }
                return mock;
            },
            set: (data) => {
                // Update logic would go here. For now, simple mock returns updated.
                return mock;
            },
            returning: () => {
                // Execute the query
                return {
                    then: (resolve) => {
                        // For SELECT
                        if (operation === 'select' && currentTable) {
                            resolve(mockStore[currentTable] || []);
                        } else {
                            // For INSERT/UPDATE
                            queryImpl().then(resolve);
                        }
                    }
                };
            },
            onConflictDoNothing: () => mock, // Chainable no-op
            then: (resolve) => {
                // Implicit execution
                if (operation === 'select' && currentTable) {
                    resolve(mockStore[currentTable] || []);
                } else {
                    queryImpl().then(resolve);
                }
            }
        };
        return mock;
    };

    db = {
        select: () => createChainableMock(null, 'select'),
        insert: (tableObj) => {
            // Determine table early for Insert
            let tName = '';
            if (tableObj === schema.marketplaceListings) tName = 'marketplace_listings';
            if (tableObj === schema.ledgerAccounts) tName = 'ledger_accounts';
            // ... add others
            return createChainableMock(tName, 'insert');
        },
        update: () => createChainableMock(null, 'update'),
        delete: () => createChainableMock(null, 'delete'),
        execute: () => ([]),
        transaction: async (cb) => cb(db),
        query: {
            marketplaceListings: {
                findFirst: (opts) => {
                    // Simple mock: return first listing
                    return mockStore.marketplace_listings[0];
                },
                findMany: () => mockStore.marketplace_listings,
            }
        }
    };
} else {
    try {
        client = postgres(connectionString, {
            prepare: false,
            ssl: 'require', // Neon requires SSL always
            connect_timeout: 5 // Fail fast after 5s
        });
        console.log(`[DB] Connecting to REAL Database: ${connectionString.split('@')[1]}`);
        db = drizzle(client, { schema });
    } catch (error) {
        console.error('[DB] Failed to initialize database client:', error);
        // Fail safe: Mock Drizzle object to prevent crash on import
        // Any usage will throw or return undefined, but server will start.
        db = {
            select: () => ({ from: () => [] }),
            insert: () => ({ values: () => ({ returning: () => [] }) }),
            update: () => ({ set: () => ({ where: () => [] }) }),
            delete: () => ({ where: () => ({ returning: () => [] }) }),
            execute: () => ([]),
        };
    }
}
