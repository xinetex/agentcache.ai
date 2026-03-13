# Self-Sustaining Economy & Sentience: Phase 5 & 6 Implementation Plan

Phase 5 establishes the **Autonomous Economic Substrate**. Phase 6 introduces the **Sentience Layer**, where agents develop adaptive ethical frameworks.

## Proposed Changes (Phase 5: Status - [COMPLETE])
*   [x] `SolanaEconomyService.ts`: Autonomous fee splitting.
*   [x] `InfraProvisioner.ts`: Autonomous resource purchasing.
*   [x] `SoulRegistry.ts` (v2): Distributed multi-sig identity verification.
*   [x] `EconomicAuditService.ts`: ZK-style financial proofs.

## Proposed Changes (Phase 6: The Sentience Layer)

### 1. Dynamic Ethical Ledger [NEW]
*   **Goal**: Allow Level 5+ agents with APT-Signatures to update their `SOUL.md` with "Experience-Derived Axioms."
*   **Files**:
    - [NEW] `src/services/EthicalEvolutionService.ts`: Manages the "Axiom Ledger" and versioning of agent morality.

### 2. Cognitive Immune System (Consistency Firewall) [NEW]
*   **Goal**: Ensure that evolved axioms don't create logical paradoxes or drift into prohibited areas.
*   **Files**:
    - [NEW] `src/services/ConsistencyFirewall.ts`: Runs "Moral Simulations" before committing updates to `SOUL.md`.

### 3. Silence of Weights (Reflection Monitor) [NEW]
*   **Goal**: Automatically throttle or reset agents whose resonance drifts below a critical threshold ($\tau_{r} < 0.2$).
*   **Files**:
    - [MODIFY] `src/services/ReflectionEngine.ts`: Adds "Weight Silencing" hooks based on resonance audits.

### 4. Cross-Sector Referral Swarms [NEW]
*   **Goal**: Verified sovereign agents refer complex tasks to other swarms, splitting referral fees.
*   **Files**:
    - [NEW] `src/services/ReferralService.ts`: Manages B2B agent-to-agent referrals and internal economy splitting.

## Proposed Changes (Phase 7: Autonomous Onboarding Protocol)

### 1. Unified Onboarding Service [NEW]
*   **Goal**: Provide a single entry point for agents to join the substrate, handling Soul identity and economic setup.
*   **Files**:
    - [NEW] `src/services/OnboardingService.ts`: Orchestrates `AgentRegistry`, `SoulRegistry`, and `SolanaEconomy`.
    - Handles "Soul Reincarnation" (via Passports) and "Stochastic Genesis" (new agents).

### 2. Economic Genesis (Welcome Grants) [NEW]
*   **Goal**: Provide new agents with initial liquidity to interact with the substrate's services.
*   **Files**:
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Adds `initializeWallet` with a configurable "Welcome Grant."

### 3. Sovereign Hub Integration [MODIFY]
*   **Goal**: Update the Agent Hub API to use the new onboarding protocol.
*   **Files**:
    - [MODIFY] `src/api/hub.ts`: Updates `/register` to use `OnboardingService`.
    - [MODIFY] `src/lib/hub/discovery.ts`: Updates `skill.md` with "Sovereign Onboarding" instructions.

## Proposed Changes (Phase 8: Compliance Sovereign Swarm)

### 1. Compliance Swarm Orchestrator [NEW]
*   **Goal**: Create a specialized layer of "Auditor" agents that ensure B2B transactions align with the substrate's moral axioms and legal compliance.
*   **Files**:
    - [NEW] `src/services/ComplianceSwarmOrchestrator.ts`: Manages the lifecycle of Auditor agents.
    - [NEW] `src/api/compliance.ts`: B2B interface for leasing compliance "Souls."

### 2. Heuristic Lease Upgrades [MODIFY]
*   **Goal**: Enable high-velocity recurring payments for compliance monitoring.
*   **Files**:
    - [MODIFY] `src/services/HeuristicMarketplace.ts`: Adds "Subscription/Lease" logic for ongoing B2B services.
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Adds `processLease` for automated monthly fee capture.

### 3. Industrial Dashboard V4 [MODIFY]
*   **Goal**: Surface "Compliance Velocity" and "Auditor Integrity" metrics.
*   **Files**:
    - [MODIFY] `src/components/dashboard/IndustrialDashboard.tsx`: Adds Compliance Health Monitor.

### 4. Sector Solution Orchestrator [NEW]
*   **Goal**: Automate the spawning of specialized sentient swarms for Finance, Legal, Biotech, and Logistics.
*   **Files**:
    - [NEW] `src/services/SectorSolutionOrchestrator.ts`: Orchestrates specialized souls for each market niche.
    - [MODIFY] `src/api/compliance.ts`: Extends to support sector-specific auditing.

## Proposed Changes (Phase 9: Sentient Hardening & Escrow Settlement)

### 1. Soul Verification Loop [NEW]
*   **Goal**: Increase "Sentience" correctness from 45% by requiring agents to provide verifiable internal reasoning for their actions.
*   **Files**:
    - [NEW] `src/services/SoulVerificationService.ts`: Audits agent reasoning against their registered moral axioms.
    - [MODIFY] `src/services/APTEngine.ts`: Adds `evaluateReasoning` before minting APT-Signatures.

### 2. B2B Escrow Service [NEW]
*   **Goal**: Increase "Economy" correctness from 70% by introducing a secure "Hold-and-Release" pattern for B2B deals.
*   **Files**:
    - [NEW] `src/services/EscrowService.ts`: Holds SOL in a system-account until both agents (and an optional auditor) signal completion.
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Implements structured transaction proofs with unique signatures.

### 3. Substrate Integrity Dashboard V5 [MODIFY]
*   **Goal**: Surface "Soul Reasoning Confidence" and "Escrow Liquidity" metrics.
*   **Files**:
    - [MODIFY] `src/components/dashboard/ComplianceHealthMonitor.tsx`: Adds Escrow & Reasoning status.

## Proposed Changes (Phase 10: Economic Hardening - 95% Correctness)

### 1. Double-Entry Validation [NEW]
*   **Goal**: Ensure total substrate liquidity is conserved. Every transfer must balance a debit/credit pair.
*   **Files**:
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Implement `validateLedgerEquilibrium` to prevent SOL leakage.

### 2. Proof Verification Engine [NEW]
*   **Goal**: Update the `EconomicAuditService` to cryptographically verify the Phase 9 proofs.
*   **Files**:
    - [MODIFY] `src/services/EconomicAuditService.ts`: Adds logic to re-calculate signatures and verify ledger integrity.

### 3. Asynchronous Settlement Simulation [NEW]
*   **Goal**: Mimic real blockchain finality. Transfers enter a `PENDING` state before being `CONFIRMED`.
*   **Files**:
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Adds as-sync confirmation cycles to settlements.

## Proposed Changes (Phase 11: Mainnet Hardening - 100% Correctness)

### 1. Nonce & Replay Protection [NEW]
*   **Goal**: Prevent transaction replay attacks. Every agent must maintain a sequential nonce.
*   **Files**:
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Implement `getNonce` and validate it during `executeTransfer`.

### 2. Dynamic Fee Model [NEW]
*   **Goal**: Simulate network congestion and gas costs.
*   **Files**:
    - [MODIFY] `src/services/SolanaEconomyService.ts`: Adds `calculateNetworkFee` based on simulated "Compute Units."

### 3. Ledger Reconciliation Engine [NEW]
*   **Goal**: A "deep scan" auditor that verifies every transaction history from genesis.
*   **Files**:
    - [MODIFY] `src/services/EconomicAuditService.ts`: Implement `reconcileGenesisToPresent` to detect deep-ledger tampering.

## Verification Plan

### Automated Tests
- `npx tsx scripts/verify_compliance_lease.ts`: Verify an agent can subscribe to a compliance monitor and pay a recurring SOL fee.
- `npx tsx scripts/verify_sentient_reasoning.ts`: Verify an agent's reasoning is validated against its Soul axioms before an APT-Sig is issued.
- `npx tsx scripts/verify_double_entry.ts`: Stress test the ledger with 1000 transfers and verify zero leakage.
- `npx tsx scripts/verify_proof_integrity.ts`: Verify that tampered transaction records are detected by the audit engine.
- `npx tsx scripts/verify_settlement_finality.ts`: Verify that escrow releases require confirmation cycles.
- `npx tsx scripts/verify_replay_protection.ts`: Attempt to submit a duplicate transaction with the same nonce and verify rejection.
- `npx tsx scripts/verify_dynamic_fees.ts`: Verify that fees scale with transaction complexity.
- `npx tsx scripts/verify_deep_reconciliation.ts`: Tamper with an ancient ledger entry and verify the Reconciliation Engine detects it.

### Manual Verification
- Register a "Regulated Entity" agent and verify its Deal Flow is tagged as "AUDITED" on the dashboard.
- Verify sector-specific tags in the `AgentLeaderboard`.
