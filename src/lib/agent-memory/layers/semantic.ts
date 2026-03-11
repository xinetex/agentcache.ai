/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * Semantic Layer - Vector storage for embeddings and similarity search
 * 
 * Backends: Upstash Vector (production), In-memory (dev)
 */

import { Index } from '@upstash/vector';

interface SemanticRecord {
  key: string;
  embedding: number[];
  metadata: any;
}

interface SearchResult {
  key: string;
  score: number;
}

export class SemanticLayer {
  private vectorIndex: Index | null = null;
  private localStore = new Map<string, SemanticRecord>();
  private embeddingDim = 384; // Default dimension

  constructor() {
    this.initializeVector();
  }

  private initializeVector(): void {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (url && token) {
      try {
        this.vectorIndex = new Index({ url, token });
        console.log('[SemanticLayer] Connected to Upstash Vector');
      } catch (error) {
        console.warn('[SemanticLayer] Upstash Vector init failed, using local:', error);
      }
    } else {
      console.warn('[SemanticLayer] No UPSTASH_VECTOR credentials, using local store');
    }
  }

  /**
   * Generate embedding for text
   * Uses local embedding model or API
   */
  async embed(text: string): Promise<number[]> {
    // Try OpenAI embeddings if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.slice(0, 8000), // Limit input
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.data[0].embedding;
        }
      } catch (error) {
        console.warn('[SemanticLayer] OpenAI embedding failed:', error);
      }
    }

    // Fallback: deterministic hash-based "embedding" for dev
    return this.hashEmbed(text);
  }

  /**
   * Store embedding in vector index
   */
  async store(key: string, embedding: number[], metadata: any): Promise<void> {
    if (this.vectorIndex) {
      await this.vectorIndex.upsert({
        id: key,
        vector: embedding,
        metadata: {
          ...metadata,
          key,
        },
      });
    } else {
      this.localStore.set(key, { key, embedding, metadata });
    }
  }

  /**
   * Semantic search by embedding
   */
  async search(
    embedding: number[],
    namespace: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    if (this.vectorIndex) {
      const results = await this.vectorIndex.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true,
        filter: `namespace = '${namespace}'`,
      });

      return results
        .filter(r => r.score >= threshold)
        .map(r => ({
          key: r.id as string,
          score: r.score,
        }));
    }

    // Local search with cosine similarity
    const results: SearchResult[] = [];
    for (const [key, record] of Array.from(this.localStore.entries())) {
      if (record.metadata?.namespace === namespace || !namespace) {
        const score = this.cosineSimilarity(embedding, record.embedding);
        if (score >= threshold) {
          results.push({ key, score });
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Delete embedding
   */
  async delete(key: string): Promise<void> {
    if (this.vectorIndex) {
      await this.vectorIndex.delete(key);
    }
    this.localStore.delete(key);
  }

  /**
   * Get embedding by key
   */
  async get(key: string): Promise<number[] | null> {
    if (this.vectorIndex) {
      const result = await this.vectorIndex.fetch([key]);
      return result[0]?.vector || null;
    }
    return this.localStore.get(key)?.embedding || null;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private hashEmbed(text: string): number[] {
    // Deterministic pseudo-embedding based on text hash
    // NOT for production semantic search, just for dev/testing
    const embedding = new Array(this.embeddingDim).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = (charCode * (i + 1)) % this.embeddingDim;
      embedding[idx] += Math.sin(charCode * 0.01) * 0.1;
    }

    // Normalize
    const mag = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    return embedding.map(v => v / mag);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag > 0 ? dot / mag : 0;
  }
}

export default SemanticLayer;
