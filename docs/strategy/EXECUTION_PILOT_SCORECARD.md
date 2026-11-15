# Governed Execution Pilot Scorecard

Use one scorecard per independent buyer. Internal design-partner work validates product behavior, not willingness to pay. Fill in observed fields from source records; label estimates and unknowns explicitly. Do not count a verbal interest or unsigned proposal as revenue.

## Commercial record

| Field | Value |
|---|---|
| Buyer / legal entity | |
| Independent external buyer? | Yes / No |
| Buyer role and purchasing authority | |
| Workflow and business consequence | |
| Existing agent platform / gateway | |
| Pilot scope and action cap | |
| Quote / order version | |
| Signed / paid status and evidence reference | |
| Pilot start and end dates | |
| Renewal / expansion decision | |

## Workflow outcome

| Measure | Baseline | Pilot result | Source / caveat |
|---|---:|---:|---|
| First approved provider action completed | | | |
| Successful governed workflow runs | | | |
| Repeated weekly workflow runs | | | |
| Policy-denied calls | | | |
| Human approvals requested / completed | | | |
| Provider failures / expired credentials | | | |
| Incomplete or outcome-unknown calls | | | |
| Median operator investigation minutes | | | |
| Time to resolve provider failure | | | |
| Review minutes per run | | | |
| Estimated customer time saved | | | Method and confidence |
| Unsafe action prevented | | | Evidence; do not infer from a denial alone |

## Delivery economics

Record allocated direct costs for the measurement window. Distinguish actual invoices from internal allocation estimates.

| Cost category | Amount (USD) | Actual / allocated | Evidence or allocation method |
|---|---:|---|---|
| Provider pass-through | | | |
| Cloud, database, cache, and observability | | | |
| Implementation and workflow configuration labor | | | Hours × loaded hourly cost |
| Support and incident response labor | | | Hours × loaded hourly cost |
| Payment processing and refunds | | | |
| Other direct delivery cost | | | |
| **Total direct delivery cost** | | | Sum above |

| Revenue calculation | Amount (USD) |
|---|---:|
| Contracted revenue, excluding taxes | |
| Less refunds / credits | |
| **Net revenue** | |
| Less total direct delivery cost | |
| **Contribution after direct delivery** | |
| **Gross margin** | `(net revenue - direct delivery cost) / net revenue` |
| Direct cost per completed governed action | `total direct delivery cost / provider-confirmed completed actions` |

If net revenue or completed action count is zero, report the rate as `not applicable`; do not impute a price or a successful action. Keep onboarding labor visible instead of burying it in product costs.

## Buyer value and competitive proof

- Recent costly incident or investigation described by buyer:
- Decision this pilot is intended to inform:
- How the buyer handles the same workflow today:
- What AgentCache evidence or recovery changed:
- What an existing gateway/agent platform already provides:
- Buyer-stated value and exact evidence:
- Objections, security review, procurement friction:
- Would buyer renew at the proposed price? Record answer, date, and role:
- Public case-study permission: yes / no / not requested

## Decision

- Weekly repeat use observed: yes / no
- External buyer paid: yes / no
- Gross margin at or above the initial 70% gate: yes / no / not measurable
- Evidence and confidence adequate for a decision: yes / no
- Decision: stop / revise scope or price / continue pilot / propose expansion
- Owner, date, and rationale:

Do not enable automatic per-action billing from this scorecard alone. Require at least two independent paying buyers, one weekly repeating pilot, a documented margin floor, and a billable unit buyers accept. Recheck competitor prices before an external quote; current comparisons are in `EXECUTION_PRICING_VALIDATION.md`.
