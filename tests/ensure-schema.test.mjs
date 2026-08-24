// tests/ensure-schema.test.mjs
//   node tests/ensure-schema.test.mjs
//
// The self-provisioning schema must be idempotent, memoized (run once per
// process), and fail open (a DB hiccup returns false + allows a later retry,
// never throws into the request path).

import assert from 'node:assert/strict';
import { ensureSavingsSchema, ensureGovernanceSchema, _resetSchemaCache } from '../lib/ensure-schema.js';

let passed = 0;
const test = (n, f) => { f(); passed++; console.log('  ✓ ' + n); };
const atest = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('ensure-schema');

const fakeSql = (log) => (strings) => { log.push(strings.join(' ? ')); return Promise.resolve([]); };

await atest('savings schema creates the table + both indexes', async () => {
  _resetSchemaCache();
  const log = [];
  const ok = await ensureSavingsSchema(fakeSql(log));
  assert.equal(ok, true);
  assert.equal(log.length, 3); // table + 2 indexes
  assert.ok(log[0].includes('CREATE TABLE IF NOT EXISTS savings_events'));
  assert.ok(log.some((s) => s.includes('idx_savings_events_org_ts')));
});

await atest('governance schema creates its table', async () => {
  _resetSchemaCache();
  const log = [];
  const ok = await ensureGovernanceSchema(fakeSql(log));
  assert.equal(ok, true);
  assert.equal(log.length, 1);
  assert.ok(log[0].includes('CREATE TABLE IF NOT EXISTS governance_policies'));
});

await atest('memoized: a second call does NOT hit the DB again', async () => {
  _resetSchemaCache();
  const log = [];
  const sql = fakeSql(log);
  await ensureSavingsSchema(sql);
  await ensureSavingsSchema(sql);
  await ensureSavingsSchema(sql);
  assert.equal(log.length, 3); // still just the first run's 3 statements
});

await atest('fails OPEN: a throwing DB returns false and allows a later retry', async () => {
  _resetSchemaCache();
  let attempts = 0;
  const flaky = (strings) => { attempts++; if (attempts <= 1) throw new Error('db down'); return Promise.resolve([]); };
  const first = await ensureSavingsSchema(flaky);
  assert.equal(first, false);        // fail open, no throw
  const second = await ensureSavingsSchema(flaky); // retry allowed after failure
  assert.equal(second, true);
});

console.log('\n' + passed + ' passed');
