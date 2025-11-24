# AgentCache + Databricks Integration Demo

## 🚀 Quick Start

### Step 1: Upload to Databricks Workspace

**Option A: Import from URL (Easiest)**
1. Open your Databricks workspace
2. Click **Workspace** → **Import**
3. Select **URL** and paste:
   ```
   https://raw.githubusercontent.com/xinetex/agentcache.ai/main/examples/databricks_rag_optimization.py
   ```
4. Click **Import**

**Option B: Upload File**
1. Download `databricks_rag_optimization.py` from this repo
2. In Databricks: **Workspace** → **Import**  
3. Select **File** and choose the downloaded `.py` file
4. Click **Import**

### Step 2: Set Up Secrets (Recommended)

**For OpenAI:**
```bash
# In Databricks CLI or notebook:
dbutils.secrets.put(scope="llm", key="openai-key", string_value="sk-...")
```

**For AgentCache (when you have a live key):**
```bash
dbutils.secrets.put(scope="agentcache", key="api-key", string_value="ac_live_...")
```

### Step 3: Run the Notebook

1. Attach to any cluster (even Databricks Community Edition works!)
2. Click **Run All** 
3. Watch the magic happen ✨

## 📊 What the Demo Shows

### Part 1: Standard RAG Pipeline
- Vector search with ChromaDB
- LLM completion with OpenAI
- **Problem**: Every query costs money & takes ~2s

### Part 2: Add AgentCache
- Same pipeline, but check cache first
- **Result**: 90% cost savings, <50ms cache hits

### Part 3: Benchmark
- 10 queries with repeats
- Live cost/latency comparison
- Real savings metrics

### Part 4: Visualizations
- Databricks charts showing performance
- Hit rate, cost savings, latency improvements

### Part 5: Enterprise Analytics
- Query the AgentCache analytics API
- Time-series data for dashboards
- Namespace-level insights

## 🎯 Enterprise Use Cases

### Scenario 1: Customer Support Bot
- **100K queries/day**, 70% repeated questions
- **Without AgentCache**: $6,000/month
- **With AgentCache**: $1,800/month → **Save $4,200/month**

### Scenario 2: Data Analysis Chatbot  
- **1M queries/month**, 85% hit rate on common analyses
- **Without AgentCache**: $60,000/month
- **With AgentCache**: $9,000/month → **Save $51,000/month**

### Scenario 3: Code Assistant (GitHub Copilot Alternative)
- **10M queries/month** (large dev team)
- **Without AgentCache**: $600,000/month
- **With AgentCache**: $90,000/month → **Save $510,000/month**

## 🔧 Customization

### Use Your Own Data
Replace `KNOWLEDGE_BASE` with your actual documents:
```python
# Load from Databricks tables
df = spark.sql("SELECT text FROM knowledge.documents")
KNOWLEDGE_BASE = df.select("text").collect()
```

### Different LLM Providers
Works with any provider:
```python
# Anthropic
cache.get(provider="anthropic", model="claude-3-sonnet", messages=...)

# Azure OpenAI
cache.get(provider="azure-openai", model="gpt-4", messages=...)

# Local models (Ollama, vLLM)
cache.get(provider="ollama", model="llama2", messages=...)
```

### Namespace Organization
Structure your cache for multi-team environments:
```python
NAMESPACE = f"databricks/{workspace_id}/{team_name}/{project}"
```

## 📈 Next Steps for Production

1. **Get Live API Key**: https://agentcache.ai/signup
   - Free tier: 1K requests/month
   - Pro tier ($299/mo): 500K requests/month
   - Enterprise: Custom pricing for Fortune 500

2. **Integrate with MLflow**:
   ```python
   import mlflow
   mlflow.log_metric("cache_hit_rate", cache_result['hit_rate'])
   mlflow.log_metric("cost_saved_usd", cache_result['cost_saved'])
   ```

3. **Set Up Monitoring**:
   - Create Databricks dashboard pulling from `/api/analytics`
   - Set alerts for low hit rates or quota approaching limits
   - Track ROI per namespace/team

4. **Enable Advanced Features**:
   - **Semantic Caching**: Match similar queries (not just exact)
   - **Reasoning Cache**: Cache o1/Claude reasoning tokens (10x more expensive)
   - **Multi-Region**: Deploy cache close to your Databricks workspace

## 🆘 Support

- **Documentation**: https://agentcache.ai/docs
- **Email**: support@agentcache.ai
- **Enterprise Sales**: sales@agentcache.ai
- **GitHub Issues**: https://github.com/xinetex/agentcache.ai/issues

## 📊 Analytics API Reference

### Fetch Metrics
```python
import requests

response = requests.get(
    "https://agentcache.ai/api/analytics",
    headers={"X-API-Key": your_api_key},
    params={
        "namespace": "databricks/team-a",
        "start_date": "2025-01-01",
        "end_date": "2025-01-31",
        "group_by": "day"  # or "hour", "week"
    }
)

analytics = response.json()
# Returns: summary stats + time_series data
```

### Export for Databricks SQL
```python
# Create Delta table from analytics
ts_df = spark.createDataFrame(analytics['time_series'])
ts_df.write.format("delta").mode("overwrite").saveAsTable("agentcache_metrics")

# Query in Databricks SQL
%sql
SELECT 
  label,
  total_requests,
  hit_rate,
  cost_saved
FROM agentcache_metrics
WHERE hit_rate > 80
ORDER BY cost_saved DESC
```

## 🎓 Learning Resources

- **Video Tutorial**: [Coming Soon] Databricks + AgentCache Walkthrough
- **Blog Post**: https://agentcache.ai/blog/databricks-integration
- **Case Study**: [Contact sales@agentcache.ai for customer examples]
- **Webinar**: Register for monthly "Lakehouse AI Optimization" sessions

---

**Built with ❤️ for Data Engineers**

*Helping teams save millions on AI infrastructure costs*
