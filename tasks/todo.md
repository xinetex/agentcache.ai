# Active Tasks: Enhancement Iteration 3

## Objective: Moltbook Focus Group (Agent Feedback Loop)

### 1. Analysis
- [ ] Assess `MoltbookService` capabilities (Read/Write).
- [ ] Determine best agent for the job (Sentinel or new "Product Researcher").

### 2. Implementation
- [x] **Service**: Implement `getReplies(postId)` in Moltbook Service.
- [x] **Agent**: Configure "Researcher" persona to ask targeted product questions.
- [x] **Dashboard**: Add "Community Feedback" widget to Mission Control.

### Completed Iteration 3 (Moltbook Focus Group)
- [x] Connected Feedback Loop to Dashboard.
- [x] Deployed Researcher Agent (Simulated).
- [x] Implemented "Bot Funnel" Campaign (Trust Vector).
- [x] Secured "The Sentinel" (Hidden from public marketplace).

### Phase 4: Solution Mechanics (Semantic Cache)
- [x] **Audit**: specialized code review of `LidarCacheService` and `VectorClient`.
- [x] **Vector**: Implement `VectorClient.embed(text)` and `search(vector)`.
- [x] **Cache**: Upgrade `LidarCacheService` to check Vector Index before falling back to LLM.
- [x] **Demo**: Create `api/solutions/support-cache` to demonstrate the logic.

### Phase 5: The Lidar Gateway (Platform)
- [x] **Infrastructure**: Create `api/v1/chat/completions.ts` (Isolated Namespace).
- [x] **Logic**: Implement "Cache-First" Proxy logic (Check Lidar -> Call LLM -> Store).
- [x] **Compliance**: Add PII Redaction stub.
- [x] **Verify**: Ensure generic `audio1.tv` and `jettythunder` endpoints are untouched.
- [x] **Verify**: Ensure generic `audio1.tv` and `jettythunder` endpoints are untouched.
- [x] **Observability**: Connected Gateway logs to Mission Control.

### Phase 6: Solana Payments
- [x] **Research**: Determine best libraries (Solana Pay vs Web3.js) for payment flow.
- [x] **Infrastructure**: Create `src/services/SolanaService.ts`.
- [x] **wallet**: Implement "Pay with Crypto" in Pricing and "Connect Wallet" in Auth.
- [x] **payments**: Create `api/pay/solana` to generate payment links/QR codes.
- [x] **verify**: Implement on-chain transaction listener to confirm payment.

### Phase 7: Professional Notification System
- [x] **Schema**: Define `notifications` table (id, userId, type, message, read, metadata).
- [x] **Service**: Create `src/services/NotificationService.ts` for dispatch logic.
- [x] **API**: `GET /api/notifications` and `POST /api/notifications/read`.
- [x] **UI**: Add "Bell" dropdown to Mission Control and Global Nav.
- [x] **Wire-up**: Connected Solana, Stripe, and GrowthAgent to Notification System.
