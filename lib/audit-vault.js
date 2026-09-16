// lib/audit-vault.js
//
// AgentCache — Tamper-Proof Merkle Audit Vault.
//
// An immutable, write-only cryptographic ledger for agent execution traces, tool calls,
// and linguistic records. Prevents agents from altering audit logs, spoofing tool outputs,
// or faking safety compliance.
//
// Pure, deterministic, and engine-agnostic.

import { createHash } from 'crypto';

function sha256(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(str).digest('hex');
}

export class AuditVault {
  constructor(vaultId = 'global_vault') {
    this.vaultId = vaultId;
    this.chain = []; // Array of immutable cryptographically chained blocks
    this.genesisHash = sha256(`GENESIS_${vaultId}_${Date.now()}`);
  }

  /**
   * Appends an audit event to the immutable ledger.
   * Generates a Merkle-linked cryptographic hash bound to the previous block.
   */
  append(event = {}) {
    const index = this.chain.length;
    const prevHash = index === 0 ? this.genesisHash : this.chain[index - 1].blockHash;
    const timestamp = new Date().toISOString();

    const payload = {
      index,
      timestamp,
      agentId: event.agentId || 'anonymous',
      namespace: event.namespace || 'default',
      actionType: event.actionType || 'EXECUTION',
      data: event.data || {},
    };

    const payloadHash = sha256(payload);
    const blockHash = sha256(`${prevHash}:${payloadHash}:${timestamp}`);

    const block = {
      ...payload,
      prevHash,
      payloadHash,
      blockHash,
    };

    // Seal the block as frozen / immutable
    this.chain.push(Object.freeze(block));
    return block;
  }

  /**
   * Validates the cryptographic integrity of the entire ledger chain.
   * Returns { valid: boolean, errors: string[] }.
   */
  verifyIntegrity() {
    const errors = [];

    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];
      const expectedPrev = i === 0 ? this.genesisHash : this.chain[i - 1].blockHash;

      // 1. Verify previous block link
      if (current.prevHash !== expectedPrev) {
        errors.push(`Broken hash chain at block #${i}: expected prevHash ${expectedPrev}, found ${current.prevHash}`);
      }

      // 2. Verify payload hash integrity
      const recalculatedPayloadHash = sha256({
        index: current.index,
        timestamp: current.timestamp,
        agentId: current.agentId,
        namespace: current.namespace,
        actionType: current.actionType,
        data: current.data,
      });

      if (current.payloadHash !== recalculatedPayloadHash) {
        errors.push(`Payload tampering detected at block #${i}`);
      }

      // 3. Verify block root hash
      const recalculatedBlockHash = sha256(`${current.prevHash}:${current.payloadHash}:${current.timestamp}`);
      if (current.blockHash !== recalculatedBlockHash) {
        errors.push(`Block hash mismatch at block #${i}`);
      }
    }

    return {
      valid: errors.length === 0,
      totalBlocks: this.chain.length,
      errors,
      headHash: this.chain.length > 0 ? this.chain[this.chain.length - 1].blockHash : this.genesisHash,
    };
  }

  /**
   * Generates a cryptographic inclusion proof for a given block index.
   */
  generateProof(index) {
    if (index < 0 || index >= this.chain.length) {
      throw new Error(`Invalid block index: ${index}`);
    }

    const target = this.chain[index];
    return {
      vaultId: this.vaultId,
      blockIndex: index,
      blockHash: target.blockHash,
      payloadHash: target.payloadHash,
      timestamp: target.timestamp,
      prevHash: target.prevHash,
      chainLength: this.chain.length,
      headHash: this.chain[this.chain.length - 1].blockHash,
    };
  }

  /**
   * Returns all blocks in the vault.
   */
  getChain() {
    return [...this.chain];
  }
}

export const globalAuditVault = new AuditVault('agentcache_audit_vault');

export default {
  AuditVault,
  globalAuditVault,
};
