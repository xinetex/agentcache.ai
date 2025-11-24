# Databricks notebook source
# MAGIC %md
# MAGIC # AgentCache + Databricks: RAG Pipeline Optimization
# MAGIC 
# MAGIC **Reduce LLM inference costs by 90% in your data lakehouse**
# MAGIC 
# MAGIC This notebook demonstrates how AgentCache integrates with Databricks to cache LLM responses 
# MAGIC in RAG (Retrieval-Augmented Generation) pipelines, dramatically reducing costs and latency.
# MAGIC 
# MAGIC ## What You'll Learn:
# MAGIC - Build a RAG pipeline using Databricks + OpenAI
# MAGIC - Integrate AgentCache for intelligent caching
# MAGIC - Compare performance: cached vs uncached
# MAGIC - Track cost savings in real-time
# MAGIC 
# MAGIC ## Prerequisites:
# MAGIC - Databricks workspace (Community Edition works!)
# MAGIC - OpenAI API key (or any LLM provider)
# MAGIC - AgentCache API key (free tier: `ac_demo_test123`)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 📦 Setup: Install Dependencies

# COMMAND ----------

# DBTITLE 1,Install Required Packages
%pip install openai langchain chromadb agentcache tiktoken

# COMMAND ----------

# DBTITLE 1,Configuration
import os
from datetime import datetime

# AgentCache Config
AGENTCACHE_API_KEY = "ac_demo_test123"  # Replace with your key from https://agentcache.ai
AGENTCACHE_BASE_URL = "https://agentcache.ai"
NAMESPACE = "databricks/rag-demo"  # Organize cache by team/project

# OpenAI Config (or replace with your LLM provider)
OPENAI_API_KEY = dbutils.secrets.get(scope="llm", key="openai-key")  # Use Databricks secrets!
# Or for testing: OPENAI_API_KEY = "sk-..."

# Sample data source
KNOWLEDGE_BASE = [
    "AgentCache is an edge caching service for AI API calls that reduces costs by 90%.",
    "Databricks is a unified data analytics platform built on Apache Spark.",
    "RAG (Retrieval-Augmented Generation) combines document retrieval with LLM generation.",
    "Vector databases like Chroma enable semantic search over embeddings.",
    "Data lakehouses merge the flexibility of data lakes with warehouse performance.",
]

print("✅ Configuration loaded")
print(f"   Namespace: {NAMESPACE}")
print(f"   Knowledge base: {len(KNOWLEDGE_BASE)} documents")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 🔧 Part 1: Build a Standard RAG Pipeline (No Caching)

# COMMAND ----------

# DBTITLE 1,Standard RAG Pipeline
import chromadb
from chromadb.utils import embedding_functions
import openai

# Initialize vector DB
chroma_client = chromadb.Client()
collection = chroma_client.create_collection(
    name="knowledge_base",
    embedding_function=embedding_functions.OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name="text-embedding-ada-002"
    )
)

# Add documents
collection.add(
    documents=KNOWLEDGE_BASE,
    ids=[f"doc_{i}" for i in range(len(KNOWLEDGE_BASE))]
)

def rag_query_uncached(question: str, top_k: int = 2) -> dict:
    """Standard RAG: Retrieve + Generate (NO caching)"""
    
    start_time = datetime.now()
    
    # 1. Retrieve relevant docs
    results = collection.query(
        query_texts=[question],
        n_results=top_k
    )
    context_docs = results['documents'][0]
    context = "\n".join(context_docs)
    
    # 2. Generate answer with LLM
    prompt = f"""Context:
{context}

Question: {question}

Answer based on the context above:"""
    
    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    
    answer = response.choices[0].message.content
    tokens_used = response.usage.total_tokens
    
    latency_ms = (datetime.now() - start_time).total_seconds() * 1000
    
    return {
        "answer": answer,
        "context_docs": context_docs,
        "tokens": tokens_used,
        "latency_ms": latency_ms,
        "cost_usd": tokens_used * 0.000002  # GPT-3.5-turbo pricing
    }

# Test query
question = "What is AgentCache?"
result = rag_query_uncached(question)

print(f"❌ UNCACHED Query:")
print(f"   Question: {question}")
print(f"   Answer: {result['answer'][:100]}...")
print(f"   Latency: {result['latency_ms']:.0f}ms")
print(f"   Tokens: {result['tokens']}")
print(f"   Cost: ${result['cost_usd']:.6f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## ⚡ Part 2: Add AgentCache for Intelligent Caching

# COMMAND ----------

# DBTITLE 1,RAG Pipeline with AgentCache
import requests
import hashlib
import json

class AgentCacheClient:
    """Lightweight AgentCache client for Databricks"""
    
    def __init__(self, api_key: str, base_url: str, namespace: str):
        self.api_key = api_key
        self.base_url = base_url
        self.namespace = namespace
        self.headers = {
            "X-API-Key": api_key,
            "X-Cache-Namespace": namespace,
            "Content-Type": "application/json"
        }
    
    def get(self, provider: str, model: str, messages: list) -> dict:
        """Check cache for LLM response"""
        response = requests.post(
            f"{self.base_url}/api/cache/get",
            headers=self.headers,
            json={"provider": provider, "model": model, "messages": messages}
        )
        return response.json()
    
    def set(self, provider: str, model: str, messages: list, response: str, ttl: int = 86400):
        """Store LLM response in cache"""
        result = requests.post(
            f"{self.base_url}/api/cache/set",
            headers=self.headers,
            json={
                "provider": provider,
                "model": model,
                "messages": messages,
                "response": response,
                "ttl": ttl
            }
        )
        return result.json()

# Initialize AgentCache
cache = AgentCacheClient(
    api_key=AGENTCACHE_API_KEY,
    base_url=AGENTCACHE_BASE_URL,
    namespace=NAMESPACE
)

def rag_query_cached(question: str, top_k: int = 2) -> dict:
    """RAG with AgentCache: Retrieve + Generate (WITH intelligent caching)"""
    
    start_time = datetime.now()
    
    # 1. Retrieve relevant docs (same as before)
    results = collection.query(
        query_texts=[question],
        n_results=top_k
    )
    context_docs = results['documents'][0]
    context = "\n".join(context_docs)
    
    # 2. Build LLM prompt
    prompt = f"""Context:
{context}

Question: {question}

Answer based on the context above:"""
    
    messages = [{"role": "user", "content": prompt}]
    
    # 3. CHECK CACHE FIRST
    cache_result = cache.get(
        provider="openai",
        model="gpt-3.5-turbo",
        messages=messages
    )
    
    if cache_result.get('hit'):
        # CACHE HIT - Return cached response
        latency_ms = (datetime.now() - start_time).total_seconds() * 1000
        cached_response = cache_result['response']
        
        return {
            "answer": cached_response['choices'][0]['message']['content'],
            "context_docs": context_docs,
            "tokens": cached_response['usage']['total_tokens'],
            "latency_ms": latency_ms,
            "cost_usd": 0.0,  # ZERO COST!
            "cache_hit": True,
            "cache_age_seconds": cache_result.get('freshness', {}).get('age', 0) / 1000
        }
    
    # 4. CACHE MISS - Call LLM and cache result
    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        temperature=0
    )
    
    # Store in cache for next time
    cache.set(
        provider="openai",
        model="gpt-3.5-turbo",
        messages=messages,
        response=response.to_dict_recursive(),
        ttl=86400  # 24 hours
    )
    
    answer = response.choices[0].message.content
    tokens_used = response.usage.total_tokens
    latency_ms = (datetime.now() - start_time).total_seconds() * 1000
    
    return {
        "answer": answer,
        "context_docs": context_docs,
        "tokens": tokens_used,
        "latency_ms": latency_ms,
        "cost_usd": tokens_used * 0.000002,
        "cache_hit": False
    }

# Test the same question
result_cached = rag_query_cached(question)

print(f"{'✅ CACHED' if result_cached['cache_hit'] else '❌ UNCACHED'} Query:")
print(f"   Question: {question}")
print(f"   Answer: {result_cached['answer'][:100]}...")
print(f"   Latency: {result_cached['latency_ms']:.0f}ms")
print(f"   Tokens: {result_cached['tokens']}")
print(f"   Cost: ${result_cached['cost_usd']:.6f}")
if result_cached['cache_hit']:
    print(f"   💰 SAVED ${result['cost_usd']:.6f}")
    print(f"   ⚡ {((result['latency_ms'] - result_cached['latency_ms']) / result['latency_ms'] * 100):.0f}% FASTER")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 📊 Part 3: Performance Comparison

# COMMAND ----------

# DBTITLE 1,Benchmark: 10 Queries (Mix of Repeated & Unique)
import pandas as pd
import time

questions = [
    "What is AgentCache?",
    "What is AgentCache?",  # Repeat - should hit cache
    "What is Databricks?",
    "What is RAG?",
    "What is AgentCache?",  # Repeat again
    "What are vector databases?",
    "What is Databricks?",  # Repeat
    "What is a data lakehouse?",
    "What is AgentCache?",  # Repeat
    "What is RAG?",  # Repeat
]

results = []

print("🚀 Running benchmark (10 queries)...\n")

for i, q in enumerate(questions, 1):
    result = rag_query_cached(q)
    results.append({
        "query_num": i,
        "question": q[:30] + "...",
        "cache_hit": result['cache_hit'],
        "latency_ms": result['latency_ms'],
        "tokens": result['tokens'],
        "cost_usd": result['cost_usd']
    })
    
    status = "✅ HIT " if result['cache_hit'] else "❌ MISS"
    print(f"{i:2d}. {status} | {result['latency_ms']:5.0f}ms | ${result['cost_usd']:.6f} | {q[:40]}")
    time.sleep(0.5)  # Rate limiting

df = pd.DataFrame(results)

print("\n" + "="*60)
print("📈 RESULTS SUMMARY:")
print("="*60)
print(f"Total Queries:     {len(df)}")
print(f"Cache Hits:        {df['cache_hit'].sum()} ({df['cache_hit'].sum() / len(df) * 100:.0f}%)")
print(f"Cache Misses:      {(~df['cache_hit']).sum()}")
print(f"\nAvg Latency:")
print(f"  - Cached:        {df[df['cache_hit']]['latency_ms'].mean():.0f}ms")
print(f"  - Uncached:      {df[~df['cache_hit']]['latency_ms'].mean():.0f}ms")
print(f"\nTotal Cost:")
print(f"  - With Cache:    ${df['cost_usd'].sum():.6f}")
print(f"  - Without Cache: ${df['tokens'].sum() * 0.000002:.6f}")
print(f"  - 💰 SAVINGS:    ${(df['tokens'].sum() * 0.000002) - df['cost_usd'].sum():.6f} ({((df['tokens'].sum() * 0.000002 - df['cost_usd'].sum()) / (df['tokens'].sum() * 0.000002)) * 100:.0f}%)")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 📊 Part 4: Visualize with Databricks Charts

# COMMAND ----------

# DBTITLE 1,Create Visualization DataFrame
import matplotlib.pyplot as plt
import seaborn as sns

# Prepare data for Databricks visualization
display(df)

# Cost comparison
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Latency comparison
latency_data = df.groupby('cache_hit')['latency_ms'].mean()
ax1.bar(['Cached', 'Uncached'], [latency_data[True], latency_data[False]], 
        color=['#00ff9d', '#ff5555'])
ax1.set_ylabel('Latency (ms)')
ax1.set_title('Avg Latency: Cached vs Uncached')
ax1.grid(axis='y', alpha=0.3)

# Cost comparison
cost_data = df.groupby('cache_hit')['cost_usd'].sum()
ax2.bar(['Cached', 'Uncached (Projected)'], 
        [cost_data[True], df['tokens'].sum() * 0.000002],
        color=['#00ff9d', '#ff5555'])
ax2.set_ylabel('Cost (USD)')
ax2.set_title('Total Cost: With vs Without Cache')
ax2.grid(axis='y', alpha=0.3)

plt.tight_layout()
display(fig)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 🎯 Part 5: Track Analytics in Databricks

# COMMAND ----------

# DBTITLE 1,Fetch Analytics from AgentCache
# Query AgentCache analytics API for detailed metrics
analytics_response = requests.get(
    f"{AGENTCACHE_BASE_URL}/api/analytics",
    headers={
        "X-API-Key": AGENTCACHE_API_KEY,
        "X-Cache-Namespace": NAMESPACE
    },
    params={
        "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
        "group_by": "day"
    }
)

if analytics_response.status_code == 200:
    analytics = analytics_response.json()
    
    print("📊 AgentCache Analytics (Last 7 Days)")
    print("="*60)
    print(f"Namespace:        {analytics['namespace']}")
    print(f"Total Requests:   {analytics['summary']['total_requests']:,}")
    print(f"Cache Hits:       {analytics['summary']['cache_hits']:,}")
    print(f"Hit Rate:         {analytics['summary']['hit_rate']}%")
    print(f"Tokens Saved:     {analytics['summary']['tokens_saved']:,}")
    print(f"Cost Saved:       {analytics['summary']['cost_saved']}")
    
    # Create time series DataFrame for Databricks viz
    ts_df = pd.DataFrame(analytics['time_series'])
    ts_df['date'] = pd.to_datetime(ts_df['timestamp']).dt.date
    
    display(ts_df[['label', 'total_requests', 'hit_rate', 'cost_saved']])
else:
    print(f"❌ Analytics API error: {analytics_response.status_code}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 🚀 Next Steps
# MAGIC 
# MAGIC ### Production Deployment:
# MAGIC 1. **Get a live API key**: https://agentcache.ai/signup
# MAGIC 2. **Store in Databricks Secrets**:
# MAGIC    ```python
# MAGIC    dbutils.secrets.put(scope="agentcache", key="api-key", string_value="ac_live_...")
# MAGIC    ```
# MAGIC 3. **Integrate with MLflow**: Track cache metrics alongside model metrics
# MAGIC 4. **Set up namespace hierarchy**: `databricks/{workspace}/{team}/{project}`
# MAGIC 
# MAGIC ### Advanced Features:
# MAGIC - **Semantic Caching**: Cache similar queries, not just exact matches
# MAGIC - **Reasoning Cache**: Cache expensive o1/Claude reasoning tokens
# MAGIC - **Multi-Region**: Deploy cache close to your Databricks workspace
# MAGIC - **Policy Engine**: Set TTL, model restrictions per namespace
# MAGIC 
# MAGIC ### Cost Optimization:
# MAGIC At **85% hit rate** (typical for RAG), AgentCache saves:
# MAGIC - **10,000 queries/day** → **$250/month savings**
# MAGIC - **100,000 queries/day** → **$2,500/month savings**
# MAGIC - **1M queries/day** → **$25,000/month savings**
# MAGIC 
# MAGIC ---
# MAGIC 
# MAGIC **Questions?** support@agentcache.ai | https://agentcache.ai/docs
