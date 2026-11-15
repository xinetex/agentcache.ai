# Governed Execution: Pricing and Proof Plan

**Status:** pricing hypotheses and measurement contract; no per-action price validated yet
**Market pages checked:** 15 November 2026
**Goal:** establish repeatable willingness to pay and positive delivery margin before turning on automatic usage charges.

## Market evidence

Public pricing puts pressure on generic tool-call infrastructure:

| Product surface | Published pricing observed | What this means for AgentCache |
|---|---|---|
| Composio Developer Platform | Hobby includes 100K tool calls/month and 3 team members; Pro is $29/month with $29 monthly credits, then $0.0003 per own-app/API-key/MCP call. Selected execution modes and managed apps have separate rates. Platform Pro supports metered spend caps. | A basic API call is a commodity unit. AgentCache should charge for controls, evidence, and operator outcomes rather than raw proxying. |
| Composio For You | Free includes up to 3 members, 10K calls/month, and a one-time $2 credit; Standard is $18/seat/month with 10K calls per seat and $18 monthly pooled credits. Standard includes SSO and Firewall; Free does not. Credits pay for Instant and extra usage. | Competitor pricing varies by product surface; do not combine this seat plan with the developer-platform plan. |
| Composio Instant and Firewall | Instant uses provider accounts, charges the shared Composio balance at published provider rates with 0% markup, and has per-tool pricing. Its marketing page says 1,500+ tools; the wider Platform/For You pages say 1,700+ apps/toolkits. The Instant pricing catalog has shown 87 apps and 2,805 tools, while the landing-page preview showed 73 apps during this check; treat displayed counts as dynamic and scope-dependent. Firewall checks tool requests/results and is included on For You Standard; on Developer Platform it is a $0.50 / 1M tokens add-on for Pro and included on Enterprise. Instant docs say Session API has no dollar-cap parameter and prepaid balance checks are asynchronous; Platform Pro separately offers metered spend caps. | Tool access, policy, and approval are already competitive product surfaces. AgentCache must prove workflow evidence/recovery across owned systems, not assume governance alone is differentiated. Avoid provider-cost and wallet liability in the first offer. |
| Arcade | Free includes 2,000 calls/month; Team is $25/month plus $0.01 per call; Enterprise is custom and includes controls such as SSO, RBAC, and audit logs. | Per-call prices can range widely with packaging and managed-runtime value. Audit and enterprise controls support a platform-fee hypothesis. |
| LangSmith | LangSmith Engine uses LangChain Standard Units (LSUs), listed at $1 each; published estimates are roughly 7–45 LSUs per Engine run. This is Engine trace analysis/fix work, not a per-trace retention rate. | This supports a willingness-to-pay reference for analysis work, not direct evidence that buyers pay for audit retention. Do not use it as an audit storage benchmark. |

Sources checked 15 November 2026: [Composio Developer Platform pricing](https://composio.dev/pricing/platform), [Composio For You pricing](https://composio.dev/pricing/for-you), [Instant catalog and prices](https://composio.dev/pricing/for-you/instant-tools), [Composio Instant](https://composio.dev/instant), [Instant spending and approval docs](https://docs.composio.dev/docs/instant-tools), [Composio Firewall docs](https://docs.composio.dev/docs/firewall), [Arcade pricing](https://www.arcade.dev/pricing/), [LangSmith pricing](https://www.langchain.com/pricing). Vendor prices and capabilities change; re-check before publishing AgentCache rates. Distinguish Composio Platform meter caps from the Instant Session API, which has no dollar-cap parameter; confirm controls directly during any competitive evaluation.

## Recommended first offer to test

Use the existing commercial anchors as hypotheses, not validated market facts:

- **$750 one-time Agent Run Risk & Savings Audit:** one workflow, up to the configured redacted record limit, findings report, and readout. This is an entry diagnostic and qualification step.
- **$1,500/month for a 90-day Execution Drift Guard pilot:** one agreed workflow, one initial provider adapter, policy setup, operator history, and a server-enforced time-bounded action cap agreed in scoping. The cap reserves before provider traffic and counts provider attempts, including provider errors; policy-denied calls and idempotent replays do not count. Quote provider pass-through costs separately. The exact cap and service labor must be recorded in each order.
- Do not publish a per-action overage rate yet. The current public catalog call count is far below the enterprise workflow value proposition, and no AgentCache cost or willingness-to-pay data supports a rate.

The pilot should measure buyer value in reduced investigation time, prevented unsafe calls, review effort, repeat use, and time to resolve provider failures. Keep denied, failed, and incomplete calls visible, but do not count them as billable actions. Only a provider-confirmed completed action is a candidate billable unit.

### Delivery-cost guardrail at the proposed prices

At the initial **70% gross-margin target**, direct delivery cost must stay at or below 30% of net revenue. This is a planning ceiling, not measured AgentCache economics:

| Offer hypothesis | Net revenue assumption | Maximum direct delivery cost at 70% margin | What must fit inside the ceiling |
|---|---:|---:|---|
| $750 one-time audit | $750 before taxes/refunds | $225 total | analyst/reviewer labor, report preparation, tooling, allocated infrastructure, and payment fees |
| $1,500 monthly pilot | $1,500 per month before taxes/refunds | $450 per month | onboarding/configuration labor, support, provider pass-through, cloud/observability allocation, and payment fees |

Use **net revenue after discounts, refunds, and credits** for the actual calculation. At a loaded direct-labor rate of `$L` per hour, the labor-only ceilings would be `$225 / L` hours for the audit and `$450 / L` hours per pilot month; actual labor budgets must be lower after reserving room for non-labor costs. If the measured delivery scope exceeds these limits, reduce scope, reprice, or explicitly treat the offer as a learning investment rather than claiming it meets the margin gate. Do not compensate for a missed margin by counting unpaid founder labor as zero cost.

## Measurement wired into the product

`GET /api/execution/usage` and MCP `agentcache_execution_usage` report month-to-date counts by tool and outcome from the SQL invocation ledger:

- completed calls (candidate billable units)
- policy-blocked calls
- provider errors
- started calls without a terminal record
- completed workflow runs, repeated context-pack versions, and active weeks

The endpoint returns `billingMode: pilot_measurement_only`, `rateUsd: null`, and `deniedActionsBillable: false`. It does not charge. Repeated workflow versions count distinct completed runs against the same context-pack version; active weeks count UTC calendar weeks with a completed provider action. Usage follows the authenticated organization when the API key resolves one; otherwise it follows the authenticated principal. These are operational usage signals, not support-hour, cloud-cost, buyer-value, or willingness-to-pay evidence, and they do not constitute a Stripe invoice.

## Validation experiment

1. Interview five qualified buyers who operate multi-step agents and can approve a purchase. Include at least two outside the AgentCache project ecosystem. Ask for a recent incident or investigation cost before presenting the offer.
2. Offer the $750 audit only when a buyer can provide a redacted sample and name a decision the audit will inform. Record acceptance, objection, procurement friction, paid status, and delivery labor.
3. Offer the $1,500/month, 90-day pilot only after the audit or equivalent workflow discovery establishes a real action boundary, operator, reviewer, and expected weekly usage.
4. For each pilot, log completed/denied/failed/incomplete actions, weekly active operators, approval time, repeat workflows, provider costs, cloud/observability costs, support hours, and time saved or risk avoided. Never treat an internal project as an independent paying customer.
5. Continue only if at least two external buyers pay for the pilot or audit, at least one pilot repeats the workflow weekly, and measured direct delivery cost supports a documented gross-margin floor. Use **70% gross margin** as the initial internal gate; revise it if finance establishes a better company-wide floor.
6. Set an overage rate only after cost per completed action and buyer value are measured across two independent pilots. Confirm that the rate covers variable infrastructure, support allocation, and payment fees while preserving the agreed margin floor.

Use [`EXECUTION_PILOT_BUYER_INTERVIEW.md`](../sales/EXECUTION_PILOT_BUYER_INTERVIEW.md) to run consistent, non-leading discovery and paid-offer tests. Use [`EXECUTION_PILOT_SCORECARD.md`](./EXECUTION_PILOT_SCORECARD.md) to capture each buyer's workflow result, signed/paid evidence, support and implementation labor, variable costs, buyer-stated value, and renewal signal. Calculate gross margin from net revenue less directly attributable delivery costs; keep allocated labor labeled as an estimate. The scorecard reports cost per provider-confirmed completed action, but that is a diagnostic and does not imply that per-action pricing is the correct buyer value unit.

## Decision rules

- **No paid conversions:** revisit the buyer, problem, and entry offer; do not add catalog breadth as a substitute for demand.
- **Paid audit, no recurring pilot:** keep the diagnostic as a service motion and re-check whether software can repeatedly deliver the promised outcome.
- **Pilot use with weak margin:** narrow onboarding/support scope, increase base fee, or set an included action cap before adding overage pricing.
- **Repeat usage and margin above gate:** pilot a simple base platform fee plus included successful actions; price additional successful actions only after buyers confirm that the unit matches their value model.
- **Provider-funded access:** separate decision requiring provider terms, credential custody, fraud controls, spend limits, and a new liability/unit-economics review.

No prospects have been contacted by this work. The experiment is ready to run through approved customer channels once an operator and test environment are assigned.
