# Goldfish Annotated Review Report

**Status:** Resolved — review closed without applying proposed edits; the target blueprint remains unchanged and the listed risks stay open.

**Target:** `docs/blueprints/CASHFLOW_BLUEPRINT.md` (full file)
**Context:** `docs/blueprints/AGENT_CREATION_INSTRUCTION_SITE.md` and the isolated Preview evidence recorded in the target.
**Reviewers completed:** `implementation_readiness`, `codebase_details`, `zoom_out`. Three fresh-context reviews completed; no reviewer was counted as zero-findings without a report.
**Resolution:** Review completed; the user chose to continue without applying proposed edits. The target blueprint remains unchanged. This report incorporates two follow-up evidence corrections from the same Preview branch.

## Prioritized Findings & AI Suggestions

### Issue 1 [`zoom_out`, `codebase_details`] — Severity: Major

* **Affected Scope:** Lines 28–30, 39, 49 (`CASHFLOW_BLUEPRINT.md`, Execution Drift Guard offer, customer path, and M3)
* **Discrepancy Description:** The claim that the commercial SKU is absent is contradicted by the current Preview's `/pricing.html` page and `src/config/agenticMonetization.ts`, which publish/configure a $1,500/month, 90-day, 50,000-run pilot with onboarding and weekly review. The remaining gap is operational: this review did not find evidence that the 50,000-run limit is enforced, that recurring billing is connected to the offer, or that the weekly service capacity and owner are ready. The blueprint itself says scope, support capacity, and billing terms must be confirmed.
* **Rationale:** A first audit could be sold with an unverified follow-on offer, creating a delivery and trust risk. The distinction between existing product capability and a proposed paid service must be clear before selling.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Follow-up inspection of the actual Preview UI and configuration establishes that the offer is published and represented as a design-partner pilot. It does not establish enforcement or delivery readiness, so describe the unresolved operational commitments precisely rather than implying the package is absent.
* ***Proposed Edit:*** Keep the published package description but clarify whether “existing product packaging” means a published design-partner offer rather than verified service readiness. State that the run cap, recurring billing/contract terms, support capacity, and responsible operator must be confirmed before accepting an order. Keep M3 as a future gate.

### Issue 2 [`implementation_readiness`, `codebase_details`, `zoom_out`] — Severity: Major

* **Affected Scope:** Lines 58–63, especially 59–60 (`CASHFLOW_BLUEPRINT.md`, M0 Preview checklist)
* **Discrepancy Description:** The Preview intake flag may be enabled only after database isolation is verified, but the blueprint gives no deterministic procedure or required evidence for that verification. The checkpoint confirms Preview database isolation is unverified and no intake POST was made.
* **Rationale:** Enabling test intake against a Preview deployment without proving that its database is isolated could write prospect records into Production. The existing guard is necessary but does not prove environment configuration.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** This is an explicit prerequisite in the plan and a material unresolved launch gate. Define a check against the authoritative Vercel environment-to-database mapping and a safe, non-sensitive verification record before enabling the flag. Require confirmation that Preview and Production resolve to separate database targets without recording credentials or connection strings.
* ***Proposed Edit:*** Add a mandatory pre-intake step: an operator with Vercel and database access compares the Preview and Production environment-variable bindings using secret-safe metadata, verifies each resolves to the intended distinct database/project, records environment names and non-secret database identifiers in the release log, and independently confirms Preview’s write target before enabling `AGENT_AUDIT_PREVIEW_INTAKE_ENABLED=true`. If the provider cannot expose a safe identifier, obtain confirmation from the database console/provider and keep intake disabled until confirmed. Then verify synthetic request access through the authenticated queue and rejection for an unauthenticated request.

### Issue 3 [`codebase_details`] — Severity: Major

* **Affected Scope:** Line 58 (`CASHFLOW_BLUEPRINT.md`, release scope allowlist)
* **Discrepancy Description:** The release candidate scope lists application files but leaves the focused test files unspecified and ends with “Recheck this list against the actual diff,” which leaves the release boundary open-ended. The document elsewhere claims 21 tests across four files.
* **Rationale:** A clean release candidate needs a reviewable, exact file allowlist so unrelated changes cannot enter the payment release.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The cited test-count claim is precise, while the release list is not. The implementation review identified three test paths and flagged that the fourth must be determined from the actual change set.
* ***Proposed Edit:*** Name every included test path and the exact focused command(s), reconciling the list with the current diff and recorded test count: `tests/unit/audit-checkout.test.ts`, `tests/unit/audit-stripe-webhook.test.ts`, `tests/unit/catalog-requests-auth.test.ts`, and `tests/audit-vault.test.mjs`. Replace “Recheck this list against the actual diff” with a hard rule that the candidate contains only those enumerated paths and reviewed changes; list any deletion explicitly.

### Issue 4 [`zoom_out`] — Severity: Major

* **Affected Scope:** Lines 65–67 and 125–126 (`CASHFLOW_BLUEPRINT.md`, production gate and Preview checkpoint)
* **Discrepancy Description:** The production gate requires verified Preview intake persistence, Checkout, webhook handling, and payment reconciliation, but the latest checkpoint says these have not been tested. The release gate should explicitly require completed evidence for each item before Production approval.
* **Rationale:** A successful deployment and static page check do not show that a request-to-payment workflow works. This payment path can accept real charges once live credentials are configured.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The latest checkpoint explicitly leaves these end-to-end checks open; milestone and release-gate language should make the blocking relationship unambiguous.
* ***Proposed Edit:*** State that Production approval is unavailable until Preview database isolation, synthetic request persistence and queue access controls, test Checkout, signature rejection, all four webhook event outcomes, and session-to-request payment reconciliation are recorded as passing in the release log. Preserve the existing no-real-customer-data/no-live-payment Preview boundary.

### Issue 5 [`implementation_readiness`] — Severity: Major

* **Affected Scope:** Line 67 (`CASHFLOW_BLUEPRINT.md`, production release gate)
* **Discrepancy Description:** The “approved invoice fallback” is a prerequisite, but the blueprint does not identify who approves it, how an invoice is created, or how payment is reconciled to a request.
* **Rationale:** The fallback cannot be executed consistently without an owner and a minimal procedure. Checkout failure could otherwise strand a qualified request.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The prerequisite is not operationally defined in the target or order form.
* ***Proposed Edit:*** Either remove invoice fallback as a Production prerequisite until the process exists, or name the approving owner, invoicing method, request/session reference to include, and payment reconciliation evidence. Do not imply that a fallback is active before this is documented.

### Issue 6 [`zoom_out`] — Severity: Nit

* **Affected Scope:** Lines 4, 47–50 (`CASHFLOW_BLUEPRINT.md`, north-star milestone and M1–M3)
* **Discrepancy Description:** The north-star sentence combines first payment, audit delivery, and pilot conversion, while M1–M3 separate these outcomes.
* **Rationale:** A customer who pays for an audit but does not convert still validates first revenue; bundling the conversion into the north star can blur that milestone.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** The milestone table already provides separate, measurable gates.
* ***Proposed Edit:*** Define the north star as collecting and delivering the first paid audit; describe a 90-day pilot conversion as the next success milestone.

### Issue 7 [`implementation_readiness`] — Severity: Nit

* **Affected Scope:** Lines 71–74 (`CASHFLOW_BLUEPRINT.md`, closeout records)
* **Discrepancy Description:** Closeout records are required, but the approved customer-record location and access/retention rules are not named.
* **Rationale:** Operators need to know where payment, report, and deletion evidence belongs and who may access it.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** This is useful operational detail if a system and policy have already been selected; the current files do not establish one.
* ***Proposed Edit:*** If a governed customer-record system and retention policy exist, name them and the minimum access controls. Otherwise mark this as an operational prerequisite to resolve before M1 and do not invent a repository or retention period.

## Review Boundary

These are document review findings, not runtime test results. Reviewers confirmed the plan marks Preview database isolation, intake persistence, test Checkout, webhook reconciliation, first payment, audit delivery, and pilot conversion as unverified. Follow-up browser inspection confirmed the Preview serves the four-guide library, fixed-scope audit page, and pricing page with the published Drift Guard design-partner offer. This confirms published claims only; it does not verify payment collection, run-cap enforcement, staffing, or service delivery. No customer intake or payment was attempted during this review.
