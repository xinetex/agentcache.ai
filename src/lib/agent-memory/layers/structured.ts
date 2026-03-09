/**
 * Structured Layer - Relational storage for structured data
 * 
 * Handles: configs, policies, agent profiles, relationships
 * Backends: Neon PostgreSQL (production), In-memory (dev)
 */

interface StructuredRecord {
  key: string;
  value: any;
  metadata: {
    namespace: string;
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
    lastAccess: Date;
    tier: string;
    tags: string[];
    checksum: string;
    size: number;
  };
}

export class StructuredLayer {
  private localStore = new Map<string, StructuredRecord>();
  private db: any = null; // PostgreSQL connection

  constructor() {
    this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    if (process.env.DATABASE_URL) {
      try {
        // Dynamic import to avoid bundling issues
        const { neon } = await import('@neondatabase/serverless');
        this.db = neon(process.env.DATABASE_URL);
        console.log('[StructuredLayer] Connected to Neon PostgreSQL');

        // Ensure table exists
        await this.ensureTable();
      } catch (error) {
        console.warn('[StructuredLayer] DB init failed, using local store:', error);
      }
    } else {
      console.warn('[StructuredLayer] No DATABASE_URL, using local store');
    }
  }

  private async ensureTable(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db`
        CREATE TABLE IF NOT EXISTS agent_memory (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          namespace TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          last_access TIMESTAMPTZ DEFAULT NOW(),
          tier TEXT DEFAULT 'warm',
          tags TEXT[] DEFAULT '{}',
          checksum TEXT,
          size INTEGER DEFAULT 0
        )
      `;

      await this.db`
        CREATE INDEX IF NOT EXISTS idx_agent_memory_namespace 
        ON agent_memory(namespace)
      `;

      await this.db`
        CREATE INDEX IF NOT EXISTS idx_agent_memory_tags 
        ON agent_memory USING GIN(tags)
      `;
    } catch (error) {
      console.warn('[StructuredLayer] Table creation warning:', error);
    }
  }

  /**
   * Upsert record
   */
  async upsert(key: string, value: any, metadata: StructuredRecord['metadata']): Promise<void> {
    const record: StructuredRecord = { key, value, metadata };

    if (this.db) {
      try {
        await this.db`
          INSERT INTO agent_memory (
            key, value, namespace, created_at, updated_at, 
            access_count, last_access, tier, tags, checksum, size
          ) VALUES (
            ${key}, ${JSON.stringify(value)}, ${metadata.namespace},
            ${metadata.createdAt}, ${metadata.updatedAt},
            ${metadata.accessCount}, ${metadata.lastAccess},
            ${metadata.tier}, ${metadata.tags}, ${metadata.checksum}, ${metadata.size}
          )
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = EXCLUDED.updated_at,
            tier = EXCLUDED.tier,
            tags = EXCLUDED.tags,
            checksum = EXCLUDED.checksum,
            size = EXCLUDED.size
        `;
      } catch (error) {
        console.error('[StructuredLayer] Upsert failed:', error);
      }
    }

    // Always store locally
    this.localStore.set(key, record);
  }

  /**
   * Get record by key
   */
  async get(key: string): Promise<any | null> {
    // Check local first
    const local = this.localStore.get(key);
    if (local) return local.value;

    if (this.db) {
      try {
        const result = await this.db`
          SELECT value FROM agent_memory WHERE key = ${key}
        `;
        if (result.length > 0) {
          return result[0].value;
        }
      } catch (error) {
        console.error('[StructuredLayer] Get failed:', error);
      }
    }

    return null;
  }

  /**
   * Get metadata
   */
  async getMetadata(key: string): Promise<StructuredRecord['metadata'] | undefined> {
    const local = this.localStore.get(key);
    if (local) return local.metadata;

    if (this.db) {
      try {
        const result = await this.db`
          SELECT namespace, created_at, updated_at, access_count, 
                 last_access, tier, tags, checksum, size
          FROM agent_memory WHERE key = ${key}
        `;
        if (result.length > 0) {
          const r = result[0];
          return {
            namespace: r.namespace,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            accessCount: r.access_count,
            lastAccess: r.last_access,
            tier: r.tier,
            tags: r.tags,
            checksum: r.checksum,
            size: r.size,
          };
        }
      } catch (error) {
        console.error('[StructuredLayer] GetMetadata failed:', error);
      }
    }

    return undefined;
  }

  /**
   * Delete record
   */
  async delete(key: string): Promise<void> {
    if (this.db) {
      try {
        await this.db`DELETE FROM agent_memory WHERE key = ${key}`;
      } catch (error) {
        console.error('[StructuredLayer] Delete failed:', error);
      }
    }
    this.localStore.delete(key);
  }

  /**
   * Find records by tags
   */
  async findByTags(
    namespace: string,
    tags: string[],
    limit: number = 100
  ): Promise<StructuredRecord[]> {
    if (this.db) {
      try {
        const result = await this.db`
          SELECT key, value, namespace, created_at, updated_at,
                 access_count, last_access, tier, tags, checksum, size
          FROM agent_memory
          WHERE namespace = ${namespace}
            AND tags && ${tags}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `;

        return result.map((r: any) => ({
          key: r.key,
          value: r.value,
          metadata: {
            namespace: r.namespace,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            accessCount: r.access_count,
            lastAccess: r.last_access,
            tier: r.tier,
            tags: r.tags,
            checksum: r.checksum,
            size: r.size,
          },
        }));
      } catch (error) {
        console.error('[StructuredLayer] FindByTags failed:', error);
      }
    }

    // Local fallback
    const results: StructuredRecord[] = [];
    for (const record of Array.from(this.localStore.values())) {
      if (record.metadata.namespace === namespace) {
        const hasTag = tags.some(t => record.metadata.tags.includes(t));
        if (hasTag) {
          results.push(record);
        }
      }
    }
    return results.slice(0, limit);
  }

  /**
   * Increment access count
   */
  async incrementAccess(key: string): Promise<void> {
    const now = new Date();

    if (this.db) {
      try {
        await this.db`
          UPDATE agent_memory 
          SET access_count = access_count + 1, last_access = ${now}
          WHERE key = ${key}
        `;
      } catch (error) {
        // Ignore access tracking errors
      }
    }

    const local = this.localStore.get(key);
    if (local) {
      local.metadata.accessCount++;
      local.metadata.lastAccess = now;
    }
  }

  /**
   * Find by namespace
   */
  async findByNamespace(namespace: string, limit: number = 1000): Promise<StructuredRecord[]> {
    if (this.db) {
      try {
        const result = await this.db`
          SELECT key, value, namespace, created_at, updated_at,
                 access_count, last_access, tier, tags, checksum, size
          FROM agent_memory
          WHERE namespace = ${namespace}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `;

        return result.map((r: any) => ({
          key: r.key,
          value: r.value,
          metadata: {
            namespace: r.namespace,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            accessCount: r.access_count,
            lastAccess: r.last_access,
            tier: r.tier,
            tags: r.tags,
            checksum: r.checksum,
            size: r.size,
          },
        }));
      } catch (error) {
        console.error('[StructuredLayer] FindByNamespace failed:', error);
      }
    }

    // Local fallback
    return Array.from(this.localStore.values())
      .filter(r => r.metadata.namespace === namespace)
      .slice(0, limit);
  }
}

export default StructuredLayer;
