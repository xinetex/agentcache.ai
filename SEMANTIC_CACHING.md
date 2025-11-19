# Semantic Caching Strategy

## Overview
Semantic Caching ("Smart Cache") improves cache hit rates by matching prompts based on **meaning** rather than exact character-by-character strings.

**Impact:**
- Increases hit rate from ~40% (exact) to ~80% (semantic).
- Catches phrasing variations ("Who is president?" vs "Who's the president?").
- Uses Vector Databases to find similar past queries.

## Architecture

```mermaid
graph TD
    A[User Request] --> B{Semantic Enabled?}
    B -- No --> C[Exact Match (SHA-256)]
    B -- Yes --> D[Generate Embedding]
    D --> E[Vector DB Search]
    E --> F{Similarity > 0.95?}
    F -- Yes --> G[Return Cached Response]
    F -- No --> H[Call LLM]
    H --> I[Store in Vector DB]
    I --> J[Return Response]
```

## Technical Stack

1.  **Embedding Model:**
    -   `text-embedding-3-small` (OpenAI) - Fast, cheap ($0.02/1M tokens).
    -   Or `nomic-embed-text-v1.5` (Open Source/Hosted).

2.  **Vector Database:**
    -   **Upstash Vector** (Native choice): Works over HTTP, integrates with existing Redis stack.
    -   **Pinecone**: Popular, good for scale.

## Implementation Plan

### 1. Configuration
New environment variables required:
```bash
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Vector DB (Upstash Vector)
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
```

### 2. API Schema Update
Add `semantic` flag to `/api/cache/get`:
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [...],
  "semantic": true,
  "similarity_threshold": 0.95
}
```

### 3. Logic (Pseudocode)
```javascript
async function getSemanticCache(text, threshold) {
  // 1. Generate Embedding
  const embedding = await openai.embeddings.create({ 
    model: "text-embedding-3-small", 
    input: text 
  });
  
  // 2. Query Vector DB
  const matches = await vectorDb.query({
    vector: embedding.data[0].embedding,
    topK: 1,
    includeMetadata: true
  });
  
  // 3. Check Threshold
  if (matches[0] && matches[0].score >= threshold) {
    return matches[0].metadata.response;
  }
  return null;
}
```

## Rollout Strategy
1.  **Beta**: Enable for `ac_live_*` keys only.
2.  **Billing**: Semantic caching costs money (embedding tokens). Add 10% surcharge or bundle in Pro plan.
