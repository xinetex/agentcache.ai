import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// Types
export interface EdgeLocation {
  id: string;
  url: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  provider: string;
  is_active: boolean;
}

export interface EdgeMetric {
  edge_id: string;
  timestamp: Date;
  latency_ms: number;
  load_percent: number;
  bandwidth_mbps: number;
  active_uploads: number;
  error_rate: number;
}

export interface FileHash {
  file_hash: string;
  file_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  storage_key: string;
  mime_type: string;
  upload_count: number;
  reference_count: number;
  first_uploaded_at: Date;
  last_accessed_at: Date;
  total_bytes_saved: number;
  total_cost_saved: number;
}

export interface UploadSession {
  id: string;
  user_id: string;
  file_id: string;
  file_name: string;
  file_hash: string;
  file_size: number;
  chunk_size: number;
  threads: number;
  edges_used: string[];
  chunks_total: number;
  chunks_completed: number;
  bytes_uploaded: number;
  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
  avg_speed_mbps?: number;
  estimated_cost: number;
  actual_cost?: number;
  upload_via: string;
  jetty_speed_enabled: boolean;
  status: string;
  error_message?: string;
}

export class JettySpeedDb {
  // Get all active edge locations
  async getActiveEdges(): Promise<EdgeLocation[]> {
    const result = await client`
      SELECT * FROM edge_locations 
      WHERE is_active = true 
      ORDER BY city
    `;
    return result as unknown as EdgeLocation[];
  }

  // Get latest metrics for an edge (last 5 minutes)
  async getEdgeMetrics(edgeId: string): Promise<EdgeMetric | null> {
    const result = await client`
      SELECT * FROM edge_metrics 
      WHERE edge_id = ${edgeId} 
        AND timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    return result.length > 0 ? (result[0] as EdgeMetric) : null;
  }

  // Get latest metrics for all edges
  async getAllEdgeMetrics(): Promise<Map<string, EdgeMetric>> {
    const result = await client`
      SELECT DISTINCT ON (edge_id) *
      FROM edge_metrics
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY edge_id, timestamp DESC
    `;

    const metricsMap = new Map<string, EdgeMetric>();
    result.forEach((metric: any) => {
      metricsMap.set(metric.edge_id, metric as EdgeMetric);
    });
    return metricsMap;
  }

  // Check if file hash exists (for deduplication)
  async checkFileHash(fileHash: string): Promise<FileHash | null> {
    const result = await client`
      SELECT * FROM file_hashes 
      WHERE file_hash = ${fileHash}
      LIMIT 1
    `;
    return result.length > 0 ? (result[0] as FileHash) : null;
  }

  // Create file hash entry
  async createFileHash(data: {
    file_hash: string;
    file_id: string;
    user_id: string;
    file_name: string;
    file_size: number;
    storage_key: string;
    mime_type: string;
  }): Promise<FileHash> {
    const result = await client`
      INSERT INTO file_hashes (
        file_hash, file_id, user_id, file_name, 
        file_size, storage_key, mime_type
      ) VALUES (
        ${data.file_hash}, ${data.file_id}, ${data.user_id}, ${data.file_name},
        ${data.file_size}, ${data.storage_key}, ${data.mime_type}
      )
      RETURNING *
    `;
    return result[0] as FileHash;
  }

  // Create upload session
  async createUploadSession(data: {
    user_id: string;
    file_id: string;
    file_name: string;
    file_hash: string;
    file_size: number;
    chunk_size: number;
    threads: number;
    edges_used: string[];
    chunks_total: number;
    estimated_cost: number;
    upload_via: string;
    jetty_speed_enabled: boolean;
  }): Promise<UploadSession> {
    const result = await client`
      INSERT INTO upload_sessions (
        user_id, file_id, file_name, file_hash, file_size,
        chunk_size, threads, edges_used, chunks_total,
        estimated_cost, upload_via, jetty_speed_enabled
      ) VALUES (
        ${data.user_id}, ${data.file_id}, ${data.file_name}, ${data.file_hash}, ${data.file_size},
        ${data.chunk_size}, ${data.threads}, ${JSON.stringify(data.edges_used)}, ${data.chunks_total},
        ${data.estimated_cost}, ${data.upload_via}, ${data.jetty_speed_enabled}
      )
      RETURNING *
    `;
    return result[0] as UploadSession;
  }

  // Update upload session progress
  async updateUploadProgress(sessionId: string, data: {
    chunks_completed: number;
    bytes_uploaded: number;
    status?: string;
  }): Promise<void> {
    await client`
      UPDATE upload_sessions 
      SET 
        chunks_completed = ${data.chunks_completed},
        bytes_uploaded = ${data.bytes_uploaded},
        status = COALESCE(${data.status || null}, status),
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  }

  // Complete upload session
  async completeUploadSession(sessionId: string, actualCost: number): Promise<void> {
    await client`
      UPDATE upload_sessions 
      SET 
        status = 'completed',
        completed_at = NOW(),
        actual_cost = ${actualCost}
      WHERE id = ${sessionId}
    `;
  }

  // Get user's upload patterns for predictive pre-warming
  async getUserUploadPatterns(userId: string): Promise<any[]> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const result = await client`
      SELECT * FROM upload_patterns
      WHERE user_id = ${userId}
        AND (
          (hour = ${hour} AND day_of_week = ${dayOfWeek})
          OR (hour = ${(hour + 1) % 24} AND day_of_week = ${dayOfWeek})
        )
      ORDER BY upload_count DESC
      LIMIT 5
    `;
    return result;
  }

  // Create user file reference (for deduplication tracking)
  async createUserFileReference(data: {
    user_id: string;
    file_hash: string;
    file_name: string;
  }): Promise<void> {
    await client`
      INSERT INTO user_file_references (user_id, file_hash, file_name)
      VALUES (${data.user_id}, ${data.file_hash}, ${data.file_name})
      ON CONFLICT (user_id, file_hash, file_name) DO NOTHING
    `;
  }

  // Get deduplication savings summary
  async getDeduplicationSavings(): Promise<any> {
    const result = await client`
      SELECT * FROM deduplication_savings
    `;
    return result[0];
  }

  // Get top performing edges
  async getTopEdges(limit: number = 10): Promise<any[]> {
    const result = await client`
      SELECT * FROM top_edges
      LIMIT ${limit}
    `;
    return result;
  }
}

export const jettySpeedDb = new JettySpeedDb();
