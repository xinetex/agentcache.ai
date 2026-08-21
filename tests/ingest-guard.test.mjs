// tests/ingest-guard.test.mjs
//   node tests/ingest-guard.test.mjs

import assert from 'node:assert/strict';
import { ingestRecord, detectPII, redactPII, policyFor } from '../lib/ingest-guard.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

const pd = { id: 'sec-edgar', name: 'SEC EDGAR', license: 'public-domain', endpoint: 'https://data.sec.gov' };
const ccby = { id: 'worldbank', name: 'World Bank', license: 'cc-by', endpoint: 'https://api.worldbank.org/v2' };
const restricted = { id: 'commoncrawl', name: 'Common Crawl', license: 'restricted', endpoint: 'https://data.commoncrawl.org' };
const unknown = { id: 'mystery', name: 'Mystery', license: 'unknown' };

console.log('ingest-guard');

test('restricted license fails closed (skip)', () => {
  const r = ingestRecord(restricted, { id: '1', text: 'some web page text' });
  assert.equal(r.action, 'skip');
  assert.equal(r.reason, 'license:restricted');
  assert.equal(r.provenance.sourceId, 'commoncrawl');
});

test('unknown license fails closed', () => {
  const r = ingestRecord(unknown, { text: 'anything' });
  assert.equal(r.action, 'skip');
});

test('public-domain clean text caches as-is with provenance', () => {
  const r = ingestRecord(pd, { id: '10-K', text: 'Total revenue increased 12% year over year.' });
  assert.equal(r.action, 'cache');
  assert.equal(r.requireAttribution, false);
  assert.equal(r.provenance.license, 'public-domain');
  assert.ok(r.provenance.retrievedAt);
});

test('cc-by requires attribution', () => {
  const r = ingestRecord(ccby, { text: 'GDP grew 3.1%.' });
  assert.equal(r.action, 'cache');
  assert.equal(r.requireAttribution, true);
});

test('PII in a permitted source is redacted, not skipped', () => {
  const r = ingestRecord(pd, { id: 'd', text: 'Contact jane.doe@example.com or 415-555-0142, SSN 123-45-6789.' });
  assert.equal(r.action, 'redact-cache');
  assert.ok(!r.text.includes('jane.doe@example.com'));
  assert.ok(r.text.includes('[REDACTED:email]'));
  assert.ok(r.text.includes('[REDACTED:ssn]'));
  const types = r.piiFound.map(f => f.type).sort();
  assert.deepEqual(types, ['email', 'phone', 'ssn']);
});

test('PII in a restricted source is still skipped (license wins first)', () => {
  const r = ingestRecord(restricted, { text: 'email a@b.com' });
  assert.equal(r.action, 'skip'); // never even reaches the PII stage
});

test('detectPII finds emails, ssn, phone, ip', () => {
  const f = detectPII('a@b.co 10.0.0.1 555-123-4567 111-22-3333');
  const types = f.map(x => x.type).sort();
  assert.ok(types.includes('email') && types.includes('ip') && types.includes('phone') && types.includes('ssn'));
});

test('redactPII is reversible in shape and reports counts', () => {
  const { redacted, found } = redactPII('x@y.com and z@w.com');
  assert.equal((redacted.match(/\[REDACTED:email\]/g) || []).length, 2);
  assert.equal(found.find(f => f.type === 'email').count, 2);
});

test('policyFor unknown key defaults to no-redistribute', () => {
  assert.equal(policyFor('nonsense').redistribute, false);
  assert.equal(policyFor('cc0').redistribute, true);
});

console.log('\n' + passed + ' passed');
