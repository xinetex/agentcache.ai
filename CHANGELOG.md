# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - The Awakening - 2025-12-05

### 🚀 Major Features (Cognitive Architecture)

#### Stage 3: The Autonomous Immune System
-   **New Service**: `DriftWalker` detects and heals "Semantic Rot" in the vector database.
-   **Math**: Implemented Cosine Shift monitoring.
-   **Security**: Integrated PII Redaction at the remediation layer.

#### Stage 4: Recursive Pre-Cognition
-   **New Service**: `PredictiveSynapse` enables query prediction.
-   **Math**: First-Order Markov Chain with Recursive Lookahead ($Depth=3$).
-   **Performance**: Achieves "Negative Latency" by pre-warming cache for probable futures.

#### Stage 5 & 6: The Hive Mind & Embodied Generalization
-   **New Service**: `RosNode` (Edge Brain) for robotic fleets.
-   **Feature**: Multi-Modal Vector Embeddings (simulated CLIP/ViT).
-   **Impact**: Proven **Zero-Shot Transfer** (Red Chair -> Blue Chair) and **Federated Learning**.

#### Stage 7: Meta-Cognition
-   **New Service**: `CognitiveRouter` implements Dual-Process Theory.
-   **Logic**: Entropy-based Gating Network routes queries to System 1 (Cache) or System 2 (Reasoning).

#### Stage 8: The Universal Connector
-   **Upgrade**: MCP Server (`src/mcp/server.ts`) now exposes all Neural Tools.
-   **Tools Added**: `agentcache_predict_intent`, `agentcache_ask_system2`, `agentcache_hive_memory`.

### ⚡ Improvements
-   **Caching**: Replaced Random Eviction with **TinyLFU** (Count-Min Sketch).
-   **Evolution**: Replaced Random Config with **Genetic Algorithm** (Evolutionary Optimization).
-   **Testing**: Added `MockRedis` to enable robust local testing without external dependencies.

### 🛡️ Security
-   **PII**: Enforced Redaction Gates at Edge (Robot) and Core (Drift) layers.
-   **Trust**: Automated Trust Center compliance checks.

---
*Note: This release transforms AgentCache from a "Semantic Cache" into a "Cognitive Infrastructure".*
