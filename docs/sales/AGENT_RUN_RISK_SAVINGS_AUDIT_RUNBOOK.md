# Agent Run Risk & Savings Audit — Delivery Runbook

**Offer:** one workflow, up to 100 redacted run records, $750 one-time fee.
**Delivery target:** five business days after kickoff and receipt of complete, acceptable inputs.

## Before kickoff

1. Use `GET /api/catalog/requests?status=payment_received` with the admin token to find the paid `Agent Run Risk & Savings Audit` request. Confirm its offer ID and stored payment state; do not start from a form submission or an open Stripe session. Keep the admin token in the approved secret store and out of customer-facing systems.
2. Confirm the recorded scope acknowledgment version. If the buyer needs procurement documentation, complete and countersign `AGENT_RUN_RISK_SAVINGS_AUDIT_ORDER_FORM.md`; do this before payment when the buyer's purchasing policy requires a signed order.
3. Confirm the buyer, one named technical owner, one workflow, expected action, and success question in a short kickoff.
4. Agree on a customer-approved secure handoff method. Do not ask for uploads through the public form, email credentials, API keys, raw customer records, or regulated data.
5. Ask for a high-level workflow map and up to 100 de-identified runs. Request only fields needed to assess the workflow: pseudonymous run ID, expected intent, ordered tool/action names, approval outcome, final outcome, timestamps, token/cost/latency fields when available, and evidence references. Exclude prompt bodies and tool arguments unless the customer has explicitly reviewed and redacted them.
6. Record the received date, sample size, omissions, consented use, and deletion/return expectation with the customer. Start the five-day target only when inputs are complete and accepted.

## Analysis

Create a private working copy with a customer-approved identifier. For each run, compare intended steps to observed steps and label findings as:

- `DRIFT`: step order, tool, destination, or outcome diverged from the declared workflow.
- `POLICY GAP`: a sensitive or consequential step lacks an explicit policy decision or required human approval.
- `EVIDENCE GAP`: the action or result cannot be supported by an available source, event, or receipt.
- `REPEAT WORK`: the workflow repeats equivalent retrieval/model/tool work where reuse may be safe.
- `FRESHNESS RISK`: an observation or cached result may be stale relative to the declared update tolerance.
- `UNKNOWN`: sample or instrumentation does not support a conclusion.

Separate observed counts from estimates. For any cost opportunity, show the input source and formula (for example, repeat requests × observed unit cost). Do not turn an assumed cache hit rate into claimed savings. Do not call manual review an AgentCache-certified evaluation.

When the customer's workflow is instrumented through AgentCache, use the available execution evaluation, policy, and receipt records as supporting evidence. Cite the relevant run/evaluation/receipt identifiers in the report. Do not imply external customer logs were processed by those APIs unless they actually were.

## Report template

### 1. Decision summary

- Workflow and audit dates:
- Sample size and representativeness limits:
- Three highest-priority findings:
- Recommended next decision: proceed / instrument first / no pilot recommended.

### 2. Baseline

| Measure | Observed value | Data source | Confidence / caveat |
| --- | --- | --- | --- |
| Runs reviewed | | | |
| Drift findings | | | |
| Human review coverage | | | |
| Evidence coverage | | | |
| Median / p95 latency, if supplied | | | |
| Repeated work and cost estimate, if supplied | | | |

### 3. Findings

For each finding: ID, category, severity, evidence reference, observed condition, operational consequence, confidence, and proposed mitigation. Keep evidence distinct from interpretation.

### 4. Economics

Show only customer-supplied or directly observed inputs. Calculate a scenario range when the result depends on unknown hit rate, model pricing, or traffic mix. Label it `modeled opportunity`, never `savings achieved`.

### 5. Recommended next steps

List actions by owner and order: instrumentation, policy/human gate, freshness rule, reuse candidate, and measurement window. Recommend the $1,500/month, 90-day Execution Drift Guard pilot only when there is a specific workflow and weekly success measure to monitor.

### 6. Limitations and data closeout

State missing telemetry and sample limits. Confirm whether the customer wants the source sample returned or deleted, then record completion. Retain the report and only the minimum evidence needed under the agreed handling terms.

## Review and close

1. Have a second technical reviewer check calculations, evidence links, and language that may imply guarantees.
2. Deliver through the agreed secure channel and hold a 30-minute readout.
3. Ask whether the findings merit a monitored pilot. If yes, define the workflow, weekly measures, technical owner, and 90-day scope in writing before creating the pilot invoice.
4. Update the account scorecard with payment date, delivery effort, measured result, conversion status, and permission (or no permission) for any public case study.
