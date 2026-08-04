# Aletheia — Enhanced Automator for Grounded Cache

**Version:** 0.1 (North Star + Execution Direction)  
**Date:** May 28, 2026  
**Status:** Primary product thesis for unifying 5173 (RSVPuix Studio) + 3000 (wired api/) + grounded prototype  
**Owner:** Grok (Lead) + user autonomy  
**Reference Models:** Apple Automator (the MD research file the user supplied), Shortcuts Folder Actions, n8n/ComfyUI canvas, RSVPuix premium patterns, locked GroundedReceipt model from ~/grounded/.

---

## The Core Intent (Synthesized)

We are building **a cache that behaves like an intelligent file system**.

The **directory/folder** is the first-class primitive.

Automation inside it follows the Apple Automator / Shortcuts mental model:

- Folder Actions / triggers ("when files are added, modified, or removed from this folder...")
- Visual (or near-visual) composition of actions into workflows
- Broad, approachable action library that operates directly on real files, content, system events
- Multiple surfaces (drop, schedule, hotkey, etc.)
- Escape hatches for power users (scripts, custom logic)

**But every step is supercharged by the full AgentCache intelligence layer + the new Grounded truth layer:**

- Actions are not brittle local scripts — they are agentic, cache-aware, MCP-connected, policy-guarded tool nodes with explicit ports (ComfyUI/n8n style).
- Every trigger, action, decision, and outcome emits a cryptographically signed **GroundedReceipt** (SpecTruth immutable contract vs RuntimeTruth execution trace + explicit Inventions + drift/invention metrics + validation).
- Long-term memory, souls/skills/heartbeats, cross-sector knowledge, and semantic caching run *under* the automations.
- The visual surface feels like a premium, tactile "smart folder on the desktop" first (desktop simile + sliding intent-aware panels) and a powerful automation graph second.
- Error compounding, memory poisoning, and hallucinated work are made visible and auditable by default.

This is **"Automator on steroids with a brain, a conscience, and receipts that compound value over time."**

The reliability tax of agentic systems (drift, inventions, ungrounded claims) becomes a first-class, measurable, governable feature instead of a hidden liability.

---

## Why Apple Automator Is the Perfect Reference (from the user's provided MD)

From the research document:

**What to preserve / elevate:**
- Folder Actions as the primary, zero-friction trigger model.
- Visual workflow authoring with a huge library of actions (Files/Finder, text, images, PDFs, internet, system, scripting).
- Chaining, variables, loops, conditionals.
- Multiple invocation surfaces (folder drop, calendar alarms, hotkeys, Quick Actions, print plugins, image capture, dictation).
- Approachability for repetitive real-world tasks on actual files and folders.
- Escape hatches (AppleScript, JS for Automation, shell, Python, Ruby).

**Where Automator is fatally limited (our entire product advantage):**
- No long-term memory or semantic understanding across runs.
- No concept of "what the workflow was declared to do" vs "what it actually did."
- No drift detection, invention boundaries, or cryptographic proof.
- No policy/guardrail layer that can reason about intent.
- No reuse/caching of expensive work.
- Actions are one-shot scripts; they cannot benefit from semantic cache, vector memory, or cross-provider grounding.
- No composition with external AI/MCP tools in a grounded, auditable way.

Our system takes the **surface and mental model** of Automator and puts the full power of AgentCache (caching, memory, policy, MCP, ontology graph, SectorEngine) + the GroundedReceipt primitive **inside** every folder and every action.

---

## The Unified Experience We Are Building (5173 + 3000)

### The Split You See Today
- **5173 (Vite + RSVPuix Studio)**: The sophisticated ReactFlow canvas, pipeline builder, dashboards, sector switching, MetricsPanel, WorkspaceDashboard, etc. Rich visual heritage, but not yet "folder as world model."
- **3000 (enhanced legacy Express api/)**: Now fully wired with GroundedReceipt emission on every mutation, real file upload + suggestFileActions (property/intent-aware), Shortcuts-style watchers/triggers, ComfyUI-style tools registry with ports, agentic dials in telemetry.
- Historical grounded prototype (~/grounded/): The clean conceptual spike (NodeDirectory primitive, receipt types, preview.html + App.tsx showing folder grid + sliding panels for Intent/Spec, Operations/Actions, Truth/Receipts, Connectivity, automations simulation).

### The Target Unified Surface (North Star)
**5173 becomes the rich RSVPuix authoring + observation layer for "Smart Folders".**

- Main view feels like a desktop folder (or n8n canvas inside a folder metaphor) — draggable nodes that represent files, plans, memories, decisions, agents.
- Root intent bar (click opens Spec/Intent panel — the governing contract).
- Contextual sliding panels (Framer Motion, glass, premium Keramos tactile palette):
  1. **Intent / Spec** — the immutable Grounded contract (phases, policies, expected tools, knowledge contexts). "Re-ground" action.
  2. **Operations / Actions** — Automator-style palette + folder triggers (file added/modified, schedule, webhook, drift threshold, invention flagged). Visual wiring of tools (ports like ComfyUI).
  3. **Truth / Receipts** — live timeline of signed GroundedReceipts. Spec vs Runtime diff, inventions highlighted, drift scores, validation status. Exportable audit trail.
  4. **Connectivity** — ontology edges, MCP tools, agent assignments, external systems.
  5. **Metrics / Dials** — agentic gauges (heartbeats, souls, skills, markup files, drift, invention rate, receipt velocity).
- Every meaningful event (upload, write, trigger, tool execution) calls the live 3000 (or future Hono) API → real GroundedReceipt emitted and surfaced instantly.
- Folder automations feel like Shortcuts/Automator Packs but are receipt-producing, cache-aware, and agent-governed.
- Agent Folders (future) run GOAP planning on top of the receipt memory.

The 3000 API (the work we just completed) is the execution + truth backend that makes this real today. The grounded prototype is the UX reference. RSVPuix components (DashboardGrid, FocusedContent, CardRenderer, LiveTile, motion patterns) + the existing ReactFlow canvas in the Studio give us the implementation foundation.

---

## Technical North Star (Architecture)

- **Primitive**: Node Directory (directory *is* the cache). Typed nodes (file, directory, trigger, transform, action, condition, memoryFragment, planStep, agentDecision, ontologyEntity) carry receipts.
- **Truth Layer**: Every mutation emits a canonical, ed25519-signed GroundedReceipt (SpecTruth immutable + RuntimeTruth + Inventions + Validation + Summary). Deterministic JSON before signing.
- **Automation Model**: Watchers on node events (file:added, node:write, high-drift, etc.) → intent-aware tool execution (ports + dataMapping + conditions via node_connections) → receipt emission → watcher notification. Packs are reusable automation graphs.
- **Visual Model**: RSVPuix + ReactFlow (or dnd-kit) canvas. Folder simile + n8n-style wiring. Premium Keramos-inspired design (warm stone/porcelain/wood + yellow sunshine accents, tactile, responsive).
- **Intelligence Layer**: AgentCache semantic cache, cognitive memory with decay, policy engine, MCP tools, ontology graph (PostgresGraphAdapter + SectorEngine) run under every action.
- **Backend**: Currently the wired legacy api/ (3000) for speed. Long-term the Hono path (src/) + shared receipt engine. Persistence for receipts (new table or jsonb).
- **Frontend**: 5173 Vite app becomes the single surface. Small unification slice first (new "Aletheia" or "Smart Folders" view that fetches nodes/tools/receipts/triggers/dials from localhost:3000), then full port of the folder + panels experience using RSVPuix patterns.

---

## First Concrete Steps (Already Partially Executed in This Session)

1. **api/ review + wiring** (completed this session):
   - REVIEW.md produced.
   - GroundedReceipt lib + emission on create/update/upload/trigger.
   - Real file handling + suggest actions.
   - Watchers + triggers.
   - Tools registry with ports.
   - Agentic dials in telemetry.
   - All live on 3000.

2. **Unification at 5173** (in progress per "Lets do 1 and 2"):
   - Exploration of src/ (ReactFlow canvas in builder, view switching, MetricsPanel, WorkspaceDashboard, RSVPuix reference components).
   - Reference to grounded preview/App.tsx + Aletheia docs for target UX.
   - North-star document (this file).
   - Next: small slice — new view or component in App.jsx that can list smart folders, simulate upload (calls 3000), display live receipts + dials.

3. **Product Clarity** (this document + future updates):
   - Explicit Automator enhancement thesis.
   - Mapping of Automator strengths → our implementation.
   - Clear differentiation (receipts, intelligence layer, directory-as-cache).

---

## Success Metrics for v0.1 Unification

- User can open the Studio at 5173, create a "Smart Folder" node, drop/upload a file via the UI, see suggested actions (from the wired logic), trigger one, and watch a real GroundedReceipt appear in a Truth panel with drift/invention data and a live dial update — all backed by the 3000 API.
- The experience feels like a premium, tactile Automator for serious agent work, not another workflow canvas.
- Messaging is locked: problem-first (reliability tax, error compounding, invention boundary), solution as "the directory that thinks + receipts that prove it."

---

## Risks & Open Questions

- Dual backend (legacy api/ vs Hono) — keep enhancements isolated for now, plan mirror.
- Persistence of receipts/watchers for multi-user.
- Real ed25519 key management (per-account signing keys).
- Performance of receipt emission on high-volume folder events.
- How deeply to lean into "folder simile" vs pure canvas (user preference for desktop metaphor is strong).
- GTM: services.html teaser already exists from prior work; this unification makes the demo story much stronger.

---

## Next Immediate Actions (Post This Document)

- Complete small unification code slice in 5173 (new view + basic fetch to 3000).
- Update memory.md (already done for the api session).
- Decide on canonical runtime (grounded NodeDirectory as shared core?).
- Flesh out 2–3 concrete Automator-style Packs (e.g., "Legal Contracts Intake", "Research Drop", "Financial Reports") as first demos.
- Begin RSVPuix component mapping for the sliding panels + folder grid.
- When ready: Hono port of receipt + watcher logic + prod deploy.

---

**This is the work.**

The two separate things on 5173 and 3000 are not a problem — they are the two halves of the exact system the user described: a cache that is like a file system with automated-like actions, enhanced by digging into the bowels of Automator and adding the full intelligence + Grounded truth layer.

We now have the review, the wiring, the reference research, the exploration of the UI, and this north-star document.

**Ready to continue executing the unification slice and any follow-on the user directs.**

---

## Future Enhancements Roadmap (Detailed)

This section expands the "Next Immediate Actions" with a phased, high-fidelity roadmap. It is grounded in the Automator research document the user supplied, the locked GroundedReceipt model, the api/ wiring just completed, the RSVPuix component library, the existing 5173 Studio canvas, and the broader AgentCache platform strengths.

### Phase 1 — Unification & First Live Experience (Current Sprint, 1-2 weeks)
- Complete the small Smart Folder view in 5173 (new "Aletheia" tab or view in App.jsx) that:
  - Lists live smart folders/nodes from `GET /api/nodes`.
  - Supports upload simulation that calls `POST /api/nodes?action=upload` and displays the returned GroundedReceipt + suggestedActions.
  - Shows a live receipts timeline + the new agentic dials from telemetry.
  - Has a "Trigger Automation" button that exercises watchers + receipt emission.
- Polish the first 2-3 Automator-style Packs as demo data (Legal Contracts Intake, Research Drop, Earnings Briefing — using the exact patterns from the Automator MD: folder drop → classify/extract/summarize → notify/export).
- Update services.html teaser block with the new "Enhanced Automator" language and a link to a private demo.
- Internal dogfood: use the 5173 slice + 3000 backend for all grounded prototype work going forward.

### Phase 2 — Deeper Automator Fidelity (3-6 weeks)
- **Folder Actions surface**: Full visual editor for triggers (file:added, file:modified, folder:opened, drift:threshold, invention:flagged, schedule, webhook). Mirror the Automator "when" conditions + variables.
- **Action Library expansion**: Map every major category from the user's Automator MD into the tools registry:
  - Files & Finder (copy/move/rename/filter/archive).
  - Text/Documents (extract PDF annotations, merge/split, text-to-speech, OCR via MCP).
  - Images & Media (batch resize, Quartz filters, video trim, thumbnail generation).
  - Internet & Communication (download to PDF, RSS parse, email with attachments, FTP/S3 upload).
  - System & Utilities (calendar alarms, dictation commands, key simulation, VPN toggle, launch apps).
  - Scripting escape hatches (run AppleScript/JS/Python/Shell inside a receipted sandbox with policy checks).
- **Packs & Sharing**: First-class "Automation Packs" (reusable .aletheia-pack JSON or visual graphs) that can be installed via templates.js and appear in the Operations panel like Automator's library.
- **Multiple surfaces**: Hotkey/Quick Action style invocation from the desktop (future Tauri or menu bar integration), calendar-driven automations, print-to-folder plugin.
- **Variables & Data Flow**: Full port of node_connections dataMapping + conditions so one action's output becomes another's input (exactly like Automator variables or ComfyUI wires).

### Phase 3 — Full RSVPuix Port + Premium Experience (6-10 weeks)
- Replace the current ReactFlow builder (or add a parallel "Smart Folder" mode) with a first-class folder simile:
  - Desktop folder grid + infinite canvas hybrid (inspired by the grounded preview.html).
  - Sliding panels using FocusedContent + Framer Motion patterns from RSVPuix (Intent, Operations, Truth/Receipts, Connectivity, Metrics).
  - LiveTile / CardRenderer for nodes with receipt badges, drift sparklines, invention flags.
  - Keyboard shortcuts (n8n-like): `/` search, `c` create node, `e` execute automation, `r` recall, Escape to close panels.
- Premium Keramos tactile treatment across the entire view (warm stone/porcelain/wood textures, subtle shadows, yellow sunshine accent for "grounded" states, responsive header that collapses beautifully on mobile/tablet).
- Receipt inspector with timeline, Spec vs Runtime diff view, cryptographic verification (verify signature button), export to PDF/JSON with embedded proof.
- Agentic dials as beautiful, interactive gauges (heartbeats pulse in real time, souls as orbiting particles, skills as a radar/spider chart, drift as a live thermometer with history).

### Phase 4 — Production Hardening & Hono Mirror (parallel with Phase 3)
- Persist receipts, watchers, and automation rules:
  - New Drizzle tables: `grounded_receipts`, `node_watchers`, `automation_rules`, `automation_executions`.
  - Receipt emission moves from in-memory Map to DB + optional Upstash/Vector for fast recall.
- Mirror the entire wired logic (grounded-receipt lib, watcher notification, trigger execution, suggestFileActions) into the Hono `src/` path so production traffic (vercel.json) gets the truth layer.
- Real ed25519 key management:
  - Per-account or per-organization signing keys (stored encrypted in user settings, like the existing openaiKey/anthropicKey BYOK pattern).
  - Public key registry for verification.
  - Revocation + key rotation UI.
- Performance & scale: batch receipt writes, WebSocket/SSE for live watcher notifications instead of polling, circuit breakers on external MCP tools.

### Phase 5 — Agent Folders + Autonomous Execution (8-12 weeks)
- "Agent Folder" node type: a folder that can run autonomously using GOAP planning on top of its own receipt memory + the broader ontology graph.
- The agent proposes which Automator-style pack or tool chain to run next, subject to the root SpecTruth + policy engine.
- Receipts from autonomous runs are first-class (human can review, approve, or correct — creating new grounded corrections).
- Souls/skills system becomes the agent's "personality" and capability surface (visible in the dials panel).
- Security model: folder-level policy guardrails, receipt-based audit for every autonomous decision.

### Phase 6 — GTM, Ecosystem & Advanced Features
- **Marketing**:
  - Dedicated Aletheia landing page or deep services.html section with the Automator comparison ("Automator for agents that must tell the truth").
  - Case study using the user's own grounded session artifacts (the api/ wiring + this document as proof of the methodology).
  - Private design partner program: 5-10 serious agent builders get early access to the 5173 unified surface + custom Packs.
- **Ecosystem**:
  - Public Pack marketplace (like Automator's library, but receipt-verified and cache-optimized).
  - MCP server exposing the tools registry + receipt query endpoints.
  - SDK additions: Node/TS/Python clients that can "attach" a local folder to an Aletheia Smart Folder and sync receipts.
- **Advanced capabilities**:
  - Receipt-powered RAG: every chunk in memory has provenance back to the originating GroundedReceipt.
  - Cross-folder ontology federation (one agent's inventions become another's knowledge with attribution).
  - "What If" simulation: run an automation pack against historical receipts to see drift/invention impact before live execution.
  - Compliance exports: full signed receipt bundles for regulated industries (legal, finance, healthcare).
  - Desktop integration (Tauri or Electron shell) so dropping a file on the local machine triggers the cloud Smart Folder automations with the same receipt trail.

### Technical Debt & Long-Term Architecture
- Move `grounded-receipt.js` + canonical signing helpers into a shared workspace package (`@agentcache/grounded-receipt`) consumable by both api/ legacy path and Hono src/.
- Canonical NodeDirectory class becomes the single source of truth runtime (the ~/grounded/prototype becomes the reference implementation that the DB-backed version shadows).
- Full test coverage for receipt determinism, signature verification, watcher notification, and Automator Pack execution.
- Observability: every receipt emission also emits structured logs + metrics to the existing observability stack.

---

**This roadmap turns the "two separate things on 5173 and 3000" into a single, defensible, Automator-inspired product that no one else can build** — because only AgentCache has the combination of semantic cache, cognitive memory, policy, MCP, ontology, and now the GroundedReceipt truth layer.

The future is a folder on your desktop (or canvas) that *thinks*, remembers, proves what it did, and gets smarter every time you use it.

*End of Future Enhancements Roadmap.*

---

**Proceeding with unification code slice (unify-4/5) and any further direction from the user.**

*Document complete as of the "proceed, also add future enhancements" request.*
