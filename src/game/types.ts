// Core simulation types for cache optimization engine

export type PolicyType = "LRU" | "LFU" | "MultiplexDecay";
export type Sector = "filestorage" | "healthcare" | "finance" | "ecommerce" | "gaming" | "iot" | "general";
export type TrafficPattern = "steady" | "bursty" | "spiky" | "longtail" | "diurnal";

// Individual request flowing through the system
export interface Request {
  id: string;
  timestamp: number;        // Sim time in ms
  userId: string;
  prompt: string;
  embedding?: number[];     // For semantic cache
  costTokens: number;       // Cost if cache miss
  latencyMs: number;        // Filled when processed
  hit: boolean;             // Cache hit?
  servedByNodeId: string;   // Which cache tier served it
  qualityScore?: number;    // 0-1, for hallucination tracking
}

// Cached item in a cache node
export interface CacheItem {
  key: string;
  value: any;
  createdAt: number;        // ms
  lastAccessedAt: number;   // ms
  accessCount: number;
  costToRecomputeTokens: number;
  qualityScore: number;     // 0-1, higher is better
  sizeBytes: number;
}

// Cache node (L1, L2, L3, LLM, etc.)
export interface CacheNode {
  id: string;
  type: "memory" | "redis" | "vector" | "llm" | "origin";
  tier: "L1" | "L2" | "L3" | "origin";
  capacity: number;         // Max items
  baseLatencyMs: number;    // Latency per request
  costPerCallTokens: number; // 0 for cache, high for LLM
  policyId: string;
  items: Map<string, CacheItem>;
}

// Cache eviction policy configuration
export interface PolicyConfig {
  id: string;
  type: PolicyType;
  params: {
    ttlMs?: number;
    freqWeight?: number;
    recencyWeight?: number;
    costWeight?: number;
    stalenessPenalty?: number;
  };
}

// Traffic pattern for workload generation
export interface TrafficPattern {
  startTimeMs: number;
  endTimeMs: number;
  requestsPerSecond: number;
  promptDistribution: PromptTemplate[];
}

export interface PromptTemplate {
  id: string;
  category: string;
  probability: number;      // 0-1, sum to 1.0
  avgTokens: number;
}

// Scenario definition (workload + targets)
export interface Scenario {
  id: string;
  name: string;
  sector: Sector;
  trafficPattern: TrafficPattern;
  targetMetrics: {
    minHitRate: number;
    maxAvgLatencyMs: number;
    maxTokenCostPerMin: number;
  };
  duration: number;         // Total sim duration in ms
}

// Simulation metrics
export interface SimMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  tokensSpentTotal: number;
  tokensPerMinute: number;
  hallucinationRisk: number; // 0-1, derived from low-quality cache items
  costSaved: number;        // Estimated $ saved
  
  // Per-tier breakdown
  tierMetrics: {
    [tier: string]: {
      hits: number;
      avgLatency: number;
    };
  };
}

// Complete simulation state
export interface SimulationState {
  timeMs: number;
  scenario: Scenario;
  nodes: CacheNode[];
  requestsInFlight: Request[];
  completedRequests: Request[];
  metrics: SimMetrics;
  config: SimulationConfig;
}

// Configuration for simulation engine
export interface SimulationConfig {
  policy: PolicyConfig;
  nodeCapacities: {
    L1: number;
    L2: number;
    L3?: number;
  };
  semanticCacheEnabled: boolean;
  semanticThreshold?: number;
}

// Player action (for interactive mode)
export type PlayerAction =
  | { type: "SetNodePolicy"; nodeId: string; policyId: string }
  | { type: "SetNodeTTL"; nodeId: string; ttlMs: number }
  | { type: "SetNodeCapacity"; nodeId: string; capacity: number }
  | { type: "ToggleSemanticCache"; nodeId: string; enabled: boolean };

// Result from optimization
export interface OptimizationResult {
  config: SimulationConfig;
  metrics: SimMetrics;
  score: number;            // Composite reward score
  confidence: number;       // 0-1, based on consistency
  testCount: number;        // How many simulations averaged
}

// Recommendation for a specific workload
export interface Recommendation {
  id: string;
  workloadPattern: {
    sector: Sector;
    trafficPattern: TrafficPattern;
    avgQPS: number;
  };
  optimalConfig: SimulationConfig;
  expectedMetrics: SimMetrics;
  confidence: number;
  basedOnSimulations: number;
  createdAt: Date;
  alternatives: SimulationConfig[];
}
