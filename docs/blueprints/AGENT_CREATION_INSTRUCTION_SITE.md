# Agent Creation Instruction Site

**Status:** Product hypothesis / local blueprint
**North-star:** An agent follows a versioned playbook to create an artifact in a desktop app, verifies the artifact, and can explain what it did and what remains uncertain.

## Recommendation

Make AgentCache an agent-first library of creation playbooks: instructions for agents to produce useful work inside Blender and other controllable applications. Each playbook should be both readable by a person and structured for an agent to execute, check, and recover from.

Use the Synfig cut-out animation tutorial as an information-design reference: it moves from preparing materials through import, organizing layers, setting pivots, animating, and troubleshooting. Do not copy its prose or media. The specific older wiki page's reuse license has not been verified. The current Synfig Manual identifies CC BY-SA 4.0 for its manual content, but page-level and asset-level rights must still be checked before adapting any particular page or image.

This should become the discovery and onboarding layer for AgentCache, while the existing paid audit remains the near-term cashflow offer. Free, useful playbooks can attract agent builders; custom playbook engineering and verified execution are plausible paid services after demand is measured. Keep the intent paths distinct: authors who need a new artifact procedure can scope a custom playbook; teams already running agents can follow the $750 audit path. The library should state the audit's scope, price, and delivery trigger before sending buyers to its intake page.

## The user problem

Agents can call application APIs or manipulate an interface, but conventional tutorials assume a human can infer missing details. An agent needs:

- a precise target artifact and acceptance checks;
- required inputs, app/version, and expected starting state;
- safe, ordered actions with explicit tool/API choices;
- checkpoints after risky or irreversible changes;
- recovery instructions when an action fails;
- a clear distinction between verified output and an unverified claim.

The product is not a scrape-and-rewrite content farm. Its value is turning valid source knowledge into executable, tested procedures with provenance and application-version checks.

## Guide format

Every guide should have a human page and a machine-readable record. Proposed record:

```yaml
id: blender.product-turntable
title: Create and render a simple product turntable
app: Blender
app_version: pin-to-tested-release
status: draft # draft | tested | verified | stale
goal: Save a Blender project and a rendered image of a rotating object.
inputs: []
permissions:
  - create_files_in_output_directory
network: none
steps:
  - id: create-scene
    action: ...
    verify: ...
    recovery: ...
sources: []
license_record: {}
last_verified: null
```

Publication rules:

- `draft` means the steps have not been run against the stated app version.
- `tested` means a maintainer ran the workflow and checked its output.
- `verified` means a second run reproduced the expected artifact and the checks passed.
- Expired app versions or failed scheduled checks move a guide to `stale`; agents should see that state before execution.
- Prefer a stable application API such as Blender's Python interface over brittle screen coordinates. Provide UI automation only where the API cannot perform the task.
- Require a user checkpoint before overwriting existing files, installing add-ons, using paid assets, uploading work, or performing destructive edits.

## First pilot: Blender

Start with an original, self-contained task: create a simple animated product turntable, save the `.blend` project, render a still, and verify both files. This exercises scene construction, animation, output handling, and artifact validation without relying on customer assets.

For each run, verify at minimum:

1. Blender exits successfully and the project file exists in the designated output directory.
2. Reopening the project succeeds and the expected objects, camera, lights, and animation range are present.
3. A render completes with the expected dimensions and non-empty image output.
4. The guide reports its app version, output paths, checks run, and any limitations.

Blender 5.2.0 LTS is installed. The three pilot playbooks have each passed two successful runs, project reopening checks, and visual review on that version; see the validation report. Do not extend this verification claim to other Blender versions.

## Source and license policy

Use an allowlist of official application manuals, APIs, and sources with explicit reuse terms. Fetch politely, follow site access rules, and retain only the metadata and excerpts needed for review. Do not bypass authentication, rate limits, or technical restrictions. A public page is not automatically reusable.

For every source, record URL, author/publisher, retrieval date, page-specific license, license URL, media/code exclusions, required attribution, share-alike terms, and review status. If rights are unclear or restricted, do not store or republish the text, screenshots, icons, sample assets, or code. Prefer original procedures built from product behavior and public API facts, with source links for readers.

The Blender Manual states that its text is generally CC BY-SA 4.0 or later, while excluding logos, trademarks, icons, source code, and Python scripts. Any adapted manual text must carry the required attribution and compatible share-alike licensing; write code samples independently and verify their own rights. Do not put a CC BY-SA adaptation behind terms that restrict the license rights.

AgentCache's existing `lib/ingest-guard.js` already fails closed for unknown/restricted redistribution licenses and stamps provenance/PII outcomes. That gate is useful for source triage, but it does not by itself establish permission to adapt a tutorial, scrape a site, or reuse its images and code. Add page-level rights review before building an automated crawler.

### Source-to-playbook workflow

1. Accept an official tutorial/API reference URL and target application/version. Do not crawl a site by default; check its terms, robots policy, rate limits, and page-specific reuse terms before retrieval.
2. Store source metadata and the minimum notes needed for editorial review. Do not mirror source prose, screenshots, scripts, assets, or full pages into the public library. If rights are unresolved, record the URL and mark it `unresolved`; do not publish adapted content.
3. A human author extracts the task intent and independently writes agent steps: preconditions, bounded actions, verification, recovery, and approval points. Cite the source near relevant steps. Never use a language model's paraphrase as evidence that a derivative is permitted.
4. Validate the machine record against `public/playbooks/schema.json`; then run the executable in a disposable environment and check its output. Keep the human guide, JSON record, and script versioned together.
5. Promote status only from evidence: `draft` → `tested` after a maintainer run; `verified` after a clean independent rerun. Record app version, outputs, and date. Mark a guide `stale` when its supported app version or a required API changes.

The current candidate publishes `public/playbooks/index.json`, a formal JSON Schema, four Markdown guides, machine records, standalone scripts, preview renders, and sample Blender projects. `scripts/validate-playbooks.mjs` checks schema conformance, status evidence, and that all indexed assets exist. This is an editorial validator; source retrieval remains human-reviewed and execution remains local to an agent's app environment.

## Product and cashflow path

1. **Free discovery:** publish a small set of high-quality playbooks. Each links to the machine-readable guide and relevant official documentation.
2. **Agent adoption:** let agents fetch playbooks through a small catalog/manifest and optional MCP resources. Keep required capabilities light; let each guide state the tools it needs.
3. **Verified execution:** with user authorization, an agent runs the guide, checks the artifact, and records a compact receipt: guide version, app version, checks, output hashes, and failures. Do not upload customer files by default.
4. **Near-term revenue:** the playbook library routes custom workflow inquiries to the existing contact form. Qualify the need, then offer the current $750 audit or agree a separate written playbook scope. Do not promise that a guide alone creates savings.
5. **Recurring revenue hypothesis:** offer teams version monitoring, execution analytics, approvals, and replayable evidence through AgentCache. Validate willingness to pay before creating a new subscription tier.

## Milestones

| Milestone | Goal | Evidence to exit |
| --- | --- | --- |
| I0 — Content contract **(complete)** | Agree the schema, source gate, and verification labels | Four example records validate against the schema; license/provenance fields are mandatory |
| I1 — Blender pilot **(content complete; fourth-guide deployment pending)** | Publish four original Blender creation playbooks | Each passes two real app runs; saved projects reopen and outputs and validation checks are inspectable; Preview serves the fourth entry |
| I2 — Agent adoption | Put the catalog in agent discovery and expose playbooks in a stable text/JSON format | Ten external agent runs; completion and failure reasons recorded with consent |
| I3 — First revenue | Sell one custom workflow/playbook or convert a qualified team to the paid audit/pilot | Invoice/payment confirmed, scope accepted, deliverable reviewed by buyer |
| I4 — Repeatability | Expand to another app only after Blender playbooks show use | Repeat users, attributable lead source, paid conversion, and delivery effort documented |

## Business test

The content library is an acquisition and activation hypothesis, not yet a proven replacement for paid services. Track guide views, agent fetches, successful artifacts, failure rates, API activation, qualified conversations, paid conversions, and support time. After the first ten qualified teams or agent runs, decide whether to expand the content library, sell custom workflow packs, or prioritize AgentCache execution services.

## Immediate next actions

1. Keep the current $750 Agent Run Risk & Savings Audit as the near-term paid offer once production is approved and configured.
2. Put the playbook library in front of external agents and record ten consented fetch/run outcomes.
3. Build a rights-reviewed source-to-playbook intake workflow; do not automate crawling until terms, attribution, and adaptation rights are represented and enforced.
4. Convert one qualified request into a paid, custom workflow/playbook and measure delivery effort before pricing a repeatable offer.

## Current implementation checkpoint

- Playbook discovery is wired into the agent onboarding document and `/.well-known/agents.json`; `/playbooks` exposes the human library, stable JSON index/schema/records, standalone Blender scripts, sample projects, and visual previews. Its custom-workflow CTA leads to the existing contact form, and a separate $750 audit card routes production-agent teams to the fixed-scope offer. Conversion and payment remain unmeasured.
- The schema requires explicit app status, permissions, outputs, step-level verification/recovery, source license URL, exclusions, attribution, share-alike terms, rights-review status, and evidence fields before a record may claim `verified`.
- I0 is **complete**: four example records validate against the schema, and the validator checks unique IDs, all linked assets, and agreement between the index and each machine record. The library UI renders its cards from that index.
- The four-guide Blender content pilot is **verified locally for Blender 5.2.0 LTS**; the fourth guide still needs Preview deployment and render-page verification before I1 closes. The original three pilot scripts completed two fresh runs each and their projects reopened with scene assertions; the exploded desk lamp script also completed two fresh runs and a clean-process project reopen. All four renders were visually inspected. Evidence is in [BLENDER_PILOT_VALIDATION.md](../playbooks/BLENDER_PILOT_VALIDATION.md) and [the exploded desk lamp spike](agent_tutorial_catalog/spikes/blender.exploded-desk-lamp-2026-11-08.md). The status `verified` applies only to this tested version; other Blender releases remain unverified.
- Blender headless startup crashes during Metal detection in the restricted process environment before Python begins. Running the same executable through the approved out-of-sandbox route succeeded; the validation report records this environment constraint.
- No automated source scraper, remote execution service, usage analytics, external agent run, or execution receipt exists yet. I2 requires ten consented external agent runs; I3 requires a paid custom workflow/playbook or audit conversion with verified payment. The playbook revenue hypothesis remains unproven.
