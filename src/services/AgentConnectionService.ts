import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { agentConnections } from '../db/schema.js';
import { db } from '../db/client.js';

export type AgentConnectionStatus = 'active' | 'revoked';
export type AgentConnectionVerificationStatus = 'unverified' | 'verified' | 'expired';

export interface AgentConnectionRecord {
  id: string;
  ownerPrincipalId: string;
  orgId: string | null;
  provider: string;
  displayName: string | null;
  scopes: string[];
  status: AgentConnectionStatus;
  verificationStatus: AgentConnectionVerificationStatus;
  encryptedCredentials: string | null;
  encryptionKeyVersion: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface PublicAgentConnection {
  id: string;
  provider: string;
  displayName: string | null;
  scopes: string[];
  status: AgentConnectionStatus;
  verificationStatus: AgentConnectionVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

function decodeKey(configured: string | undefined): Buffer {
  if (!configured) throw new Error('connection_encryption_unavailable');
  const value = configured.trim();
  if (!/^[0-9a-f]{64}$/i.test(value)
    && (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1)) {
    throw new Error('connection_encryption_unavailable');
  }
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (!/^[0-9a-f]{64}$/i.test(value)
    && value !== key.toString('base64')
    && value !== key.toString('base64').replace(/=+$/, '')) {
    throw new Error('connection_encryption_unavailable');
  }
  if (key.length !== 32) throw new Error('connection_encryption_unavailable');
  return key;
}

function currentKeyVersion(): string {
  const version = process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY_VERSION?.trim() || 'v1';
  if (!/^[a-zA-Z0-9_-]{1,16}$/.test(version)) throw new Error('connection_encryption_unavailable');
  return version;
}

function encryptionKey(version: string): Buffer {
  const configured = process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (version === currentKeyVersion()) return decodeKey(configured);

  let keyring: Record<string, string>;
  try {
    keyring = JSON.parse(process.env.AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING || '{}');
  } catch {
    throw new Error('connection_encryption_unavailable');
  }
  return decodeKey(keyring[version]);
}

function associatedData(id: string, ownerPrincipalId: string): Buffer {
  return Buffer.from(`agentcache-connection:${id}:${ownerPrincipalId}`, 'utf8');
}

function encryptCredentials(credentials: Record<string, unknown>, id: string, ownerPrincipalId: string): { envelope: string; keyVersion: string } {
  const keyVersion = currentKeyVersion();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(keyVersion), iv);
  cipher.setAAD(associatedData(id, ownerPrincipalId));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  return {
    envelope: `${keyVersion}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`,
    keyVersion,
  };
}

function decryptCredentials(envelope: string, keyVersion: string, id: string, ownerPrincipalId: string): Record<string, unknown> {
  const [version, ivPart, tagPart, ciphertextPart] = envelope.split('.');
  if (version !== keyVersion || !ivPart || !tagPart || !ciphertextPart) throw new Error('connection_credentials_unavailable');

  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(version), Buffer.from(ivPart, 'base64url'));
    decipher.setAAD(associatedData(id, ownerPrincipalId));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid_credentials');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('connection_credentials_unavailable');
  }
}

function publicConnection(record: AgentConnectionRecord): PublicAgentConnection {
  return {
    id: record.id,
    provider: record.provider,
    displayName: record.displayName,
    scopes: Array.isArray(record.scopes) ? record.scopes : [],
    status: record.status,
    verificationStatus: record.verificationStatus || 'unverified',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
  };
}

export class AgentConnectionService {
  async create(input: {
    ownerPrincipalId: string;
    orgId?: string | null;
    provider: string;
    displayName?: string | null;
    scopes: string[];
    credentials: Record<string, unknown>;
  }): Promise<PublicAgentConnection> {
    const id = randomUUID();
    const createdAt = new Date();
    const encrypted = encryptCredentials(input.credentials, id, input.ownerPrincipalId);
    const record = {
      id,
      ownerPrincipalId: input.ownerPrincipalId,
      orgId: input.orgId || null,
      provider: input.provider,
      displayName: input.displayName || null,
      scopes: input.scopes,
      status: 'active' as const,
      verificationStatus: 'unverified' as const,
      encryptedCredentials: encrypted.envelope,
      encryptionKeyVersion: encrypted.keyVersion,
      createdAt,
      updatedAt: createdAt,
      lastUsedAt: null,
      revokedAt: null,
    };
    const rows = await db.insert(agentConnections).values(record).returning();
    const stored = (rows[0] || record) as AgentConnectionRecord;
    return publicConnection(stored);
  }

  async listOwned(ownerPrincipalId: string, limit = 50): Promise<PublicAgentConnection[]> {
    const rows = await db.select().from(agentConnections)
      .where(eq(agentConnections.ownerPrincipalId, ownerPrincipalId))
      .orderBy(desc(agentConnections.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return (rows as AgentConnectionRecord[]).map(publicConnection);
  }

  async getOwned(id: string, ownerPrincipalId: string): Promise<AgentConnectionRecord | null> {
    const rows = await db.select().from(agentConnections)
      .where(eq(agentConnections.id, id)).limit(1);
    const record = rows[0] as AgentConnectionRecord | undefined;
    return record?.ownerPrincipalId === ownerPrincipalId ? record : null;
  }

  async getCredentialsForInvocation(id: string, ownerPrincipalId: string): Promise<Record<string, unknown> | null> {
    const record = await this.getOwned(id, ownerPrincipalId);
    if (!record || record.status !== 'active' || !record.encryptedCredentials) return null;
    return decryptCredentials(record.encryptedCredentials, record.encryptionKeyVersion, record.id, ownerPrincipalId);
  }

  /** Re-encrypt at most `limit` active connection envelopes with the current key.
   * Compare-and-set on both recorded version and ciphertext so concurrent revoke,
   * replacement, or rotation cannot overwrite a newer credential state. */
  async reencryptOldCredentialsBatch(limit = 100): Promise<{ examined: number; reencrypted: number; conflicts: number; hasMore: boolean }> {
    const activeVersion = currentKeyVersion();
    // Validate the new key before selecting or changing any records.
    encryptionKey(activeVersion);
    const batchSize = Math.min(Math.max(Math.floor(limit) || 100, 1), 500);
    const candidates = await db.select().from(agentConnections)
      .where(and(
        eq(agentConnections.status, 'active'),
        ne(agentConnections.encryptionKeyVersion, activeVersion),
      ))
      .orderBy(asc(agentConnections.createdAt))
      .limit(batchSize) as AgentConnectionRecord[];

    let reencrypted = 0;
    let conflicts = 0;
    for (const record of candidates) {
      if (!record.encryptedCredentials) {
        conflicts += 1;
        continue;
      }
      const credentials = decryptCredentials(
        record.encryptedCredentials,
        record.encryptionKeyVersion,
        record.id,
        record.ownerPrincipalId,
      );
      const encrypted = encryptCredentials(credentials, record.id, record.ownerPrincipalId);
      const updated = await db.update(agentConnections).set({
        encryptedCredentials: encrypted.envelope,
        encryptionKeyVersion: encrypted.keyVersion,
        updatedAt: new Date(),
      }).where(and(
        eq(agentConnections.id, record.id),
        eq(agentConnections.status, 'active'),
        eq(agentConnections.encryptionKeyVersion, record.encryptionKeyVersion),
        eq(agentConnections.encryptedCredentials, record.encryptedCredentials),
      )).returning();
      if (updated.length) reencrypted += 1;
      else conflicts += 1;
    }

    return { examined: candidates.length, reencrypted, conflicts, hasMore: candidates.length === batchSize };
  }

  async markVerified(id: string, ownerPrincipalId: string): Promise<PublicAgentConnection | null> {
    const record = await this.getOwned(id, ownerPrincipalId);
    if (!record || record.status !== 'active') return null;
    const updatedAt = new Date();
    const rows = await db.update(agentConnections).set({
      verificationStatus: 'verified',
      lastUsedAt: updatedAt,
      updatedAt,
    }).where(eq(agentConnections.id, id)).returning();
    return publicConnection((rows[0] || { ...record, verificationStatus: 'verified', lastUsedAt: updatedAt, updatedAt }) as AgentConnectionRecord);
  }

  async markExpired(id: string, ownerPrincipalId: string): Promise<PublicAgentConnection | null> {
    const record = await this.getOwned(id, ownerPrincipalId);
    if (!record || record.status !== 'active') return null;
    const updatedAt = new Date();
    const rows = await db.update(agentConnections).set({
      verificationStatus: 'expired',
      updatedAt,
    }).where(eq(agentConnections.id, id)).returning();
    return publicConnection((rows[0] || { ...record, verificationStatus: 'expired', updatedAt }) as AgentConnectionRecord);
  }

  async revokeOwned(id: string, ownerPrincipalId: string): Promise<PublicAgentConnection | null> {
    const record = await this.getOwned(id, ownerPrincipalId);
    if (!record) return null;
    if (record.status === 'revoked') return publicConnection(record);

    const revokedAt = new Date();
    const rows = await db.update(agentConnections).set({
      status: 'revoked',
      encryptedCredentials: null,
      revokedAt,
      updatedAt: revokedAt,
    }).where(eq(agentConnections.id, id)).returning();
    const updated = (rows[0] || { ...record, status: 'revoked', encryptedCredentials: null, revokedAt, updatedAt: revokedAt }) as AgentConnectionRecord;
    return publicConnection(updated);
  }
}

export const agentConnectionService = new AgentConnectionService();
