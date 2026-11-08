# Agent Run Risk & Savings Audit — Warm Account Playbook

Purpose: find the fastest qualified first audit through existing account relationships. The account descriptions below come from AgentCache's project documentation; every proposed workflow is a hypothesis to validate, not a claim about a customer's current operations.

## Account hypotheses

| Account | Workflow hypothesis to validate | Useful evidence if the workflow exists | First question |
| --- | --- | --- | --- |
| audio1.tv | Any agent-assisted media operations around ingest, transcription, asset metadata, or delivery triage | Redacted run IDs, step/tool names, retry counts, operator review decisions, and time/cost per completed asset | “Do you currently use an agent to handle any recurring media workflow, or is that process fully deterministic?” |
| jettythunder.app | Any agent that classifies, routes, summarizes, or acts on enterprise files | Redacted action sequence, approval boundary, evidence/receipt references, rework rate, and time to resolve an item | “Is an agent making or recommending file-workflow actions today, and which action would be costly to get wrong?” |
| clawsave.com | Any agent-driven storage workflow where tool actions need policy, confirmation, or auditable outcomes | Redacted tool-action sequence, policy checks, approval outcomes, retries, and duplicate work | “Which storage actions can an agent initiate today, and where does a person review or approve them?” |

Do not pitch the audit if the answer is that the workflow is not agent-driven, the owner cannot provide a safe redacted sample, or the impact is too small to justify $750. Ask for an introduction only through the account owner or an existing approved customer channel. Do not use integration access or telemetry as implicit customer consent.

## 20-minute fit call

1. **Context (3 min):** identify one production or serious pilot workflow and the person accountable for it.
2. **Pain (5 min):** ask what repeats, drifts, requires manual review, or creates cleanup when it fails. Request one recent example without names or raw records.
3. **Evidence (5 min):** establish whether up to 100 redacted run records can show ordered actions, outcomes, approvals, and cost/latency fields. Do not ask to receive data during the call.
4. **Value (4 min):** agree on the decision the buyer wants the audit to inform and one baseline they already track or can estimate from records.
5. **Qualification (3 min):** confirm a technical owner, secure handoff path, authority to purchase the $750 audit, and whether procurement requires the order form.

## Qualification decision

Proceed only when all are true:

- One named, active agent workflow has an operational risk or repeat-work question.
- A technical owner can explain intended behavior and confirm which evidence is safe to share.
- A redacted sample is available through a customer-approved secure handoff.
- The buyer understands the five-business-day clock starts after kickoff and complete, acceptable inputs.
- The buyer agrees this is a findings report with estimates, not a savings guarantee.

If qualified, send the `/agent-audit` link and the order-form template if procurement asks for it. Use the recorded scope acknowledgment and payment confirmation as the order record unless their purchasing policy requires signatures. Do not request raw traces until secure handoff terms are agreed. Start delivery only after Stripe or an issued invoice confirms payment.

## Outcome tracking

For each conversation, record the account, workflow hypothesis confirmed or rejected, owner role, impact question, evidence availability, next step, and reason lost. Keep customer names and personal contact details out of this playbook; store account notes in the approved CRM.
