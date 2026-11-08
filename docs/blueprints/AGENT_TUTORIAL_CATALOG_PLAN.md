# Agent Tutorial Catalog Plan

**Status:** Proposed catalog and delivery roadmap
**Product:** AgentCache Creation Playbooks
**Planning date:** 2026-11-08
**North-star:** An agent can find a task it is capable of, create the requested artifact in a supported app, verify the result, and report what it did and what remains uncertain.

## The product decision

Build a catalog of bounded creation jobs, not a copied tutorial archive. Each entry should tell an agent what to make, which control surface and app version it needs, what it may change, how to check the output, and how to recover from a failed step.

The catalog has two editorial levels, but only one is a published machine record today:

1. **Task family:** a planning entry with a stable ID, desired artifact, likely inputs, permission boundary, and acceptance checks. It lives in the catalog work queue; it is not a separate public schema object yet.
2. **App playbook:** the actual executable steps for one application, using the current schema. Each record includes app version, control method, commands or script, recovery steps, source record, and verification evidence.

Treat a task family as portable only after at least two app-specific playbooks have been independently tested against the same acceptance checks. Until then, it is an editorial grouping, not a promise that the apps or their outputs are interchangeable. Add a public task-family relationship only if external use shows that agents need it.

## Who this is for

- **Agent operators:** need a playbook that can be followed without guessing hidden steps or permissions.
- **Agent builders:** need stable, app-specific playbook records that an agent can discover from a catalog or manifest.
- **Teams:** need repeatable outputs and evidence that a procedure ran as described.
- **Creators and small studios:** need common design, animation, CAD, game, and office artifacts without writing every workflow from scratch.

On 2026-11-08, the public creation page returned successfully and displayed three Blender playbooks; its machine index also returned three Blender records. Their validation report supports Blender 5.2.0 LTS only. This confirms the live seed, not cross-app adoption or revenue.

## Catalog navigation

Let visitors browse by the result they need first, then narrow by app and control capability.

- **Outcome:** illustration, graphic, 3D model, animation, game prototype, CAD part, document, spreadsheet, or presentation.
- **Application:** Blender, Inkscape, Synfig, Godot, FreeCAD, LibreOffice, or Krita.
- **Control path:** application API or script, command line, structured project file, pre-installed plugin, or UI automation.
- **Readiness:** draft, tested, verified, or stale, with the tested application version visible.
- **Inputs and permissions:** user assets, local files, network access, add-ons, paid assets, and overwrite requirements.
- **Effort:** estimated run time and skill level, added only after actual runs establish useful estimates.

Never label a guide as compatible with an agent just because it is readable Markdown. Its required capabilities must match the consuming agent's tools.

## Full candidate catalog

This is a 43-task planning inventory, not a release schedule or a promise to publish 43 guides. Three Blender playbooks are live and verified on Blender 5.2.0 LTS. The next active work is one Inkscape feasibility task and one separate Synfig feasibility spike. The remaining tasks are backlog; their wave labels show a possible order, not committed dates. Every new item stays unpublished until its app-control path and output checks are proven.

### 3D design and product media — Blender

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| blender.product-turntable | Create a rendered product turntable | Editable Blender project, animation, and still render; reopen the project and inspect framing and keyframes | Live |
| blender.typographic-title-card | Create a 3D typographic title card | Editable scene and render; confirm text, camera, lights, and safe margins | Live |
| blender.product-colorway-board | Create a three-color product comparison board | Three editable variants and one render; confirm labels, framing, and color distinction | Live |
| blender.exploded-product-view | Create an exploded product view | Named components, exploded layout, camera, and render; verify each component remains separate | Wave 1 |
| blender.product-lighting-study | Compare three product-lighting setups | Three labeled lighting variants; verify camera and object stay constant across views | Wave 1 |
| blender.glb-export-package | Prepare and export a web-ready GLB asset | Native project, GLB, and preview; re-import the GLB and check mesh, material, scale, and texture presence | Wave 1 |
| blender.product-spec-sheet | Create a product specification image from a model | Front, side, and perspective views with supplied dimensions; verify labels against the input values | Wave 2 |

### Vector graphics and diagrams — Inkscape

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| inkscape.icon-family | Create a small consistent icon family | Editable SVG plus PNG exports; verify icon count, unique IDs, viewBox, and export dimensions | Wave 1 |
| inkscape.data-infographic | Turn a supplied small table into an infographic | Editable SVG and PDF; check every displayed number against the input table | Wave 1 |
| inkscape.social-campaign-set | Create three matching social graphics | Editable source and three sized exports; verify text, dimensions, and no clipped elements | Wave 1 |
| inkscape.product-label | Create an editable product label layout | SVG and print-sized PDF; verify dimensions and required copy against the supplied brief | Wave 2 |
| inkscape.process-diagram | Turn a supplied outline into a process diagram | Labeled SVG and PNG; check every step, connector, and reading order against the outline | Wave 2 |
| inkscape.svg-batch-export | Export named SVG elements as individual assets | Source SVG and per-element files; verify expected IDs, filenames, and non-empty outputs | Wave 2 |

### 2D animation — Synfig

The cut-out animation reference suggests a useful progression: prepare parts, import and register them, group related layers, define pivots and parent-child motion, animate, then render and troubleshoot. The new tutorial must be written independently with original assets. Do not reuse its sample character, screenshots, or wording.

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| synfig.cutout-puppet | Build a cut-out puppet from original body-part artwork | Editable Synfig project and pose renders; check part alignment, layer order, group hierarchy, and pivots | Feasibility spike |
| synfig.character-gesture | Animate one clear arm or head gesture | Editable project and frame sequence; verify the motion starts and ends in the requested pose | Wave 2 |
| synfig.blink-and-talk-loop | Create a short blink and mouth-shape loop | Native project and rendered frames; check loop boundary and frame count | Wave 2 |
| synfig.walk-cycle | Create a short looping walk cycle | Native project and render; verify cycle length, foot contact poses, and repeat boundary | Wave 3 |
| synfig.parallax-scene | Create a layered parallax scene | Native project and rendered sequence; verify layer depth ordering and camera movement | Wave 3 |
| synfig.transparent-sprite-sequence | Render a transparent frame sequence | Project and numbered images; check dimensions, alpha channel, and uninterrupted numbering | Wave 3 |

The first Synfig task is a feasibility spike, not a commitment to a launch date. The public wiki's older tutorial uses GUI instructions and a character example; the command-line reference establishes rendering options, but the project-editing route still needs a tested app adapter.

### Interactive projects — Godot

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| godot.interactive-title-card | Create a small interactive title scene | Project and runnable scene; verify input changes the visible state and the app exits cleanly | Wave 2 |
| godot.platformer-prototype | Build a one-screen platformer prototype | Project, player, collision, and goal; run a headless scene check and confirm the player can reach the goal | Wave 2 |
| godot.settings-menu | Create a keyboard-operable settings menu | Scene and project; verify focus order, keyboard input, saved settings, and return navigation | Wave 3 |
| godot.dialogue-branch | Create a short branching dialogue scene | Project and dialogue data; verify each choice reaches the expected branch | Wave 3 |
| godot.sprite-animation | Create an animated character scene | Project and animation state machine; verify all named states and transitions | Wave 3 |
| godot.web-export | Export a small project for browser play | Project and web export; verify files exist and the export starts in a local test host | Wave 4 |

Use the official command-line and headless routes where possible. A guide must record export-template and renderer requirements instead of assuming all machines have them.

### Parametric parts — FreeCAD

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| freecad.mounting-bracket | Create a parameterized mounting bracket | Editable native model and preview; verify named dimensions and valid solid | Wave 3 |
| freecad.electronics-enclosure | Create an enclosure with selected openings | Native model and drawing view; verify wall thickness and opening positions against inputs | Wave 4 |
| freecad.dimensioned-drawing | Create a dimensioned drawing sheet from a part | Native project and PDF; verify required views and dimensions against the model | Wave 4 |
| freecad.parameter-variant | Produce two size variants from a parameter table | One editable project with two variants; verify each parameter and bounding box | Wave 4 |
| freecad.simple-assembly | Assemble two or three original parts | Native assembly and exploded view; check constraints and component count | Wave 4 |
| freecad.stl-export-check | Export a selected part for 3D printing | Native source and STL; verify units, bounding box, watertightness, and selected-body identity | Wave 4 |

CAD guides must separate visual plausibility from engineering suitability. They must not claim load, fit, safety, or manufacturing performance without the relevant analysis and qualified review.

### Documents, spreadsheets, and presentations — LibreOffice

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| libreoffice.project-budget | Build a project budget workbook from synthetic or user-approved inputs | Editable spreadsheet and PDF; verify formulas, totals, data validation, and chart source ranges | Wave 2 |
| libreoffice.operations-report | Turn a supplied CSV into a concise report | Editable document and PDF; verify every reported figure against the source data | Wave 3 |
| libreoffice.chart-deck | Create a short presentation with two charts | Editable presentation and PDF; verify chart labels, source figures, and slide count | Wave 3 |
| libreoffice.quote-template | Create a reusable quote template | Editable document and PDF; check arithmetic fields and label it as a template, not legal advice | Wave 4 |
| libreoffice.pdf-layout-check | Convert an existing document to PDF and review layout | Original-format copy and PDF; check page count, missing fonts, overflow, and text searchability | Wave 4 |
| libreoffice.data-cleanup | Clean a synthetic spreadsheet using stated rules | Before/after workbook and change summary; verify row counts, duplicates, and preserved source copy | Wave 4 |

For workflows that read business data, require a user-selected local file, preserve the original, and report transformations. Start with synthetic data so early examples do not invite uploads of confidential records.

### Digital painting and layered artwork — Krita

| ID | Tutorial job | Required result and acceptance check | Priority |
| --- | --- | --- | --- |
| krita.storyboard-sheet | Create a storyboard sheet from original or user-supplied assets | Layered source and PNG/PDF; verify panel count and reading order | Feasibility spike |
| krita.layered-poster | Build a layered poster from a supplied brief | Native project and flattened export; verify dimensions, layer names, and text safety | Wave 3 |
| krita.palette-board | Create a named palette and color study | Native document and palette file; verify swatch names and color values | Wave 3 |
| krita.layer-export | Export selected layers to separate files | Native project and image files; verify names, dimensions, and alpha | Wave 4 |
| krita.animation-loop | Create a short animation loop | Native project and rendered frames; verify frame range and loop boundary | Wave 4 |
| krita.asset-resize-batch | Resize and export a user-selected image set | New output copies; verify dimensions, file count, and original files unchanged | Wave 4 |

Krita's Python extension route requires a reviewed, user-enabled plugin. Never silently install or enable a plugin that can access the user's files. Keep early tasks on file formats or explicitly approved plugins until the adapter is proven.

## Control-surface policy

Select a route by whether it can create or inspect the native project, support deterministic checks, and recover from visible failures:

1. **Script or application API:** preferred when it can create and inspect the native project.
2. **Command line:** preferred for conversion, export, rendering, and deterministic checks.
3. **Structured project format:** useful when the format is documented and can be safely reopened by the application.
4. **Pre-installed extension:** allowed only when its source, permissions, and version are documented; installation still needs user approval.
5. **UI automation:** use when higher-level routes cannot perform the task; it must use visible state and recovery checks. Screen coordinates alone are not enough for a verified status.

A guide may combine routes. For example, create a vector file directly, open it in the target app, and use the app's command line to export and validate it. State exactly which part was checked by the application. For catalog milestones, a distinct control path means one unique app plus its primary project-creation route. A mixed route counts once, under the route that creates or edits the native project; its export or verifier does not count as another path. Count each feasibility result independently: a failed Synfig spike must not delay Blender or a passing Inkscape task from entering external runs.

## Alternatives weighed

- **Publish all seven app tracks at once:** rejected for the first release. It multiplies version checks, app-specific failure handling, and source reviews before any outside agent has used the catalog. The cost is slower catalog breadth; the benefit is evidence before maintenance commitments.
- **Stay with Blender only:** keep this as the fallback if no other app passes a feasibility spike or if external runs show that Blender tasks cover the need. It minimizes adapter work but would not test whether the catalog helps agents across distinct creative workflows.
- **Bulk scrape and paraphrase tutorials:** rejected because a public page does not grant reuse rights, and a paraphrase does not supply app-version checks, permissions, recovery, or artifact verification. The cost is slower authoring; the benefit is original, provenance-backed procedures.
- **Use screen-coordinate automation as the default:** rejected because UI layouts, focus, display scale, and dialogs can vary by app version and machine. The cost is that some workflows will wait for an API or visible-state adapter; the benefit is fewer false success reports and easier recovery.
- **Publish a universal task schema now:** deferred. The current playbook schema is app-bound. A second verified adapter and evidence of cross-app search needs should decide whether a new relationship is worth the added schema and migration burden.

## Publication and verification rules

Keep the current record fields as the minimum contract: status and app version, capabilities, permissions, outputs, execution route, ordered steps, source/license record, verification, last-verified date, and limitations. The catalog page may reveal the technical fields progressively, but the machine record continues to require them.

A playbook is publishable only when it has:

- a concrete output and a short list of objective acceptance checks;
- a clean, user-selected output path and explicit overwrite behavior;
- app/version requirements and a tested control route;
- action, verification, recovery, and approval checkpoints for each meaningful step;
- original or clearly licensed example assets;
- a human-readable guide, machine-readable record, and working links;
- run evidence that matches its label.

Use the existing status meanings: draft has not been run; tested passed one maintainer run; verified passed a second run in a separate process and fresh output directory with the required artifact checks; stale no longer has valid evidence for its stated app version or dependencies. The second run may be performed by the same maintainer. A different human reviewer is required before publishing guides that install code, overwrite files, upload work, or change external state. A rendered preview is not proof that a native project reopens.

Every new app begins with one feasibility spike. Do not publish a whole app track until the spike proves the app can open, save, export, and verify an original artifact through the stated control route.

## Maintenance budget and retirement

Use a planning cap of 16 maintainer hours per quarter for the first ten verified playbooks, excluding a major app release that changes a used API. This is a capacity hypothesis, not measured effort. Record authoring, rerun, triage, and repair time separately during the first quarter. At each quarter end, the catalog maintainer reviews the total before selecting more guides. If the measured work exceeds the cap, pause new guides and prioritize by actual agent runs; mark unused or broken guides stale, then retire them from the public index if they cannot be restored within the cap. Recheck a guide after a major app or dependency update and at least once every 12 months. Do not claim compatibility with an untested version.

## Source and rights policy

The catalog should learn from official manuals and public tutorials without becoming a mirror of them. For each source, record its author, page URL, retrieval date, page-level license, exclusions, attribution, share-alike terms, and review result. If reuse rights are unclear, use the source only as a reference, write original steps, and create original assets. Do not copy tutorial prose, screenshots, sample project files, example characters, or code unless the specific license and its obligations are confirmed.

For the Synfig cut-out example, translate the underlying production sequence into checks: same-size parts or explicit registration marks, layer order, parent-child joints, pivots at joints, repeated poses, loop boundaries, and rendered output. Build a new character from original shapes. The existing EGM reference list and source policy are in the linked creation-site blueprint and source notes.

## Catalog economics

The free catalog is the distribution layer, not a proven business by itself. Keep basic playbooks useful and indexable so agents can discover them. Test paid work in this order:

1. **Custom workflow design:** scope an original, verified playbook around a team's application and output.
2. **Implementation or integration:** connect a playbook to the team's own agent tools and add a run record, where the buyer approves the scope.
3. **Agent Run Risk & Savings Audit:** use the existing fixed-scope offer when a team needs an operational review before deployment.
4. **Maintained catalog or execution plan:** consider recurring pricing only after buyers demonstrate repeated use and value.
5. **Machine-to-machine payment:** consider x402 only when settlement, replay protection, refunds, and accounting are verified. Do not charge agents for guides until a free catalog has evidence of repeat demand.

Do not set catalog prices by analogy alone. Use buyer interviews and paid pilots to measure urgency, delivery hours, support load, repeat use, and conversion. The current cashflow plan is linked below.

## Success measures

The catalog maintainer owns the first external-run log. Before each run, show this notice and obtain opt-in: “I will record the playbook ID and version, app version, checklist result, failure stage, recovery result, human intervention, and approximate duration to improve these instructions. I will not record your identity, prompts, source files, or artifact contents. You can decline without affecting access to the guide.” Record those fields manually; do not instrument retrieval, execution, model calls, or tool calls in the first release. Defer those funnel measures until a separate notice and consent rule is defined. Ask separately before retaining an output or screenshot. A run counts as accepted only when the playbook's objective checks pass; subjective visual preference is recorded separately.

Use the opt-in manual log for run outcomes. Track paid-work outcomes from the maintainer's sales records; do not infer retrieval-to-execution conversion in the first release:

- successful artifacts divided by opted-in runs;
- top failure stage and recovery success;
- approximate duration and human intervention, from the manual log;
- defer fetch counts, instrumented executions, and model/tool-call counts until a separate notice and consent rule is approved;
- record repeat executions or saved-project reuse only when participants volunteer that information;
- qualified custom-work requests, proposals, paid work, delivery hours, and repeat purchase from business records.

Do not use page views as the main success metric. Do not upload generated customer work by default. If a receipt is added later, prefer task ID/version, app version, check results, output hashes, and failure categories over file contents.

## Milestones

| Milestone | Goal | Exit evidence |
| --- | --- | --- |
| C0 — Live seed | Maintain the three verified Blender guides and stable agent discovery | Live page, index, schema, sample and script routes work; each status matches the validation report |
| C1 — Independent app feasibility | Test one Inkscape route and the Synfig cut-out route independently | Each app has its own pass/fail result. A passing app opens, saves, and exports an original artifact through its recorded route, with a complete rights record and one maintainer run; a failure does not block other apps or Blender external runs |
| C2 — External agent use | Test the live Blender seed when the opt-in log is ready; add each app independently after its own C1 pass | Ten opted-in runs logged by the catalog maintainer; at least five pass the objective checks; failures and human intervention recorded; no identity or artifact content retained by default |
| C3 — First 10-task catalog | Expand to ten published guides only for tasks indicated by C2; records may be tested or verified and only those statuses are public; draft records stay in the work queue | Ten public records pass schema and link validation; the set uses at least three distinct app-and-primary-route pairs; each record labeled verified has two clean runs. The 16-hour cap applies when maintaining the first ten verified playbooks, not merely ten published records |
| C4 — Paid demand | Sell one custom playbook pack or convert a qualified workflow to the audit | Written scope, verified payment, reviewed deliverable, and actual delivery time recorded |
| C5 — Repeatable catalog | Expand only where use and value justify maintenance | Repeat buyers or repeat agents, run failure rate reported against the prior quarter (without claiming a decrease before a baseline exists), measured support hours, and a reasoned app expansion choice |

## Detailed Implementation Plan

### Repository boundary and publication contract

- **Planning inventory:** create `docs/blueprints/agent_tutorial_catalog/WORK_QUEUE.md`. This Markdown file is planning-only and is never linked from `public/playbooks/index.json`. Each row has `task_id`, `app`, `outcome`, `inputs`, `primary_route`, `verifier`, `source_status` (`unknown`, `review_needed`, `reference_only`, `approved_for_adaptation`, `blocked`), `priority` (`live`, `active_spike`, `backlog`), and `state` (`queued`, `testing`, `passed`, `failed`, `deferred`). IDs use the eventual public playbook ID when one is chosen; no task-family object is added to the public JSON schema.
- **Rights research:** create `docs/blueprints/agent_tutorial_catalog/SOURCE_RIGHTS_REGISTER.md` as a research register, not a new runtime format. One row per source records author/publisher, exact URL, retrieval date, page-level license and license URL (or `unknown`), exclusions, attribution, share-alike terms, intended use, reviewer role/date, and outcome. `unknown` or `unresolved` permits reference-only learning and original assets/prose; it does not permit copying. Published playbooks repeat the required evidence in their existing `sources[]` record in `public/playbooks/*.json`.
- **Spike evidence:** create `docs/blueprints/agent_tutorial_catalog/spikes/<task-id>.md` for each feasibility result. Include app/version, route, exact inputs, commands or interaction sequence, output tree, objective assertions, failures/recovery, reviewer, and pass/fail/deferred decision. Keep unfinished or failed spikes out of the public index.
- **External-run template:** create `docs/blueprints/agent_tutorial_catalog/RUN_LOG_TEMPLATE.md`. Store participant-level run rows only in a maintainer-controlled location outside the repository; never commit run logs, prompts, user files, or generated artifacts. The template contains only the opted-in fields named under Success measures.
- **Published playbooks:** preserve `public/playbooks/schema.json` as the contract. A public record must retain a human guide, machine record, script, preview, and sample project as required by the current schema/index/validator. A UI-only spike may pass as a research finding but is not eligible for external agent runs or publication until it has a supported script/launcher and meets every current record requirement. Draft records remain in the work queue and are not indexed. Tested or verified records may be indexed only after all required artifacts and checks pass.
- **Discovery and validation:** the public discovery surface is `public/playbooks/index.json` and `public/playbooks.html`; `/api/catalog` is a separate commercial-services API. Phase 3 may modify the index, `public/playbooks.html` (replace the hard-coded `.BLEND` label with a generic “SAMPLE PROJECT” label), per-playbook records/guides/scripts/assets, `scripts/validate-playbooks.mjs`, and a new focused unit test at `tests/unit/playbook-validator.test.js`. It does not add app filters or a task-family API in the first release.
- **Cross-app validator decision:** before indexing the first non-Blender guide, update the validator to require `entry.app === record.app` and derive the expected indexed version from `record.app` and `record.app_version.tested`, while retaining ID uniqueness, local-path containment, schema, linked-file, index/record agreement, and verified-evidence checks. Keep the current minimum of three records. Do not relax required sample/script assets or change the public schema for feasibility drafts. Require a non-null tested app version before a record can be public with `tested` or `verified` status. Add validator tests for one Blender and one non-Blender record, app-name/version mismatch, null public tested version, missing linked files, and path traversal; all three current Blender records must continue to pass.

### Phase-by-phase file dispositions

| Phase | Create | Modify | No change / publication boundary |
| --- | --- | --- | --- |
| 0 — Queue | `docs/blueprints/agent_tutorial_catalog/WORK_QUEUE.md`; `SOURCE_RIGHTS_REGISTER.md`; `RUN_LOG_TEMPLATE.md` | This blueprint only | No public index/schema/page/validator changes; no external-run data committed |
| 1 — Spikes | `docs/blueprints/agent_tutorial_catalog/spikes/inkscape.icon-family.md`; `synfig.cutout-puppet.md`; original spike input/output files under ignored local working directories | Work queue and source register as results arrive | No public playbook records or index entries; failed/deferred route remains private |
| 2 — External use | None in repository; limited participant run rows stay in maintainer-controlled storage outside the repository | Run log template only if wording needs correction before opt-in | No analytics instrumentation or public index change; Blender and each independently passing spike may be run with explicit opt-in |
| 3 — First ten | Per published ID: `public/playbooks/<id>.json`, `.md`, script, `public/playbooks/samples/<name>`, and `public/playbooks/previews/<name>`; focused validator fixtures | `public/playbooks/index.json`, `public/playbooks.html`, `scripts/validate-playbooks.mjs` | Create `tests/unit/playbook-validator.test.js`; keep schema unchanged unless a concrete required artifact cannot fit it; no API catalog or UI filters |
| 4 — Portfolio choice | Decision note in `docs/blueprints/agent_tutorial_catalog/` | Work queue and catalog plan | No new app track until capacity and demand gates pass |

The Inkscape input brief is fixed: create three original monochrome icons for a fictional “Northstar Tools” kit (compass, wrench, storage box), each inside a 24×24 viewBox with a 2-unit stroke, square caps, and no embedded fonts or external references. Deliver an editable SVG plus 128 px and 512 px PNG exports. The Synfig input brief is fixed: create a fictional two-arm helper character from original vector parts (torso, head, two upper arms, two forearms) on a 512×512 canvas. Deliver an editable project and two 12-frame pose clips at 24 fps, with neutral and raised-arm poses at each clip endpoint. The project-authoring route is the experiment: time-box a script/structured-file route first, then a visible UI route with checkpoints if needed; record the chosen route and exact steps. A UI-only spike is research-only and cannot enter the external-run pool or public index unless it also gains a supported, tested script/launcher that fulfills the current schema. For Inkscape, the spike must record the tested Inkscape version and exact CLI/export sequence; objective checks are three top-level icon groups with unique IDs, non-empty `viewBox`, both PNG sizes, and successful reopen in Inkscape. For Synfig, set the torso center at (256, 300), left shoulder pivot at (185, 220), and right shoulder pivot at (327, 220) on the 512×512 canvas. In clip `neutral-hold`, both hand endpoints remain within 4 px of (130, 300) and (382, 300) at frames 1 and 12. In clip `left-arm-raise`, the left hand endpoint is within 4 px of (130, 300) at frame 1 and (150, 100) at frame 12; the right hand stays within 4 px of (382, 300) at both endpoints. Render each clip as 12 numbered frames at 512×512 and 24 fps; inspect midpoint frames for continuous limb attachment. Pass only if the new project saves and reopens in Synfig, the endpoint coordinates meet these tolerances, and all 24 frames are non-empty. Stop both route attempts after eight maintainer hours. If only the UI route works, mark it research-only/deferred for publishing and test another scriptable app next. If no route reliably saves and reopens the project, mark it deferred and choose another app. Do not publish or claim a Synfig adapter from a render-only command.

### Validation at each phase

- **Phase 0:** review the three planning files for all required columns/fields and confirm none is referenced by the public index. No application tests.
- **Phase 1:** run each spike's documented commands in a clean output directory; retain a manual assertion checklist and screenshots only as local maintainer evidence. Record pass/fail independently. No public validator run is required because no public files change.
- **Phase 2:** verify each participant opted in before recording, count ten eligible rows and at least five accepted outputs, and review the limited fields for prohibited content before using the result. No event instrumentation.
- **Phase 3:** run `npx vitest --run tests/unit/playbook-validator.test.js` and `node scripts/validate-playbooks.mjs`, then inspect the public index and each linked artifact. Preserve a test fixture showing all three existing Blender records pass. Publish only after both the automated checks and rights/visual review pass.
- **Phase 4:** record a dated decision against run evidence, buyer signals, and measured quarterly maintenance hours; if any gate fails, update the work queue to defer expansion.


### Phase 0 — Protect the seed and set up the catalog work queue

1. Keep the three current Blender records and their validation evidence unchanged while adding new candidates.
2. Add a planning-only task inventory before writing new public guides. Give each candidate a stable ID, app, target output, control path, verifier, source status, and priority.
3. Create a rights-reviewed source record for the Synfig cut-out reference. Do not carry its sample character or screenshots into AgentCache content.
4. Pick one Inkscape command-line task and the Synfig cut-out feasibility spike as the next two experiments. Maintain a separate pass/fail state for each.

**Exit gate:** each experiment has a measurable artifact contract, a complete source record where needed, and a documented control and check route. A failure in either experiment does not block the other or the live Blender seed.

### Phase 1 — Run two independent app feasibility spikes

1. Build the Inkscape icon-family task from an original brief. Create SVG, export PNG, inspect IDs and geometry, and reopen the SVG in Inkscape.
2. Build a new Synfig puppet from original artwork. Test whether a project can be assembled, reopened, rendered, and checked without relying on fragile coordinates. If the editor route is UI-only, document its exact limits and keep it research-only; it cannot enter the public index or external-run pool until a supported script/launcher satisfies the current schema.
3. Record app versions, exact commands, run time, dependencies, outputs, failure recovery, and any manual steps.

**Exit gate:** record each app result separately. A spike passes when one maintainer run creates, saves, reopens, exports, and checks its original artifact in a clean output directory. A second clean-process run is required for verified status, not for allowing the other passing app or live Blender guides into external runs. If Synfig fails the machine-playbook contract, keep the source-derived guide as a human research note and prioritize an app with a tested script or command-line creation route instead.

### Phase 2 — Test agent use before expanding

1. Use the three live Blender guides plus each successful feasibility task. Do not wait for a ten-guide catalog to invite external runs.
2. The catalog maintainer obtains opt-in for the limited fields defined above, provides the objective checklist, and logs the run manually.
3. Keep each app result separate. Inkscape can pass even if Synfig fails; a Synfig failure does not count as evidence against Inkscape.
4. Fix the most common instruction or recovery failures before adding more topics.

**Exit gate:** ten opted-in runs, at least five objectively accepted outputs, a recorded failure and intervention summary, and no collection of artifact contents by default.

### Phase 3 — Expand to ten tasks from observed use

1. Select task families from the external-run log, buyer questions, and app-adapter reliability; do not follow wave labels mechanically.
2. Add the next guides only for workflows with a clear result, objective checks, and a refresh path that fits within the quarterly maintenance cap.
3. Complete a second run in a clean process and output directory before assigning verified status.
4. Offer custom workflow design or the existing audit only to qualified teams that ask for help. Do not send unsolicited customer messages from this plan.

**Exit gate:** ten public guides across at least three distinct app-and-primary-route pairs, with valid links and checks; tested/verified status is visible per guide; draft records remain unlisted in the work queue; demand and maintenance estimates are recorded. Verified status still requires two clean runs.

### Phase 4 — Expand from evidence

At each quarter end, review measured maintenance hours before selecting the next track. Choose from observed demand and adapter reliability. Godot, FreeCAD, LibreOffice, and Krita remain uncommitted candidates; do not start all four in parallel. Add one new app only after its own feasibility spike passes, an existing track is getting repeat runs, and the maintenance cap can support it.

**Exit gate:** repeat usage and a buyer-backed reason to maintain the next app track. Otherwise improve the current catalog, its findability, or its run reliability.

## Linked project context

- [Creation-site blueprint](AGENT_CREATION_INSTRUCTION_SITE.md)
- [Cashflow blueprint](CASHFLOW_BLUEPRINT.md)
- [Current playbook index](../../public/playbooks/index.json)
- [Playbook schema](../../public/playbooks/schema.json)
- [Blender validation report](../playbooks/BLENDER_PILOT_VALIDATION.md)
- [Official documentation source notes](AGENT_TUTORIAL_CATALOG_SOURCES.md)
