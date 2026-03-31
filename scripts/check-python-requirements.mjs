import { readFile } from 'node:fs/promises';

const requirementFiles = [
  'sdk/python/requirements.txt',
  'transcoder-service/requirements.txt',
];

const strictSpecifier = /^(?<name>[A-Za-z0-9_.-]+)(\[[A-Za-z0-9_,.-]+\])?==(?<version>[A-Za-z0-9*+!._-]+)$/;

const errors = [];

for (const file of requirementFiles) {
  const raw = await readFile(file, 'utf8');
  const lines = raw.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (trimmed.startsWith('-r ') || trimmed.startsWith('--requirement ')) return;
    if (!strictSpecifier.test(trimmed)) {
      errors.push(`${file}:${index + 1} must use an exact == pin. Found: ${trimmed}`);
    }
  });
}

if (errors.length > 0) {
  console.error('Python dependency policy check failed.\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error('\nUse exact pins in tracked requirements files. Prefer hash-locked installs in CI and isolated environments.');
  process.exit(1);
}

console.log(`Python dependency policy check passed for ${requirementFiles.length} files.`);
