/**
 * L3 Semantic Cache (Vector Store)
 * 
 * Uses Upstash Vector for semantic similarity search
 * Enables near-hit caching for similar but not identical queries
 */

export const config = { runtime: 'nodejs' };

// Generate embedding using OpenAI embeddings API
async function generateEmbedding(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured for semantic cache');
  }

  // Concatenate message content for embedding
  const text = messages
    .filter(m => m.content)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // 1536 dimensions, $0.02 per 1M tokens
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${error}`);
  }

  const data = await response.json();
  return {
    embedding: data.data[0].embedding,
    tokens: data.usage.total_tokens,
  };
}

// Search for semantically similar cached responses
export async function semanticSearch(messages, options = {}) {
  const {
    threshold = 0.95,
    topK = 5,
    provider = 'openai',
    model = 'gpt-4',
    namespace = 'default',
  } = options;

  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    throw new Error('Upstash Vector not configured');
  }

  try {
    // Dynamic import of Upstash Vector
    const { Index } = await import('@upstash/vector');
    
    // Initialize Upstash Vector client
    const vector = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    // Generate embedding for the query
    const { embedding, tokens: embeddingTokens } = await generateEmbedding(messages);

    // Query vector store for similar embeddings
    const results = await vector.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      includeVectors: false,
    });

    // Filter results by similarity threshold and metadata
    const matches = results.filter(result => {
      if (result.score < threshold) return false;
      
      // Match by provider/model if specified
      if (result.metadata?.provider !== provider) return false;
      if (result.metadata?.model !== model) return false;
      if (result.metadata?.namespace !== namespace) return false;
      
      return true;
    });

    if (matches.length === 0) {
      return { 
        hit: false, 
        embeddingTokens,
        searchedVectors: results.length 
      };
    }

    // Return the best match
    const bestMatch = matches[0];
    return {
      hit: true,
      response: bestMatch.metadata.response,
      similarity: bestMatch.score,
      cacheKey: bestMatch.id,
      embeddingTokens,
      matchedQuery: bestMatch.metadata.query_summary,
      cachedAt: bestMatch.metadata.cached_at,
    };
  } catch (error) {
    console.error('Semantic cache error:', error);
    return { 
      hit: false, 
      error: error.message 
    };
  }
}

// Store response in semantic cache (L3)
export async function semanticStore(messages, response, options = {}) {
  const {
    provider = 'openai',
    model = 'gpt-4',
    namespace = 'default',
    cacheKey,
  } = options;

  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    throw new Error('Upstash Vector not configured');
  }

  try {
    // Dynamic import of Upstash Vector
    const { Index } = await import('@upstash/vector');
    
    const vector = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    // Generate embedding
    const { embedding, tokens: embeddingTokens } = await generateEmbedding(messages);

    // Create query summary (first 200 chars)
    const querySummary = messages
      .filter(m => m.content)
      .map(m => m.content)
      .join(' ')
      .slice(0, 200);

    // Store vector with metadata
    await vector.upsert({
      id: cacheKey,
      vector: embedding,
      metadata: {
        provider,
        model,
        namespace,
        query_summary: querySummary,
        response: response,
        cached_at: Date.now(),
        access_count: 1,
      },
    });

    return {
      success: true,
      embeddingTokens,
      vectorId: cacheKey,
    };
  } catch (error) {
    console.error('Semantic store error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Batch update access count for L3 cache entry
export async function updateSemanticAccessCount(cacheKey) {
  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    return;
  }

  try {
    // Dynamic import of Upstash Vector
    const { Index } = await import('@upstash/vector');
    
    const vector = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    // Fetch existing entry
    const result = await vector.fetch([cacheKey], { includeMetadata: true });
    if (result.length === 0) return;

    const entry = result[0];
    const updatedMetadata = {
      ...entry.metadata,
      access_count: (entry.metadata.access_count || 0) + 1,
      last_accessed: Date.now(),
    };

    // Update metadata
    await vector.upsert({
      id: cacheKey,
      vector: entry.vector,
      metadata: updatedMetadata,
    });
  } catch (error) {
    console.error('Update semantic access count error:', error);
  }
}
