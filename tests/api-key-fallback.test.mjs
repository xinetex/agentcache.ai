// tests/api-key-fallback.test.mjs
//   node tests/api-key-fallback.test.mjs
//
// The activation fix: a key registered in the Redis signup world must resolve
// to the SAME context shape as a Postgres org key, so the whole control-plane
// API accepts it. Tests the pure mapping (buildRedisContext).

import assert from 'node:assert/strict';

// api-key-middleware constructs neon(DATABASE_URL) at import; give it a dummy so
// the import doesn't throw in a DB-less test env.
process.env.DATABASE_URL ||= 'postgres://user:pass@localhost/db';
const { buildRedisContext } = await import('../lib/api-key-middleware.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

console.log('api-key-fallback');

const HASH = 'a'.repeat(64);

test('empty / missing record returns null (no fabricated identity)', () => {
  assert.equal(buildRedisContext(HASH, null), null);
  assert.equal(buildRedisContext(HASH, {}), null);
  assert.equal(buildRedisContext(HASH, { plan: 'pro' }), null); // no email/name
});

test('a real account record maps to the org-key context shape', () => {
  const ctx = buildRedisContext(HASH, { email: 'dev@acme.com', plan: 'pro' });
  assert.equal(ctx.organizationId, 'redis:' + HASH);       // namespaced — never collides with a UUID
  assert.equal(ctx.organizationName, 'dev@acme.com');
  assert.equal(ctx.planTier, 'pro');
  assert.equal(ctx.identitySource, 'redis');
  assert.deepEqual(ctx.allowedNamespaces, []);              // unrestricted
});

test('slug is a stable, collision-safe cache-key prefix', () => {
  const a = buildRedisContext(HASH, { email: 'x@y.z' });
  const b = buildRedisContext(HASH, { email: 'x@y.z' });
  assert.equal(a.organizationSlug, b.organizationSlug);     // deterministic
  assert.ok(a.organizationSlug.startsWith('u_'));           // won't collide with real org slugs
  assert.equal(a.organizationSlug, 'u_' + HASH.slice(0, 16));
});

test('plan defaults to starter when absent', () => {
  assert.equal(buildRedisContext(HASH, { name: 'CI Bot' }).planTier, 'starter');
});

console.log('\n' + passed + ' passed');
