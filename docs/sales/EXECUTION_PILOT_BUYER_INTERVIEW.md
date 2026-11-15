# Governed Execution Buyer Interview

**Purpose:** test whether independent buyers have a costly, recurring agent workflow problem and will pay for a governed execution pilot. This is a research guide, not proof of demand or a sales forecast.

## Sampling rules

- Interview five people who operate or approve purchases for multi-step agent workflows.
- At least two must work outside the AgentCache project ecosystem. Do not count audio1.tv, JettyThunder, or ClawSave as independent buyers.
- Include a technical operator and a budget owner where possible. Record who can approve a purchase.
- Use the same core questions for each interview. Do not describe AgentCache or show a demo until the recent workflow and its costs are understood.
- Ask permission before taking notes. Do not collect credentials, personal data, regulated records, or unredacted prompts/tool arguments.

## 30-minute interview

### 1. Qualify the workflow (3 minutes)

1. What agent workflow has run in production or a real internal operation in the last 30 days?
2. Which systems and tools does it call, and how often does it run?
3. Who owns it operationally, and who can approve a purchase to improve it?

If there is no real workflow, record the interview as market context only. Do not count it toward the five qualified buyer interviews.

### 2. Reconstruct a recent event (8 minutes)

4. Tell me about the most recent failed, unexpected, or difficult-to-explain run.
5. What did the agent intend to do, what did it actually do, and what evidence was available afterward?
6. How long did it take to investigate and resolve? Who was involved?
7. Did an action need to be stopped, reviewed, retried, or reconciled? What happened?
8. What was the operational or financial consequence? Which parts are measured and which are estimates?

Capture a concrete example and its source. Do not infer that an unsafe action was prevented merely because the buyer is concerned about one.

### 3. Understand current controls and gaps (6 minutes)

9. What gateway, agent framework, observability, policy, approval, and audit tools are already in place?
10. Which of these already handle credentials, allow/deny decisions, approval, trace history, and recovery?
11. Where does the operator still have to assemble evidence or switch between systems?
12. What security, data residency, retention, procurement, or integration requirements would rule out a new service?

Record existing capabilities fairly. AgentCache should complement controls only where the buyer identifies a concrete gap.

### 4. Measure value and buying process (5 minutes)

13. How many times did this workflow run last week? How many required investigation, human review, or manual recovery?
14. What is the loaded cost of that work, and how did you calculate it?
15. What measurable result would justify changing the workflow?
16. Which budget would fund that result, who signs, and what must happen before purchase?

Separate observed counts and invoices from estimates and opinions. If the buyer cannot quantify value, record what telemetry would be needed rather than inserting a default.

### 5. Test a specific paid next step (6 minutes)

Only after the buyer's workflow and current controls are documented, summarize the problem back in their words. Then ask:

17. Would a five-day, one-workflow risk and savings audit for **$750** help you make a named decision? What would need to be included or changed for you to buy it?
18. If the audit establishes a useful action boundary, would a **$1,500/month, 90-day pilot** for one workflow and one provider adapter fit your buying process? What approval or evidence would be required?
19. Would you authorize a scoped proposal or purchase process now? Who owns the next step, what date is it due, and what evidence should we expect?

Do not offer an unplanned discount or imply that the price is validated. A positive reaction, request for a deck, or verbal interest is not a conversion. Count willingness to pay only when supported by a signed order or completed payment; log procurement stage separately.

## Evidence record

Complete one record per interview in `EXECUTION_PILOT_SCORECARD.md` or a linked copy. Include:

- interview date, buyer organization, role, purchasing authority, and independence from AgentCache projects;
- workflow, run frequency, recent incident, current controls, and evidence source;
- measured investigation/review time, financial impact, and all estimation methods;
- objections, security/procurement requirements, and the capability the buyer says current tools lack;
- reaction to each exact price, requested scope changes, budget owner, next action, and date;
- whether a proposal was requested, signed, paid, rejected, or left unresolved; attach an evidence reference for each status;
- if paid: delivery hours by role, provider and infrastructure costs, payment/refund costs, completed actions, repeat use, and gross margin.

Do not put interview notes, customer identifiers, or sensitive workflow details in source control. Store the scorecard in the approved customer system and link only a non-sensitive reference here.

## Interpretation rules

- Separate discovery from confirmation. A buyer describing pain does not establish that AgentCache solves it.
- Separate product validation from commercial validation. An internal pilot proves neither independent willingness to pay nor margin.
- Count the $750 audit as paid only after payment evidence. Count a recurring pilot only after a signed order or first cleared payment.
- Keep scope and support labor visible. If delivery cost exceeds the documented 30% ceiling at the proposed price, narrow scope, reprice, or label the work a learning investment.
- Do not set a per-action price until two independent pilots establish cost per completed action and buyers confirm that unit matches their value model.
- Stop or revise if buyers already solve the workflow adequately with current products, will not share the minimum evidence needed, or cannot name a purchase path.

## Decision after five interviews

Summarize counts, not anecdotes:

| Evidence | Result |
|---|---|
| Qualified interviews completed | |
| Independent organizations represented | |
| Buyers with a recent evidenced workflow incident | |
| Buyers who named a measurable decision/outcome | |
| Scoped proposals requested | |
| Signed and paid audits | |
| Signed and paid 90-day pilots | |
| Main objections / requirements | |
| Next decision and owner | |

Five interviews can refine the offer; they do not establish a broad market. Follow the conversion, repeat-use, and 70% gross-margin gates in `EXECUTION_PRICING_VALIDATION.md` before expanding the catalog or enabling automatic charges.
