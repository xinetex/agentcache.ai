# AgentCache Cashflow Blueprint

**Status:** In progress
**North-star milestone:** Collect the first customer payment for an Agent Run Risk & Savings Audit, deliver and review the report, and convert that customer into a 90-day Execution Drift Guard pilot.

## Commercial thesis

Sell a measurable outcome to teams already operating multi-step agents: identify workflow drift and policy gaps, estimate repeated-work costs from observed data, then give the team a monitored path to reduce operational risk. For customers already instrumented through AgentCache, cite the available execution evaluations, policy decisions, and run receipts. For other customers, analyze only the agreed de-identified sample and label missing telemetry and estimates clearly.

The initial wedge is a productized service, not a speculative token or marketplace. Human buyers can approve a bounded scope and pay through ordinary business payment rails. x402 is a later machine-to-machine channel after its payment payload verification, facilitator settlement, replay protection, and treasury address are real and production-tested.

## Agent-creation instruction hypothesis

AgentCache can also become a discovery site for agents that need to create artifacts in controllable apps such as Blender. A free, versioned playbook library could attract agent builders and activate AgentCache APIs. Test two paid paths: custom workflow/playbook work and the existing audit offer. This is a product experiment, not a revenue forecast. The separate [Agent Creation Instruction Site blueprint](AGENT_CREATION_INSTRUCTION_SITE.md) defines the content format, rights gates, Blender pilot, and evidence milestones. Keep the existing audit offer as the near-term paid path until instruction-driven acquisition and conversion are measured.

## The offer

### Agent Run Risk & Savings Audit — $750 fixed fee

- One production or near-production agent workflow.
- Up to 100 customer-provided, redacted run records; no credentials, secrets, or unnecessary personal data.
- Delivery target: five business days after kickoff and AgentCache confirms that the agreed inputs are complete and acceptable. Incomplete inputs pause the target until accepted.
- Findings: drift patterns, policy/evidence gaps, repeat-work and cache opportunities, and a baseline scorecard.
- Deliverable: prioritized report, measured baseline with assumptions shown, scoped rollout recommendation, and a 30-minute findings readout.
- No guarantee of savings or risk elimination. Findings depend on the sample and instrumentation provided.
- One-time fee; the site's general non-refundable fee terms apply, except where applicable law requires otherwise.

### Execution Drift Guard — $1,500 per month, 90-day pilot

Existing product packaging: up to 50,000 evaluated runs per month, shadow-mode evaluation and receipts, operator onboarding, and weekly review. Total pilot value is $4,500 before any separately agreed expansion. Confirm scope, support capacity, and billing terms in a written order form before accepting payment.

## Customer path

1. **Discover:** `/agent-audit` explains the buyer, fixed scope, price, inputs, timing, and next step.
2. **Intake:** the prospect submits work email, company, workflow, monthly model spend band, and a short description through the service-request API. The form records the request before presenting secure checkout.
3. **Collect:** after the buyer confirms the one-workflow scope and site terms, a server-created Stripe Checkout Session charges exactly $750. The session is tied to the saved request; `/api/audit/checkout` checks the Checkout Session, while `/api/billing/webhook` processes signature-verified success, delayed-success, failure, and expiry events. If Stripe is not configured, no simulated checkout is returned and the saved request remains available for manual follow-up. The launch operator reviews the admin-only request queue and contacts the buyer if checkout cannot start. Do not treat a contact-form submission or x402-shaped header as payment.
4. **Onboard:** the launch operator confirms a named customer technical owner, workflow, success question, consent, and secure handoff method. The customer de-identifies the sample before transfer. Start the delivery target only after kickoff and acceptance of complete inputs; the delivery runbook defines the input checklist and closeout.
5. **Deliver:** run the bounded analysis using existing execution and receipt capabilities; produce the findings report and review it with the buyer.
6. **Convert:** present the 90-day Drift Guard pilot as a separate purchase, tied to the audit's measured baseline and findings; start with weekly scorecards.
7. **Expand:** convert only after evidence of operational value; price higher volume, guardrails, knowledge, or storage as separate scoped add-ons.

## Milestones and gates

| Milestone | Goal | Evidence to exit |
| --- | --- | --- |
| M0 — Sellable offer | Publish one clear page and a payable intake path | Price/scope are consistent across page, catalog, and server config; accepted scope is persisted; valid submissions create a service request; live Checkout, verified webhooks, and payment reconciliation work in deployment |
| M1 — First paid audit | Close and collect payment from one qualified team | Recorded versioned scope acknowledgment or countersigned order form, verified payment, named technical owner, and agreed data handoff |
| M2 — Delivered proof | Complete the audit and present findings | Completed report template from the delivery runbook; readout date and attendee recorded; baseline, assumptions, limitations, and next steps reviewed |
| M3 — Recurring pilot | Convert the audit customer to the 90-day pilot | Signed pilot order, first $1,500 payment, named technical owner, connected workflow evidence, written weekly review schedule, and success measure |
| M4 — Repeatable motion | Repeat with two additional buyers | Three paid audits or pilots total; customer permission for any case-study content recorded; delivery hours, direct costs, and gross margin documented |

## Detailed implementation and launch plan

The audit implementation is local to this worktree and is not live. Keep the production release separate from the existing mixed worktree changes. Build a clean release candidate from the intended base branch and include only reviewed files for this offer; do not deploy unrelated local changes with the payment path.

### M0 — Prepare and verify a preview

1. **Review the release scope:** include the audit page (`public/agent-audit.html`), checkout handler (`api/audit/checkout.js`), shared webhook changes (`api/billing/webhook.js`), route rewrite (`vercel.json`), versioned offer config (`src/config/agentRunAudit.js`), request/catalog persistence changes (`src/api/catalog.ts`), and the focused audit/catalog tests. Recheck this list against the actual diff before creating a release candidate.
2. **Keep preview isolated:** Vercel Preview must use Stripe test-mode credentials, the matching test webhook secret, and a database isolated from Production. Audit intake is disabled in Preview unless `AGENT_AUDIT_PREVIEW_INTAKE_ENABLED=true`; set this flag only after verifying the preview database target. The checkout handler rejects live-key prefixes outside production. Never copy secret values into logs or this plan.
3. **Verify request intake:** after confirming database isolation and enabling the Preview flag, load `/agent-audit`; submit a synthetic test request with the current scope acknowledgment; confirm the request and accepted scope version are persisted and visible only through the admin-authenticated queue. Confirm a missing or stale acknowledgment is rejected. Until the flag is enabled, the request route must return 503 without creating a record.
4. **Verify Checkout:** confirm a saved, acknowledged request creates a Stripe test Checkout Session for exactly $750 and links it to that request. Confirm an open session is reused, a processing delayed payment blocks another session, and expired or failed sessions can be retried without duplicate charges.
5. **Verify payment events:** configure Stripe test delivery to `/api/billing/webhook`. Check rejection of an invalid signature and test the exact events handled by the route: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Confirm stored state and the buyer-facing result agree after webhook handling and after the browser's `/api/audit/checkout?session_id=…` lookup.
6. **Close preview evidence:** record the deployment URL, commit, test session IDs, request IDs, webhook delivery results, admin-queue result, and any failures in the release log. No real customer data or live payment is used in this phase.

### Production release gate

Request production release approval only after the preview checklist passes and the team has confirmed: live Stripe configuration and webhook signing secret in Vercel Production; the production webhook URL `/api/billing/webhook` and four event types above; `ADMIN_TOKEN` access to the paid-request queue; a named launch operator who monitors new requests and payment status; the approved invoice fallback; published Terms and Privacy pages; an agreed secure customer data handoff; and a staffed five-business-day delivery capacity. After production approval, verify page availability, intake persistence, live webhook delivery, and payment reconciliation before advertising live checkout. Do not use a local production purchase as a test.

### M1–M4 closeout records

- **M1:** retain accepted scope version (or signed order form), verified payment/session reference, named technical owner, and agreed handoff method against the request ID.
- **M2:** retain the completed report, evidence and assumptions, readout date, attendees, and input deletion/return confirmation in the approved customer record.
- **M3:** retain the signed pilot scope, payment confirmation, connected workflow evidence, owner, success measure, and weekly review schedule.
- **M4:** retain customer case-study permission and the three engagements' delivery hours, direct costs, and gross margin. Do not publish customer material without written permission.

## First 30 days

- **Days 1–3:** prepare the isolated release candidate; verify page, intake persistence, test-mode Checkout, signature rejection, and success/delayed-success/failure/expiry reconciliation on a Vercel Preview deployment; complete the data-handling and order-form process. Request the production release only after the preview checklist passes.
- **Days 4–10:** founder-led outreach to 30 qualified AI platform/engineering leaders with production agent workloads. Ask for a 20-minute workflow fit call; do not send broad volume mail.
- **Days 11–20:** run discovery, qualify against spend, repeated workflow, instrumentation access, and technical owner; close the first fixed-fee audit.
- **Days 21–30:** deliver the audit, present findings, and propose the 90-day pilot against measured gaps.

## First-customer acquisition

Start with warm access to teams that already have a production agent workflow. AgentCache's existing customer relationships are possible introduction paths, not proof that a workflow is qualified or that its data may be accessed. Ask the account owner for an introduction; scope the audit and obtain explicit customer approval before receiving any traces. Prioritize the workflow that has a named engineering owner, a real cost/risk question, and enough run metadata to measure it. The [warm account playbook](../sales/AGENT_RUN_AUDIT_WARM_ACCOUNT_PLAYBOOK.md) gives account-specific hypotheses and a qualification call. If none of the warm paths qualifies, build a list of 30 AI platform or applied-AI engineering leaders at teams already operating agents.

**Founder outreach draft (not yet sent):**

> Are you running a multi-step agent workflow where a wrong or unverified tool action creates meaningful cleanup? AgentCache is offering a fixed-scope $750 audit of one workflow: we review up to 100 redacted runs, return prioritized drift, evidence, and repeat-work findings, and walk through the report with your team in a 30-minute readout. Delivery is within five business days after kickoff and once the agreed inputs are complete and accepted. If that maps to a current workflow, could we spend 20 minutes checking fit?

The ask is a fit call, not a claim of savings. Do not send this to contacts until the user or account owner selects the recipients and authorizes outreach.

### Price checkpoint

Public price points checked on 2026-11-07 ranged from $299 for one limited workflow review to $799 for up to three workflows from one productized provider; a separate consultancy lists €4,950 for a narrow 2–4 week quick scan and €24,500 for a broader 8–12 week full audit. These scopes are not equivalent and this small sample is not a market survey. Keep $750 as the first-three-customer validation price for the narrower operational evidence audit, including a 30-minute readout. After three qualified sales conversations or paid deliveries, review objections, delivery hours, and conversion before setting a longer-term price. [Agent Security Audit pricing](https://agentsecurityaudit.com/pricing/) · [ePotentia AI Trust & Security](https://www.epotentia.com/ai-security/)

## Current checkpoint

- Offer page, request intake, fixed-price Checkout endpoint, webhook/session reconciliation, machine-readable catalog entry, blueprint, delivery runbook, buyer order form, and warm-account qualification playbook exist in the worktree.
- The intake API now requires the current versioned scope acknowledgment for audit requests, stamps the accepted version on the request, and checkout rejects requests without that record. A buyer order-form template covers procurement workflows that need signatures.
- Checkout uses Stripe-managed payment methods, a stable idempotency key per request attempt, reuses an open session, blocks another session while a delayed payment is processing, and permits a new attempt after expiration or confirmed failure. Signed webhook reconciliation covers immediate and delayed success, payment failure, and expiration.
- The focused audit/catalog tests pass (21 tests across four files), the application build passes, and `git diff --check` is clean. The full TypeScript check still reports unrelated existing errors in `_attic/agent-approve.superseded.ts`, `files2/audit-log.ts`, and `src/api/agent.ts`.
- A read-only check of `https://agentcache.ai/agent-audit` and `https://agentcache.ai/api/audit/checkout` on 2026-11-07 returned 404 for both routes; this offer is not deployed. Live Stripe credentials/webhook delivery, public intake persistence, first payment, audit delivery, and pilot conversion remain unverified. No customer has been charged and no outreach has been sent.
- A read-only `vercel env ls production` check returned no project or environment details, so live Stripe and admin-token configuration could not be confirmed from this workspace.
- The next release step is a Vercel deployment. It would publish a page capable of collecting real $750 payments when live Stripe credentials are configured, so deployment remains behind the explicit approval gate.

## Operating scorecard

Track weekly: qualified conversations, fit calls held, audit proposals, paid audits, time to collect, report delivery time, audit-to-pilot conversion, monthly recurring revenue, and customer-approved measured outcomes. Do not report modeled savings as achieved savings.

## Launch blockers and safeguards

- Stripe secret and webhook configuration are environment-dependent; the webhook endpoint is `/api/billing/webhook`. Verify live-mode credentials and signed event delivery in Vercel Production only after the production release gate. Never run production purchases using local credentials.
- `ADMIN_TOKEN` must be configured for the team to retrieve private intake and paid-request records through the admin-only queue.
- Do not use x402 for human audit checkout. Enable machine-to-machine collection only after a real facilitator settlement, verified payment payload, replay protection, and controlled treasury address are independently tested.
- Intake and payment records do not themselves create a secure file transfer. The launch operator must review the admin-only request queue, arrange kickoff, and agree on the handoff method before receiving run data. Follow the delivery runbook and published site terms.
- Never ask prospects to paste raw prompts, credentials, customer records, or regulated data into the public intake form.
- Keep the user's existing worktree changes intact; this blueprint only governs the cashflow implementation.

## Live check — 2026-11-08

- `https://agentcache.ai/create` is live and displays the three Blender playbooks.
- `https://agentcache.ai/agent-audit` returns Vercel `404 NOT_FOUND`; `https://agentcache.ai/api/audit/checkout` returns `404 Not Found`.
- M0 is therefore still open: the instructional site is live, while the paid audit page and payable intake path are not deployed. No payment, customer intake, or outreach has occurred.
- The isolated candidate is on `codex/agentcache-audit-playbook-preview`; GitHub comparison currently shows seven commits ahead of `main`, with no base-branch divergence. Vercel reported a successful Preview status for `0832f48b`; the latest docs-only revision `259d8303` was still pending at the last status check. On the branch preview alias, `/create` displayed all three Blender playbooks and `/agent-audit` rendered the $750 offer, scope, timing, data boundary, and terms links. `GET /api/catalog/revenue-core` returned the matching offer; unauthenticated `GET /api/catalog/requests` returned `Unauthorized: Admin access required`; and `GET /api/audit/checkout?session_id=cs_invalid` returned “Secure checkout is not configured yet. Your request has not been charged.” No intake POST was submitted. Preview database isolation is unverified, so request persistence, test Checkout, and webhook reconciliation remain untested.
- The production release gate is documented in the detailed plan above. Production remains unchanged; keep live checkout gated until preview database isolation, Stripe test configuration, webhook reconciliation, and remaining operational prerequisites are verified.
- The live `GET /api/catalog` response also advertises `paymentProtocols: ["x402"]` and returns the literal wallet placeholder `0xAgentCacheMasterWallet`. Treat it as nonfunctional metadata: it does not establish valid payment routing or settlement and must not be used to collect money. Remove or replace this advertisement only in a separately reviewed, verified payment release; ordinary Stripe Checkout remains the near-term human payment path.
- The candidate audit Checkout handler rejects live Stripe key prefixes outside `VERCEL_ENV=production` and accepts only test-mode key prefixes in non-production environments. A focused regression case covers a preview environment accidentally carrying a live key. The code is included in the candidate branch; successful deployment does not verify the runtime configuration or execute this guard against Vercel secrets.
- A fresh local Blender 5.2.0 LTS smoke pass ran all three playbook scripts in separate temporary output folders, visually inspected each render, then reopened all three saved `.blend` projects in a separate process with scene assertions. Results and environment caveats are recorded in `docs/blueprints/agent_tutorial_catalog/spikes/blender-seed-smoke-2026-11-08.md`; this verifies the local seed scripts, not remote script fetch or an external agent run.
