import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { verifyLyveStorage } from '../src/lib/storage/lyveVerification.js';

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export async function verifyLyveStorageScript() {
  const objectKey = getArg('--key');
  const json = hasFlag('--json');
  const result = await verifyLyveStorage(objectKey ? { objectKey } : {});

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log('--- 📦 Lyve Storage Verification ---');
  console.log(`Endpoint: ${result.config.endpoint || 'unset'}`);
  console.log(`Bucket: ${result.config.bucket || 'unset'}`);
  console.log(`Region: ${result.config.region || 'unset'}`);
  console.log(`Inferred Region: ${result.config.inferredRegion || 'unknown'}`);
  console.log(`Credentials Present: ${result.config.hasCredentials ? 'yes' : 'no'}`);
  console.log(`Object Key Present: ${result.config.hasObjectKey ? 'yes' : 'no'}`);

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log('\nChecks:');
  console.log(`- Endpoint: ${result.checks.endpoint.status} (${result.checks.endpoint.detail})`);
  console.log(`- List Scope: ${result.checks.listScope.status} (${result.checks.listScope.detail})`);
  console.log(`- Object Scope: ${result.checks.objectScope.status} (${result.checks.objectScope.detail})`);

  console.log('\nSummary:');
  console.log(`- Reachable: ${result.summary.reachable ? 'yes' : 'no'}`);
  console.log(`- Least Privilege Likely: ${result.summary.leastPrivilegeLikely ? 'yes' : 'no'}`);
  console.log(`- Object-Scoped Ready: ${result.summary.objectScopedReady ? 'yes' : 'no'}`);

  return result;
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  verifyLyveStorageScript()
    .then((result) => {
      process.exitCode = result.summary.reachable ? 0 : 1;
    })
    .catch((error) => {
      console.error('❌ Lyve verification failed:', error);
      process.exit(1);
    });
}
