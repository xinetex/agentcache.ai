import { db } from '../src/db/client.js';
import { agentConnectionService } from '../src/services/AgentConnectionService.js';

async function main() {
  if (!process.argv.includes('--apply')) {
    console.error('Refusing to change encrypted credentials without the explicit --apply flag.');
    process.exitCode = 2;
    return;
  }
  if (!process.env.DATABASE_URL?.trim() || db.__isMock) {
    console.error('A reachable DATABASE_URL is required; mock storage is not allowed for key rotation.');
    process.exitCode = 2;
    return;
  }

  let totalExamined = 0;
  let totalReencrypted = 0;
  let batchNumber = 0;
  while (true) {
    batchNumber += 1;
    const result = await agentConnectionService.reencryptOldCredentialsBatch(100);
    totalExamined += result.examined;
    totalReencrypted += result.reencrypted;
    console.log(`Batch ${batchNumber}: examined=${result.examined} re-encrypted=${result.reencrypted} conflicts=${result.conflicts}`);
    if (result.conflicts > 0) {
      throw new Error('Rotation stopped on compare-and-set conflicts. Re-run after concurrent credential changes settle.');
    }
    if (!result.hasMore) break;
    if (result.reencrypted === 0) {
      throw new Error('Rotation made no progress while older key versions remain. Check the keyring and retry.');
    }
  }
  console.log(`Connection key rotation complete: examined=${totalExamined} re-encrypted=${totalReencrypted}.`);
  console.log('Keep previous keys available until this operation completes successfully in every environment.');
}

main().catch((error) => {
  console.error(`Connection key rotation failed: ${error?.message || 'unknown_error'}`);
  process.exitCode = 1;
});
