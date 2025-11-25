# Cognitive Layer + Node System Integration

## ✅ Verification: Fully Integrated

The cognitive layer (platform memory + wizards) IS properly integrated with the node-based visual system. Here's the complete data flow:

## 📊 Complete Flow Diagram

```
User clicks "🪄 AI Wizard"
         ↓
WizardModal.jsx opens
         ↓
User selects: "Healthcare HIPAA" + "Balanced" performance
         ↓
POST /api/pipeline/generate
  {
    prompt: "Cache patient medical records with HIPAA compliance",
    sector: "healthcare",
    performance: "balanced"
  }
         ↓
API calls PipelineWizard.analyzeUseCase()
         ↓
Wizard checks platform memory:
  patternKey = "usecase:healthcare:cache_patient_medical"
         ↓
Platform Memory checks:
  L1 (in-memory) → MISS
  L2 (PostgreSQL) → HIT! (4 similar pipelines found)
         ↓
Returns learned pattern:
  {
    nodes: [cache_l1, cache_l2, phi_filter, hipaa_audit],
    confidence: 0.87,
    usage_count: 4
  }
         ↓
API applies performance settings
         ↓
Calculates complexity & metrics
         ↓
Wizard learns from this generation (async)
         ↓
Returns pipeline to frontend:
  {
    nodes: [
      { type: "cache_l1", config: {...} },
      { type: "cache_l2", config: {...} },
      { type: "phi_filter", config: {...} }
    ],
    reasoning: ["Based on 4 similar healthcare pipelines", ...],
    metrics: { estimated_latency_ms: 70, ... }
  }
         ↓
Frontend (App.jsx) calls handleWizardComplete()
         ↓
Converts backend nodes → React Flow nodes:
  {
    id: "cache_l1-0",
    type: "cache_l1",  // Maps to CacheL1Node component
    position: { x: 100, y: 200 },
    data: { label: "CACHE L1", config: {...}, metrics: {...} }
  }
         ↓
Generates edges (connections) automatically
         ↓
React Flow renders nodes on canvas
         ↓
User sees visual pipeline with animated connections
```

## 🧠 Cognitive Layer Components

### 1. Platform Memory (`lib/platform-memory.js`)

**Purpose**: Self-hosted cognitive memory using AgentCache's own infrastructure

**Storage Layers**:
- **L1**: In-memory (5min TTL) - instant recall
- **L2**: PostgreSQL (7 days) - persistent patterns
- **L3**: Vector search (planned) - semantic similarity

**Namespaces**:
```javascript
{
  WIZARD: 'platform/studio/wizard',        // Pipeline patterns
  COMPLEXITY: 'platform/billing/complexity', // Cost calculations
  OPTIMIZATION: 'platform/suggestions',      // Optimization advice
  COMPLIANCE: 'platform/compliance',         // Sector requirements
  SUPPORT: 'platform/operations/support',    // Support patterns
  ONBOARDING: 'platform/onboarding'         // User flows
}
```

**Key Methods**:
- `get(namespace, key)` - Retrieve pattern from memory
- `set(namespace, key, data, options)` - Store new pattern
- `analyzePatterns(namespace)` - Find trends across patterns

### 2. Wizard Framework (`lib/wizard-framework.js`)

**Base Wizard Class**:
```javascript
class BaseWizard {
  async recall(patternKey) {
    // Check platform memory for this pattern
    const result = await platformMemory.get(this.namespace, patternKey);
    return { found: result.hit, data: result.data, confidence: result.confidence };
  }
  
  async learn(patternKey, data, confidence) {
    // Store successful pattern in memory
    await platformMemory.set(this.namespace, patternKey, data, { confidence });
  }
}
```

**Pipeline Wizard**:
```javascript
export class PipelineWizard extends BaseWizard {
  async analyzeUseCase(prompt, context) {
    // 1. Check if we've seen similar use case
    const patternKey = `usecase:${sector}:${keywords}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      // Return learned nodes from previous pipelines
      return {
        suggestions: memory.data.nodes,
        confidence: memory.confidence,
        reason: `Based on ${memory.usage_count} similar pipelines`
      };
    }
    
    // 2. New pattern - infer from scratch
    return { suggestions: this.inferNodes(prompt, sector), confidence: 0.6 };
  }
  
  async learnFromPipeline(pipeline) {
    // Store: use case → nodes pattern
    await this.learn(`nodes:${sector}:${use_case}`, {
      nodes: pipeline.nodes,
      sector,
      complexity: pipeline.complexity_tier
    });
    
    // Store: node types → complexity pattern
    await this.learn(`complexity:${nodeTypes}:${sector}`, {
      tier: pipeline.complexity_tier,
      score: pipeline.complexity_score
    }, 0.95); // High confidence
  }
}
```

### 3. Pipeline Generation API (`api/pipeline/generate.js`)

**Request Flow**:
```javascript
export default async function handler(req, res) {
  const { prompt, sector, performance } = req.body;
  
  // Step 1: Analyze with cognitive memory
  const analysis = await wizard.analyzeUseCase(prompt, { sector });
  // Returns: { suggestions, confidence, learned: true/false }
  
  // Step 2: Get node suggestions (checks memory)
  const nodeSuggestions = await wizard.suggestNodes(useCase, sector);
  // Returns: { nodes, confidence, source: 'learned_pattern' or 'defaults' }
  
  // Step 3: Apply performance settings
  const nodes = applyPerformanceSettings(nodeSuggestions.nodes, performance);
  
  // Step 4: Calculate complexity
  const complexity = calculateComplexity({ nodes, sector });
  
  // Step 5: Generate reasoning
  const reasoning = [
    analysis.learned 
      ? `Based on ${analysis.usage_count} similar ${sector} pipelines`
      : 'Inferred from use case description',
    // ... more reasoning
  ];
  
  // Step 6: Learn from this generation (async, non-blocking)
  wizard.learnFromPipeline(pipeline, true).catch(err => {
    console.error('Failed to learn:', err);
  });
  
  // Return to frontend
  return res.json({
    success: true,
    pipeline: { nodes, reasoning, metrics, confidence, learned }
  });
}
```

## 🔗 Frontend Integration

### 4. Wizard Modal (`src/components/WizardModal.jsx`)

**Calls Backend API**:
```javascript
async function generatePipeline() {
  const response = await fetch('/api/pipeline/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, sector, performance })
  });
  
  const data = await response.json();
  
  if (data.success && data.pipeline) {
    onComplete(data.pipeline); // Pass to App.jsx
  }
}
```

### 5. App Component (`src/App.jsx`)

**Converts Backend Nodes → Visual Nodes**:
```javascript
const handleWizardComplete = useCallback((pipeline) => {
  // Backend returns: [{ type: "cache_l1", config: {...} }, ...]
  
  // Convert to React Flow nodes
  const generatedNodes = pipeline.nodes.map((node, idx) => ({
    id: `${node.type}-${idx}`,
    type: node.type,  // Maps to CacheL1Node, CacheL2Node, etc.
    position: { x: 100 + idx * 250, y: 200 },  // Auto-layout
    data: {
      label: node.type.replace('_', ' ').toUpperCase(),
      config: node.config,  // TTL, thresholds, etc.
      metrics: { hitRate: 0, latency: 0, savings: 0 }  // Will populate later
    }
  }));
  
  // Auto-generate connections (edges)
  const generatedEdges = [];
  for (let i = 0; i < generatedNodes.length - 1; i++) {
    generatedEdges.push({
      id: `e${i}`,
      source: generatedNodes[i].id,
      target: generatedNodes[i + 1].id,
      animated: true,
      style: { stroke: '#10b981' }
    });
  }
  
  setNodes(generatedNodes);
  setEdges(generatedEdges);
}, []);
```

### 6. Custom Node Components (`src/nodes/`)

**Visual Rendering**:
```javascript
// CacheL1Node.jsx
function CacheL1Node({ data }) {
  return (
    <BaseNode
      data={data}
      icon="💾"
      color="#10b981"
      handles={{ input: true, output: true, miss: true }}
    />
  );
}

// Renders as:
┌───────────────┐
│ 💾 CACHE L1   │ ← data.label
├───────────────┤
│ 🟢 85% hits   │ ← data.metrics.hitRate
│ ⚡ 8ms        │ ← data.metrics.latency
│ 💰 $420       │ ← data.metrics.savings
└───────────────┘
```

## 🔄 Learning Loop

### How Platform Gets Smarter

**Day 1**:
```
User A: "Cache patient medical records"
  → Wizard: No memory found
  → Generates: cache_l1, cache_l2
  → Stores: usecase:healthcare:cache_patient_medical → [cache_l1, cache_l2]
  → Confidence: 60% (inferred)
```

**Day 3**:
```
User B: "Cache medical patient information"
  → Wizard: Memory found! (User A's pattern)
  → Returns: [cache_l1, cache_l2]
  → Stores: Same pattern, increments hit count
  → Confidence: 75% (2 uses)
```

**Day 10**:
```
User C: "Patient data caching with HIPAA"
  → Wizard: Memory found! (10 similar pipelines)
  → Returns: [cache_l1, cache_l2, phi_filter, hipaa_audit]
  → Pattern evolved: users added HIPAA nodes
  → Confidence: 92% (10 uses)
```

**Day 30**:
```
New user: "Healthcare patient records"
  → Wizard: High confidence pattern! (50 uses)
  → Instantly suggests optimal configuration
  → Confidence: 97%
  → "Based on 50 similar healthcare pipelines"
```

## 📈 Intelligence Accumulation

**Memory Table Growth**:
```sql
-- platform_memory_cache table

| namespace              | cache_key                    | hit_count | confidence | data                    |
|------------------------|------------------------------|-----------|------------|-------------------------|
| platform/studio/wizard | usecase:healthcare:cache...  | 50        | 0.97       | {nodes: [...], ...}    |
| platform/studio/wizard | usecase:finance:fraud...     | 23        | 0.89       | {nodes: [...], ...}    |
| platform/studio/wizard | nodes:healthcare:patient...  | 45        | 0.95       | {nodes: [...], ...}    |
| platform/billing/...   | complexity:cache_l1,l2:...   | 100       | 0.98       | {tier: "moderate", ...}|
```

**Audit Trail** (`platform_memory_audit`):
```sql
| action | namespace              | cache_key        | confidence | timestamp           |
|--------|------------------------|------------------|------------|---------------------|
| set    | platform/studio/wizard | usecase:health...| 0.60       | 2025-01-01 10:00:00 |
| get    | platform/studio/wizard | usecase:health...| 0.75       | 2025-01-03 14:22:00 |
| set    | platform/studio/wizard | usecase:health...| 0.75       | 2025-01-03 14:22:30 |
| get    | platform/studio/wizard | usecase:health...| 0.92       | 2025-01-10 09:15:00 |
```

## 🎯 Integration Points

### ✅ What's Working

1. **Wizard → Platform Memory**: `wizard.recall()` and `wizard.learn()` work
2. **API → Wizard**: `/api/pipeline/generate` calls wizard methods
3. **Frontend → API**: WizardModal fetches from API
4. **App → React Flow**: Converts backend nodes to visual nodes
5. **Node Types**: All node components render correctly

### 🚧 What's Next

1. **Real-Time Metrics**: WebSocket to show live hit rates on nodes
2. **Visual Learning Indicator**: Show when wizard is using learned patterns
   ```
   "🧠 Based on 10 similar pipelines" badge on generated pipelines
   ```
3. **Pattern Visualization**: Show confidence levels on nodes
   ```
   Node border color intensity = confidence level
   ```
4. **Interactive Learning**: Let users vote on node suggestions
   ```
   👍 This worked well → Increase confidence
   👎 This didn't work → Decrease confidence
   ```

## 🔍 Verification Commands

**Check if database tables exist**:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('platform_memory_cache', 'platform_memory_audit');
```

**See learned patterns**:
```sql
SELECT namespace, cache_key, hit_count, confidence, created_at 
FROM platform_memory_cache 
ORDER BY hit_count DESC 
LIMIT 10;
```

**Trace a wizard generation**:
```sql
SELECT * FROM platform_memory_audit 
WHERE namespace = 'platform/studio/wizard' 
ORDER BY created_at DESC 
LIMIT 20;
```

## 📝 Summary

**The cognitive layer IS fully integrated with the node system:**

✅ Backend wizard calls platform memory  
✅ Platform memory stores/retrieves patterns  
✅ API returns learned nodes to frontend  
✅ Frontend converts nodes → visual components  
✅ React Flow renders nodes on canvas  
✅ Learning loop stores successful generations  

**The platform learns from every pipeline generated and gets smarter over time.**

---

## 🚀 Next Enhancement

Add a **learning indicator** to show when the wizard is using learned patterns:

```javascript
// In WizardModal.jsx
{pipeline.learned && (
  <div className="learned-badge">
    🧠 Based on {pipeline.usage_count} similar pipelines
    <span className="confidence">{Math.round(pipeline.confidence * 100)}% confident</span>
  </div>
)}
```

This will make the cognitive intelligence visible to users.
