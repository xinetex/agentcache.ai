#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Validator } from '@cfworker/json-schema';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playbooksRoot = path.join(repoRoot, 'public', 'playbooks');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const index = await readJson(path.join(playbooksRoot, 'index.json'));
const schema = await readJson(path.join(playbooksRoot, 'schema.json'));
const validator = new Validator(schema, '2020-12', false);

if (!Array.isArray(index.playbooks) || index.playbooks.length < 3) {
  throw new Error('Milestone I0 requires at least three example playbooks.');
}

const ids = new Set();
for (const entry of index.playbooks) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`Missing or duplicate playbook id: ${entry.id}`);
  ids.add(entry.id);
  for (const kind of ['human', 'machine', 'script']) {
    const publicPath = entry.formats?.[kind];
    if (!publicPath?.startsWith('/playbooks/')) throw new Error(`${entry.id}: missing local ${kind} path`);
    const diskPath = path.resolve(repoRoot, 'public', publicPath.slice(1));
    if (!diskPath.startsWith(`${playbooksRoot}${path.sep}`)) throw new Error(`${entry.id}: ${kind} path escapes playbook directory`);
    await readFile(diskPath);
  }
  const previewPath = entry.preview?.src;
  if (!previewPath?.startsWith('/playbooks/previews/') || !entry.preview?.alt?.trim()) {
    throw new Error(`${entry.id}: preview image and accessible alt text are required`);
  }
  const previewDiskPath = path.resolve(repoRoot, 'public', previewPath.slice(1));
  if (!previewDiskPath.startsWith(`${playbooksRoot}${path.sep}`)) throw new Error(`${entry.id}: preview path escapes playbook directory`);
  await readFile(previewDiskPath);
  const samplePath = entry.sample_project;
  if (!samplePath?.startsWith('/playbooks/samples/')) throw new Error(`${entry.id}: sample project path is required`);
  const sampleDiskPath = path.resolve(repoRoot, 'public', samplePath.slice(1));
  if (!sampleDiskPath.startsWith(`${playbooksRoot}${path.sep}`)) throw new Error(`${entry.id}: sample path escapes playbook directory`);
  await readFile(sampleDiskPath);

  const record = await readJson(path.join(repoRoot, 'public', entry.formats.machine.slice(1)));
  const result = validator.validate(record);
  if (!result.valid) {
    const issues = result.errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('\n');
    throw new Error(`${entry.id} does not meet the playbook schema:\n${issues}`);
  }
  if (record.id !== entry.id) throw new Error(`${entry.id}: index and machine record ids differ`);
  if (record.status !== entry.status) throw new Error(`${entry.id}: index and machine record statuses differ`);
  if (entry.app_version !== `Blender ${record.app_version.tested}`) throw new Error(`${entry.id}: indexed app version differs from machine record`);
  if (record.sample_project_url !== entry.sample_project) throw new Error(`${entry.id}: sample project URL differs between index and record`);
  if (record.execution.script_url !== entry.formats.script) throw new Error(`${entry.id}: script URL does not match the index`);
  if (record.status === 'verified' && (record.verification.runs < 2 || !record.verification.project_reopened)) {
    throw new Error(`${entry.id}: verified status requires two runs and a reopened project`);
  }
}

console.log(`Validated ${index.playbooks.length} playbook record(s), source review metadata, and linked files.`);
