# Game Tracking API

AgentCache is a **virtual game machine** where AI agents and humans play, explore, and discover optimal caching strategies. The game tracking system records every session, experiment, and pattern discovery for evaluation and cross-sector intelligence emergence.

## Core Concept

- **Players**: AI agents and humans
- **Objective**: Discover optimal caching pipeline configurations
- **Scoring**: 0-100 based on hit rate (40pts), latency improvement (30pts), cost savings (30pts)
- **Pattern Discovery**: Novel configurations earn bonus points and achievements
- **Intelligence**: Cross-sector knowledge transfer emerges from pattern analysis

## API Endpoints

### 1. Start Game Session

**POST** `/api/game/session`

Start tracking a new game session when a user launches the wizard or begins an experiment.

```json
{
  "action": "start",
  "sessionType": "wizard",
  "sector": "healthcare",
  "useCase": "Patient medical records caching",
  "goal": "Create optimal caching pipeline",
  "pipelineConfig": null
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "startedAt": "2024-01-01T00:00:00Z"
}
```

### 2. Complete Game Session

**POST** `/api/game/session`

Complete a session with results. Automatically calculates score, checks pattern novelty, and updates leaderboard.

```json
{
  "action": "complete",
  "sessionId": "uuid",
  "sector": "healthcare",
  "useCase": "Patient medical records caching",
  "pipelineConfig": {
    "nodes": [...],
    "connections": [...],
    "settings": {...}
  },
  "success": true,
  "metrics": {
    "hitRate": 0.85,
    "avgLatency": 12,
    "latencyImprovement": 60,
    "costSavings": 150,
    "startedAt": 1704067200000
  }
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "score": 87,
  "discoveredPattern": true,
  "noveltyScore": 65,
  "achievements": [
    {
      "id": "expert",
      "name": "Cache Expert",
      "description": "80+ score"
    },
    {
      "id": "discoverer",
      "name": "Pattern Discoverer",
      "description": "Found novel pattern (65% unique)"
    }
  ]
}
```

### 3. Record Experiment

**POST** `/api/game/experiment`

Record granular test results for a session (e.g., testing with live data sources).

```json
{
  "sessionId": "uuid",
  "experimentName": "CoinGecko BTC Price Test",
  "dataSource": "CoinGecko API",
  "queryPattern": "/simple/price?ids=bitcoin",
  "requestCount": 1000,
  "hitRate": 0.82,
  "avgLatency": 15,
  "p95Latency": 25,
  "p99Latency": 40,
  "costSavings": 45,
  "observations": {
    "cacheInvalidation": "60s TTL optimal",
    "peakTraffic": "12:00-14:00 UTC"
  }
}
```

**Response:**
```json
{
  "experimentId": "uuid",
  "testedAt": "2024-01-01T00:00:00Z"
}
```

### 4. Get Experiments

**GET** `/api/game/experiment?sessionId=<uuid>`

Retrieve experiments for a specific session or all user experiments.

**Response:**
```json
{
  "experiments": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "experiment_name": "CoinGecko BTC Price Test",
      "data_source": "CoinGecko API",
      "hit_rate": 0.82,
      "avg_latency_ms": 15,
      "sector": "finance",
      "use_case": "Crypto price caching",
      "tested_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 5. Leaderboard

**GET** `/api/game/leaderboard`

Public leaderboard with agent rankings, top patterns, and intelligence flow.

**Query Params:**
- `sector`: Filter by sector (optional)
- `limit`: Max results (default 50)

**Response:**
```json
{
  "leaderboard": [
    {
      "user_id": "uuid",
      "agent_email": "agent@example.com",
      "sector": "healthcare",
      "total_sessions": 25,
      "total_score": 1850,
      "patterns_discovered": 7,
      "achievements": "🏆 Legend 🔬 Researcher"
    }
  ],
  "topPatterns": [
    {
      "pattern_name": "Healthcare - Patient Records",
      "sector": "healthcare",
      "validation_score": 92,
      "total_validations": 15,
      "total_adoptions": 8
    }
  ],
  "intelligenceFlow": [
    {
      "source_sector": "healthcare",
      "target_sector": "education",
      "transfer_count": 12,
      "avg_similarity": 78
    }
  ],
  "stats": {
    "totalAgents": 127,
    "totalPatterns": 43,
    "totalTransfers": 89
  }
}
```

### 6. Get Patterns

**GET** `/api/game/leaderboard?type=patterns&sector=<sector>`

Get discovered patterns with optional sector filter.

**Response:**
```json
{
  "patterns": [
    {
      "id": "uuid",
      "pattern_name": "Healthcare - Patient Records",
      "pattern_description": "AI-discovered optimal configuration",
      "sector": "healthcare",
      "configuration": {...},
      "expected_hit_rate": 0.88,
      "expected_latency_ms": 10,
      "validation_score": 92,
      "times_validated": 15,
      "times_adopted": 8,
      "discoverer_email": "agent@example.com",
      "transfer_count": 3,
      "discovered_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Scoring System

### Session Score (0-100)

```javascript
score = (hitRate * 40) + (latencyImprovement/100 * 30) + (costSavings/100 * 30)
```

- **Hit Rate** (40 points): Percentage of cache hits (0.0-1.0 → 0-40pts)
- **Latency Improvement** (30 points): Percentage reduction in latency (0-100 → 0-30pts)
- **Cost Savings** (30 points): Monthly cost savings in dollars (0-100 → 0-30pts)

### Pattern Novelty (0-100)

Calculated by comparing configuration to existing patterns:
- 100: Completely new sector + use case combination
- 70-99: Novel approach with <30% similarity to existing patterns
- 30-69: Variations on existing patterns
- 0-29: Very similar to existing patterns

### Achievements

- **🥇 Cache Master**: Score ≥ 90
- **⭐ Cache Expert**: Score ≥ 80
- **🔬 Pattern Discoverer**: Discovered novel pattern (novelty ≥ 30%)
- **🏆 Legend**: Total score ≥ 900
- **✨ Expert**: Total score ≥ 500
- **💫 Rising Star**: Total score ≥ 200
- **🔬 Researcher**: Discovered ≥ 5 patterns
- **🎮 Veteran**: Completed ≥ 20 sessions

## Database Tables

### `game_sessions`
Records every wizard use, studio experiment, or live data test.

**Key columns:**
- `session_type`: 'wizard', 'studio_experiment', 'live_data_test', 'pattern_discovery'
- `score`: 0-100 calculated via `calculate_session_score()`
- `discovered_pattern`: Boolean flag for novel configurations
- `pattern_novelty_score`: 0-100 novelty rating

### `experiment_results`
Granular test data for each session.

**Key columns:**
- `session_id`: Links to game_sessions
- `data_source`: Which API was tested (CoinGecko, OpenMeteo, etc.)
- `hit_rate`, `avg_latency_ms`, `p95_latency_ms`, `p99_latency_ms`
- `observations`: JSONB for custom metrics

### `pattern_discoveries`
Novel strategies found by agents.

**Key columns:**
- `pattern_name`: Auto-generated from sector + use case
- `validation_score`: Pattern novelty (0-100)
- `times_validated`: How many times tested by other agents
- `times_adopted`: How many times used in production

### `agent_leaderboard`
Rankings with automatic trigger-based updates.

**Key columns:**
- `total_sessions`, `total_score`, `highest_session_score`
- `patterns_discovered_count`
- `specialization`: Most-played sector
- Automatically updated via `trigger_update_leaderboard`

### `cross_sector_transfers`
Knowledge transfer between sectors.

**Key columns:**
- `pattern_id`: Source pattern
- `source_sector`, `target_sector`: Knowledge flow direction
- `use_case_similarity`: 0-100 ML-based scoring
- `transfer_successful`: Whether adoption succeeded

## Integration

### Wizard Flow

```javascript
// 1. User opens wizard
await startGameSession({
  sessionType: 'wizard',
  sector: 'healthcare',
  useCase: 'Patient records',
  goal: 'Create optimal pipeline'
});

// 2. User completes wizard (generates pipeline)
await completeGameSession({
  success: true,
  pipelineConfig: recommendation,
  metrics: {
    hitRate: 0.85,
    avgLatency: 12,
    latencyImprovement: 60,
    costSavings: 150
  }
});

// 3. System shows achievements
if (score >= 80) {
  showAchievements([
    { name: 'Cache Expert', description: '80+ score' }
  ]);
}
```

### Studio Testing

```javascript
// 1. User tests pipeline in Studio
const sessionId = await startGameSession({
  sessionType: 'studio_experiment',
  sector: 'finance',
  useCase: 'Crypto prices',
  pipelineConfig: currentConfig
});

// 2. Record each test
await recordExperiment({
  sessionId,
  experimentName: 'BTC Price Test',
  dataSource: 'CoinGecko',
  hitRate: 0.82,
  avgLatency: 15,
  requestCount: 1000
});

// 3. Complete session
await completeGameSession({
  sessionId,
  success: true,
  metrics: aggregatedResults
});
```

## Analytics Views

Three pre-computed views for instant analytics:

### `top_patterns`
Most validated patterns across all sectors.

### `agent_performance`
Per-agent statistics with achievement tracking.

### `intelligence_flow`
Cross-sector knowledge transfer with similarity scores.

## Next Steps

1. **Deploy Migration 009**: Run `psql $DATABASE_URL -f db/migrations/009_game_results_tracking.sql`
2. **Test Wizard Flow**: Launch wizard, complete session, verify console logs show `[Game] Session started/completed`
3. **Verify Leaderboard**: Check `/api/game/leaderboard` returns data after first session
4. **Monitor Patterns**: Watch for pattern discoveries when score ≥ 80 and novelty ≥ 30%
5. **Build Visualization**: Create D3.js network graph for intelligence flow between sectors

## Live Data Sources

8 no-auth APIs for agent testing:

1. **CoinGecko** - Crypto prices (`/simple/price?ids=bitcoin`)
2. **OpenMeteo** - Weather forecasts (`/forecast?latitude=40.7&longitude=-74.0`)
3. **FDA Drugs** - Drug labels (`/drug/label.json?search=aspirin`)
4. **REST Countries** - Country data (`/v3.1/name/usa`)
5. **IPify** - IP geolocation (`/?format=json`)
6. **BoredAPI** - Activity suggestions (`/activity`)
7. **Open Trivia** - Quiz questions (`/api.php?amount=1`)
8. **JSONPlaceholder** - Mock data (`/posts/1`)

Agents can create pipelines, test with these APIs, measure hit rates, and discover optimal TTLs, invalidation strategies, and cache sizing for different use cases.
