#!/usr/bin/env npx tsx
/**
 * Simulation Script: Trigger a fake Sentry alert for testing
 * 
 * Usage:
 *   npx tsx scripts/trigger_alert.ts
 */

import 'dotenv/config';
import { TriageAgent } from '../src/agents/suite/TriageAgent.js';

async function main() {
    console.log('[Test] Simulating production incident...');
    console.log('---');

    const agent = new TriageAgent();

    // Simulate a database connection error
    const result = await agent.runTriage({
        source: 'manual',
        alertId: 'TEST-001',
        title: 'ConnectionError: Unable to connect to database',
        message: 'psycopg2.OperationalError: could not connect to server: Connection refused',
        level: 'error',
        timestamp: new Date().toISOString(),
        metadata: {
            projectSlug: 'agentcache-api',
            environment: 'production',
            release: 'v2.3.1',
            stackTrace: `  at connect (db/client.js:42)
  at getConnection (db/pool.js:18)
  at query (db/query.js:53)
  at UserService.getById (services/users.ts:127)
  at handler (api/users/[id].ts:14)`,
            tags: {
                browser: 'Chrome',
                os: 'macOS'
            }
        }
    });

    console.log('---');
    console.log('[Test] Triage Result:');
    console.log(`  Severity: ${result.severity}`);
    console.log(`  Root Cause: ${result.rootCause}`);
    console.log(`  Remediation: ${result.remediation.join(', ')}`);
    console.log('---');
    console.log('[Test] Check #incidents channel for Slack notification.');
}

main().catch(console.error);
