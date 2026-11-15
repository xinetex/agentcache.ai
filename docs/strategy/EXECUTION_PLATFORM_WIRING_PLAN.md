# AgentCache Governed Execution Platform: Wiring Plan

**Status:** Active implementation plan
**Updated:** 15 November 2026
**Product direction:** governed, traceable execution for agents; caching, memory, knowledge, and guardrails are supporting capabilities.

## Goal

Deliver one real workflow where an operator can discover an action, connect an account they own, authorize a bounded tool call, have AgentCache enforce policy before the call, and review an honest execution record afterward. Preserve existing API and SDK behavior for audio1.tv, JettyThunder, and ClawSave.

The design-partner projects are internal product surfaces, not assumed paying customers. Start with their actual workflows and validate willingness to pay separately. Begin with user-owned credentials; do not pool provider credentials or spending.

## What is wired today

| Surface | Current behavior | Gap before it is production execution |
|---|---|---|
| Model spend gate | `POST /api/governance/gate` is explicitly registered on the active Hono/Vercel app and accepts the existing AgentCache API-key contract. It evaluates the existing budget, request quota, anomaly, and kill-switch rules; estimated cost is enforced at full precision and returned to six decimals. MCP's `agentcache_gate` calls this route. | Unit coverage proves allow, budget deny, sub-cent enforcement, and missing-key rejection; the active app contract proves routing. A valid production-key decision against live organization policy still needs preview verification. |
| Legacy background run | `/api/agent/dispatch` remains for compatibility, but now identifies itself as `planning_simulation`: declared cost/savings estimates plus built-in sandbox helpers, with no model-provider or external-tool calls. Caller-declared savings stay on the run and no longer enter organization-wide savings analytics. Webhook URLs are rejected until they can be stored as owned encrypted connections. | This is not the design-partner provider workflow. Use `/api/execution/*` for governed provider actions; do not interpret simulation output as billed usage, realized savings, or live execution. |
| Hono API | `/api/execution` exposes discovery, context packs, runs, reviews/gates, owned connections, the fixed Jetty storage-summary call, invocation history, and durable decision history. Ownership checks use authenticated identity. Completed idempotent calls are replayed only after current run, policy, connection ownership/status, and scope checks pass. | Production database migration and real-account smoke test remain open. |
| Policy | `PolicyEngine` evaluates run start and the Jetty storage-summary call; the tool is also constrained by context-pack allowlisting, explicit action allow/deny lists, declared read scope, owned connection, required reviewer completion, and run gate state. Action-policy denials are persisted with versioned rule evidence before provider traffic. A direct authorization unit test covers the no-gate + pending-review case; the provider-stub contract confirms route-level denial before network access. | Tool-specific policies need a full versioned definition with ownership, risk, data-classification, and consent metadata as adapters expand. A separate no-gate route integration fixture remains desirable. |
| Execution service | Context packs, versions, runs, reviews, and gates now persist in SQL; Redis is a 90-day cache. Provider invocations and append-only redacted decision records persist separately. Invocation rows store owner and authenticated actor identity, policy-engine version, evaluated rule IDs, score, and a non-sensitive reason code. Individual reviewer identity is checked against same-organization membership, and database uniqueness constraints prevent a reviewer from claiming multiple roles or a caller from dispatching the same keyed action twice. Invocation outcomes transition only once from `started` to terminal; stale calls are marked `outcome_unknown` (never auto-replayed) after 15 minutes. Gate decisions use a SQL compare-and-set, with durable gate state taking precedence over Redis and stale run state repaired from the winning decision. Customer approvals require a different individual owner/admin member in the run organization; platform break-glass approval is isolated behind a separate admin route. Same-payload review retries return the existing review; conflicting retries fail with 409, and overlapping retries are rejected while the first write is in progress. Failed review writes release the claim only when no durable review exists. | Shared receipt source-of-truth migration and cross-store reconciliation still need operational design and verification. Legacy runs without creator actor identity fail closed for new reviews. |
| MCP | Stdio tools and the HTTP manifest expose tool discovery, owned context-pack list/create/read, run start/status/phase advancement, connection management, Jetty summary invocation, durable invocation history, decision history, and usage measurement. Context-pack creation preserves the general-sector hint and workflow policy fields. Phase advancement submits the run for review; it cannot grant administrator gate approval. Missing default API key fails closed. | No remote MCP federation/proxy. Stdio uses one configured AgentCache API key per process. Customer gate decisions require a different owner/admin member key in the run organization; platform break-glass decisions use a separate Admin Token route unavailable through MCP. |
| Console | `/execution.html` supports API-key access, encrypted owned connections, creation of a Jetty read-only workflow, organization owner/admin member-key gate decisions, summary invocation, and redacted invocation history. The Jetty pilot uses the explicit general-sector hint and one administrator approval gate; it has no separate reviewer stage because the registered action is aggregate-only and read-only. Other workflows retain default reviewer roles unless explicitly configured, and audit/clinical policies retain their required reviewer defaults. New runs require human approval by default in the console; the operator can change this before starting. Provider execution is disabled when durable invocation history cannot be loaded. For `outcome_unknown`, the fixed read-only adapter can be invoked again with a fresh idempotency key, creating a separate audit record. | Reviewer functions are checked against organization membership, but workflow labels such as `critical` and `compliance` are not mapped to distinct directory roles. No OAuth, credential refresh flow, or broader action consent. |
| Commercial | `/api/execution/usage` and MCP report completed, blocked, failed, and incomplete action counts from the invocation ledger; completed calls alone are candidate billable units. The endpoint does not charge. | Cost attribution, Stripe metering, a margin report, and external paid-pilot validation remain open. See `EXECUTION_PRICING_VALIDATION.md`. |

## Architecture and build sequence

Keep the first version narrow and compose existing Hono routing, `PolicyEngine`, `ScannerService`, MCP registry, receipts, and console. Add new services only where a clear trust boundary is missing.

### 0. Baseline and compatibility gate

- Map the current API, MCP, auth, policy, data, UI, observability, and billing contracts in a route-to-capability inventory.
- Record existing customer-critical route contracts and test them before changing shared middleware or route registration.
- Keep the strategic-market research in `GOVERNED_EXECUTION_MARKET_LANDSCAPE.md` as a hypothesis set; product-page claims are not proof of adoption or demand.

**Exit:** current execution and customer contract suites pass; changes do not alter existing SDK or customer route behavior.

### 1. Principal, tenant, and connection boundary

- Define one principal model for API keys, users, organizations, MCP clients, and operator reviewers. Resolve tenant identity only from authenticated credentials, never request-body fields.
- **Implemented in code:** add a connection record with principal owner, provider, requested scopes, unverified/active/revoked state, and timestamps. User keys share their authenticated user principal; organization keys share their authenticated organization principal, so a team can use a connection with its organization-owned runs. Agent-only keys cannot manage provider connections. Credentials are AES-256-GCM encrypted and never returned; revocation clears ciphertext. Key versions and a previous-key ring support rotation.
- Before accepting production credentials, configure the deployment encryption key, apply the migration, and review recovery/rotation operations. The current key is application-managed environment configuration, not an external KMS/HSM. Do not put plaintext secrets in Redis or ordinary database fields.
- Make disconnect/revocation invalidate future calls promptly and leave a redacted audit event.

**Exit:** owner A cannot list, invoke through, or disconnect owner B's connection; revoked credentials fail safely; no secret appears in returned data or logs. API ownership and redaction are covered by current tests; provider invocation and production deployment checks remain open.

### 2. Tool registry and consented capability model

- Define versioned tools with stable ID, provider, input/output schema, risk class, required scopes, data classification, retry behavior, timeout, and human-gate requirements.
- Add only the selected pilot adapter. Discovery describes actions and requirements; it never grants execution permission.
- Bind each connection to explicitly allowed tools/scopes. Policy checks principal + tenant + connection + tool + normalized input at invocation time.
- Keep arbitrary MCP proxying, broad catalogs, and managed paid-tool wallets out of the initial scope.

**Exit:** tool schema validates inputs; an unregistered or unauthorized action is denied before provider traffic; policy decision records contain no credentials or unnecessary sensitive payload.

### 3. Governed invocation and failure-safe run state

- Introduce a single invocation service used by API and MCP. Its sequence is: authenticate → load owned connection → validate the registered tool schema → normalize the fixed action → evaluate policy → obtain approval when required → call provider → redact/classify output → persist result and receipt. The existing Tool Safety Scanner analyzes third-party source code and MCP manifests before installation; it is not a runtime input scanner. The fixed Jetty pilot accepts no agent-supplied tool source, so its request is governed by a strict action schema, ownership/scope checks, and policy evaluation instead.
- Use idempotency keys for retryable requests; set bounded timeouts; distinguish provider errors, auth expiry, policy denial, timeout, cancellation, and incomplete/unknown outcome.
- Treat timeouts after dispatch as `outcome_unknown` until reconciled; do not blindly replay side-effecting calls.
- Record only the minimum useful execution data. Make payload retention configurable and redacted by default.

**Exit:** success, denial, provider failure, expired credential, timeout, and partial execution all produce truthful, inspectable states; high-impact calls cannot bypass approval.

### 4. Durable evidence and operator history

- Move authoritative execution, connection, approval, and audit state to tenant-scoped durable records with migrations, indexes, retention policy, and migration/rollback notes. Redis may remain a cache, not the source of truth for high-value evidence.
- Link every invocation to principal, tenant, workflow/run, tool version, connection ID, policy version/result, approval, timing, outcome, and receipt digest.
- Ensure an incomplete write cannot present a successful receipt. Make evidence completeness explicit and support reconciliation of interrupted runs.
- Add operator filters and a run detail timeline with policy rationale, approval decisions, redacted input/output summaries, errors, and recovery guidance.

**Exit:** an operator can answer who did what, against which account and policy, what happened, and whether the record is complete without seeing secrets.

### 5. One design-partner pilot

**Selected first slice:** an operator connects a user-owned JettyThunder service key, starts a general-sector context pack that allows only `jetty.storage.summary`, approves the run's administrator gate, then AgentCache reads quota and file-count metadata through two fixed read-only endpoints. It records only aggregate results and blocks unregistered actions before provider traffic. The general ontology hint prevents the ambiguous word “storage” from classifying this software workflow as an energy-sector audit workflow; strong finance and clinical vocabulary still selects its specialized policy. This gives the design partner an end-to-end low-risk execution and audit path; it does not yet mutate media or publish to Audio1.

Pilot steps:

1. **Implemented:** define the action, output boundary, declared read scopes, and prohibited unregistered actions.
2. **Implemented in code; live test pending:** connect an owned account, list/disconnect it, and mark provider credentials expired after an authentication failure.
3. **Contract-tested with a provider stub:** the full API path completes an approved quota and file-count call through the fixed adapter; reusing its caller idempotency key replays the durable result without another provider request. A different request using the same key conflicts. Live JettyThunder verification remains pending.
4. **Contract-tested:** an unregistered delete action is denied and recorded before provider traffic.
5. **Unit and API contract-tested with provider stubs:** expired credentials, permission denial, provider errors, timeout, invalid response, and durable error history are covered. Failure injection at the terminal-write boundary confirms a provider reply is returned as `execution_evidence_incomplete` and remains visibly `started`, never falsely completed. A direct authorization unit test confirms that a run with an outstanding required reviewer is denied even when no approval gate is required; the route contract separately confirms denial before provider traffic. Real database interruption/recovery and preview recovery remain pending.
6. **Implemented in code; live UI review pending:** inspect principal-owned invocation evidence from the console without file names, IDs, storage keys, or credentials.
7. **Preview acceptance runner added:** `npm run execution:verify-preview -- --confirm-preview` checks the deployed tool catalog, owned connection, pilot context, independent gate approval, one read-only Jetty call, an unregistered-action denial, and both records in invocation history. It requires an explicitly confirmed isolated Vercel Preview, separate owner and approver keys, and preconfigured test resources. It has not yet run against a deployment.

**Exit:** live owned-credential call completes; prohibited action is blocked before provider traffic; expired credentials, provider errors, and interrupted writes are verified in preview; operator understands the result from durable history; customer-critical routes remain compatible.

### 6. Commercial proof and controlled expansion

- Count successful governed actions and useful evidence/review features; define quotas, provider pass-through costs where applicable, and gross-margin floors before setting prices. The current usage endpoint is measurement-only.
- Test a simple paid pilot offer with independent prospects; do not treat project teams as customers or use internal workflow completion as willingness-to-pay evidence.
- Track activation (first authorized call), successful workflow completion, safe denial rate, approval completion, repeat workflows, time-to-investigate, support cost, and gross margin.
- Expand catalog only when a requested workflow and its support economics justify the adapter.
- Consider pooled wallets only after separate legal, liability, fraud, provider-terms, credential, spend-control, and unit-economics review.

**Exit:** observed external demand, repeat use, and positive contribution margin support a specific expansion decision.

## Cross-cutting product requirements

- **Easy to use:** a guided path from connect → select action → review access → run → inspect outcome; explain why a call is denied and how to recover.
- **Safe by construction:** least privilege, tenant isolation, secret redaction, fail closed on uncertain authorization, explicit consent for high-impact actions, and revocation.
- **Observable:** trace IDs connect request, policy, provider call, approval, receipt, and UI history; distinguish policy and provider failures.
- **Compatible:** do not rename or change established routes/SDK contracts in the initial transition; add the execution plane alongside existing services.
- **Honest:** label mock, shadow, incomplete, and simulated states; do not call a workflow “executed” until the provider outcome is verified.

## Immediate next implementation slice

1. **Complete in code:** route-to-capability and trust-boundary inventory is in `EXECUTION_SURFACE_INVENTORY.md`; API/MCP expose owned connections, fixed adapter invocation, and invocation history. Connection credentials use AES-256-GCM. The adapter has bounded calls and returns aggregate data only.
2. **Complete in code:** the selected pilot is the JettyThunder storage summary. Adapter auth semantics and fixed read endpoints were checked against its route implementation.
3. **Pricing path documented; no paid demand claimed:** revalidate the $750 audit and $1,500/month 90-day pilot hypotheses with external buyers, capture delivery costs, and use the measurement-only governed-action report. See `EXECUTION_PRICING_VALIDATION.md`.
4. **Awaiting deployment configuration:** set `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY` as a 32-byte base64 or hex secret, set `AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS` (90–2555; default 365), apply migrations `0005_agent_connections` through `0019_execution_action_budgets` with `npm run db:migrate`, then have a platform administrator configure a time-bounded action budget before enabling the pilot organization. Keep retired key versions in `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEYRING` during rotation; `AGENTCACHE_CONNECTIONS_ENCRYPTION_KEY_VERSION` selects the current version. The database verification, app rollback, and credential recovery steps are in `EXECUTION_DATA_OPERATIONS.md`; batch re-encryption is implemented but needs an operational exercise before production credentials.
5. Connect a user-owned JettyThunder test key with `serviceKey` and the `storage.read` or `metadata.read` scope, then verify successful provider access and failure recovery in a Vercel preview. Local API contracts use a provider stub and do not establish live provider behavior.
6. Verify the scheduled reconciliation marks stale invocations `outcome_unknown` without changing completed calls, and confirm that the console retrieves durable records after API worker restart.
7. Validate in a Vercel preview against the pilot and customer-critical endpoint contracts before merging.

Run `npm run execution:release-check` from the repository root before requesting the preview. It reports configuration names and readiness only; it never prints secret values. A successful local preflight does not establish that Vercel has the settings, the database has the migrations, or the provider call succeeds. Complete the manual checks printed by the command in the target preview.

## Current limitations

The current slice is one read-only provider adapter, not a general-purpose provider tool runtime. Context packs, versions, runs, reviews, and gates are SQL-backed and Redis-cached; invocation rows preserve context version, run receipt, approval gate/receipt references, and a hashed idempotency key; decision events preserve actor, outcome, phase, receipt references, and bounded redacted rationale. The protected retention job is implemented but not live-verified. Failure-injection for partial writes, shared-receipt migration, OAuth, real-database concurrent idempotency, live provider verification, and external willingness-to-pay evidence remain open. The SQL ledgers and connector require migrations and encryption-key configuration before real credentials can be used safely.
