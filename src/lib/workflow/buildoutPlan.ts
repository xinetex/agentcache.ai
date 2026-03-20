export type BuildoutLane =
  | 'architecture'
  | 'software-quality'
  | 'storage-mesh'
  | 'trust-evidence'
  | 'market-systems'
  | 'revenue-ops'
  | 'design-partners';

export type BuildoutStatus = 'planned' | 'ready' | 'blocked' | 'completed';

export interface BuildoutStep {
  id: string;
  phase: string;
  title: string;
  lane: BuildoutLane;
  repo: 'agentcache-ai' | 'maxxeval' | 'jettythunder' | 'cross-repo';
  objective: string;
  deliverable: string;
  validation: string;
  dependencies?: string[];
  status: BuildoutStatus;
}

export const BUILDOUT_STEPS: BuildoutStep[] = [
  {
    id: 'S01',
    phase: 'Phase 1: Foundation',
    title: 'Lock shared receipt schema as the cross-repo contract',
    lane: 'architecture',
    repo: 'cross-repo',
    objective: 'Make receipts the authoritative event contract across AgentCache, MaxxEval, and JettyThunder.',
    deliverable: 'Signed schema version and repo mapping for receipt producers and consumers.',
    validation: 'Contract tests pass and docs reference one canonical schema.',
    status: 'completed',
  },
  {
    id: 'S02',
    phase: 'Phase 1: Foundation',
    title: 'Emit storage transfer receipts from JettyThunder flows',
    lane: 'storage-mesh',
    repo: 'jettythunder',
    objective: 'Capture upload, download, and multipart transfer evidence as first-class receipts.',
    deliverable: 'Readonly storage receipt emission in transfer and chunk paths.',
    validation: 'JettyThunder tests confirm stable receiptId and provider refs.',
    dependencies: ['S01'],
    status: 'completed',
  },
  {
    id: 'S03',
    phase: 'Phase 1: Foundation',
    title: 'Ingest JettyThunder storage receipts into AgentCache',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Make storage evidence visible from AgentCache receipt APIs and summaries.',
    deliverable: 'Receipt ingest path accepts storage transfer receipts and exposes rollups.',
    validation: 'Receipt summary shows storage transfer counts and verdicts.',
    dependencies: ['S02'],
    status: 'completed',
  },
  {
    id: 'S04',
    phase: 'Phase 1: Foundation',
    title: 'Add MaxxEval receipt relay helper',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Post paid-route and trust receipts into AgentCache with shared signing.',
    deliverable: 'Reusable receipt client and route-level integrations.',
    validation: 'Paid route tests verify relay payload shape and error handling.',
    dependencies: ['S01'],
    status: 'completed',
  },
  {
    id: 'S05',
    phase: 'Phase 1: Foundation',
    title: 'Create receipt inspection dashboard surface',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Give operators a usable read path into receipt health and provenance.',
    deliverable: 'Dashboard panel or API report for receipt counts, failures, and signature status.',
    validation: 'Local contract tests cover receipt summary and filtering semantics.',
    dependencies: ['S03', 'S04'],
    status: 'planned',
  },
  {
    id: 'S06',
    phase: 'Phase 1: Foundation',
    title: 'Normalize principal identity across API keys, profiles, and wallets',
    lane: 'architecture',
    repo: 'cross-repo',
    objective: 'Stop trust and receipt attribution from fragmenting across aliases.',
    deliverable: 'Identity mapping rules and shared helper surfaces.',
    validation: 'Badges, trust exports, and receipts all resolve to the same principal reference.',
    status: 'planned',
  },
  {
    id: 'S07',
    phase: 'Phase 2: Storage Mesh',
    title: 'Add Lyve object-scope verification script',
    lane: 'storage-mesh',
    repo: 'agentcache-ai',
    objective: 'Verify the real storage posture with safe head/get probes instead of bucket-wide assumptions.',
    deliverable: 'Readonly verification script for endpoint, region, and object-level access.',
    validation: 'Script reports reachable endpoint, effective region, and object-scope access results.',
    dependencies: ['S02'],
    status: 'completed',
  },
  {
    id: 'S08',
    phase: 'Phase 2: Storage Mesh',
    title: 'Add endpoint-region mismatch health gate',
    lane: 'software-quality',
    repo: 'cross-repo',
    objective: 'Prevent silent storage misconfiguration before transfers start.',
    deliverable: 'Health check and CI validation for Lyve endpoint-region alignment.',
    validation: 'Known bad configs fail the gate in tests.',
    dependencies: ['S07'],
    status: 'completed',
  },
  {
    id: 'S09',
    phase: 'Phase 2: Storage Mesh',
    title: 'Define chunk warming and cache miss policy',
    lane: 'storage-mesh',
    repo: 'cross-repo',
    objective: 'Make AgentCache and JettyThunder follow the same cache miss and warm behavior.',
    deliverable: 'Policy doc and request/response contract for warm, miss, and retry.',
    validation: 'Contract tests cover hit, miss, fallback, and retry metadata.',
    dependencies: ['S03'],
    status: 'planned',
  },
  {
    id: 'S10',
    phase: 'Phase 2: Storage Mesh',
    title: 'Instrument transfer ROI metrics',
    lane: 'revenue-ops',
    repo: 'cross-repo',
    objective: 'Quantify saved latency, cache hit reuse, and avoided origin fetches for storage flows.',
    deliverable: 'Shared ROI fields and rollups for storage transfers.',
    validation: 'Metrics appear in AgentCache stats and can be consumed by MaxxEval.',
    dependencies: ['S03', 'S09'],
    status: 'planned',
  },
  {
    id: 'S11',
    phase: 'Phase 2: Storage Mesh',
    title: 'Add edge health scorecards for JettySpeed routes',
    lane: 'storage-mesh',
    repo: 'agentcache-ai',
    objective: 'Track which edge handoff routes are actually healthy and worth routing to.',
    deliverable: 'Edge health report with latency, hit rate, and failure counters.',
    validation: 'Local tests and stats endpoint expose edge health summary.',
    dependencies: ['S09'],
    status: 'planned',
  },
  {
    id: 'S12',
    phase: 'Phase 2: Storage Mesh',
    title: 'Create storage evidence bundle export',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Let operators and buyers export proof of storage transfer behavior.',
    deliverable: 'Receipt-backed storage evidence export API.',
    validation: 'Export contains receipt refs, transfer summaries, and signature status.',
    dependencies: ['S03', 'S04'],
    status: 'planned',
  },
  {
    id: 'S13',
    phase: 'Phase 3: Trust Products',
    title: 'Ship honest uncertainty receipts',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Turn uncertainty admission into measurable trust evidence rather than hidden failure.',
    deliverable: 'Receipt subject and API support for uncertainty/confession events.',
    validation: 'Pathological and trust flows can emit and summarize uncertainty receipts.',
    dependencies: ['S05'],
    status: 'planned',
  },
  {
    id: 'S14',
    phase: 'Phase 3: Trust Products',
    title: 'Extend Pathological API with storage and retrieval probes',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Stress-test retrieval, cache freshness, and storage handoff failure modes.',
    deliverable: 'Profiles and assessments focused on memory fabric and storage behavior.',
    validation: 'Deterministic pathology tests cover storage/retrieval scenarios.',
    dependencies: ['S09', 'S13'],
    status: 'planned',
  },
  {
    id: 'S15',
    phase: 'Phase 3: Trust Products',
    title: 'Add provider trust scorecards to MaxxEval',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Turn AgentCache evidence into provider-facing trust summaries.',
    deliverable: 'Provider trust/profile surface including storage and browser-proof metrics.',
    validation: 'Paid trust routes return provider scorecard fields backed by receipts.',
    dependencies: ['S04', 'S12'],
    status: 'planned',
  },
  {
    id: 'S16',
    phase: 'Phase 3: Trust Products',
    title: 'Create evidence-backed billing modifiers',
    lane: 'revenue-ops',
    repo: 'maxxeval',
    objective: 'Use receipt quality and trust posture to influence pricing or escrow requirements.',
    deliverable: 'Pricing policy tied to evidence coverage and provider health.',
    validation: 'Pricing logic is test-covered and traceable to receipt metrics.',
    dependencies: ['S15'],
    status: 'planned',
  },
  {
    id: 'S17',
    phase: 'Phase 3: Trust Products',
    title: 'Expose storage mesh posture in AgentCache catalog',
    lane: 'revenue-ops',
    repo: 'agentcache-ai',
    objective: 'Sell the storage mesh as a measurable product surface, not just a backend detail.',
    deliverable: 'Catalog entries and documentation for transfer evidence and storage acceleration.',
    validation: 'Catalog routes expose live SKU metadata and requirements.',
    dependencies: ['S10', 'S12'],
    status: 'planned',
  },
  {
    id: 'S18',
    phase: 'Phase 4: Design Partner Readiness',
    title: 'Prepare enterprise copilot pilot package',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Bundle the Memory Fabric story into a design-partner-ready offer.',
    deliverable: 'Pilot checklist, ROI dashboard requirements, and demo path.',
    validation: 'Internal runbook matches actual product surfaces and metrics.',
    dependencies: ['S10', 'S17'],
    status: 'planned',
  },
  {
    id: 'S19',
    phase: 'Phase 4: Design Partner Readiness',
    title: 'Prepare finance memory fabric pilot package',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Create the finance-specific packaging for fast-moving repeated-query workflows.',
    deliverable: 'Finance pilot narrative, target metrics, and trust evidence bundle.',
    validation: 'Package references real finance routing and proof features.',
    dependencies: ['S10', 'S15'],
    status: 'planned',
  },
  {
    id: 'S20',
    phase: 'Phase 4: Design Partner Readiness',
    title: 'Create design partner onboarding automation',
    lane: 'design-partners',
    repo: 'agentcache-ai',
    objective: 'Shorten the time from prospect to instrumented workflow.',
    deliverable: 'Structured onboarding task list and verification scripts.',
    validation: 'A dry-run onboarding flow completes without manual guesswork.',
    dependencies: ['S18', 'S19'],
    status: 'planned',
  },
  {
    id: 'S21',
    phase: 'Phase 4: Design Partner Readiness',
    title: 'Add managed workload namespaces and tenant policy templates',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Make multi-tenant design partner onboarding predictable and safe.',
    deliverable: 'Namespace template policy and retention presets.',
    validation: 'Policy tests confirm isolation and TTL behavior by template.',
    dependencies: ['S20'],
    status: 'planned',
  },
  {
    id: 'S22',
    phase: 'Phase 4: Design Partner Readiness',
    title: 'Publish evidence-first ROI dashboard',
    lane: 'revenue-ops',
    repo: 'agentcache-ai',
    objective: 'Show a design partner the hard savings and trust coverage on one screen.',
    deliverable: 'Dashboard tying ROI, receipts, and transfer metrics together.',
    validation: 'Dashboard data matches API summaries and test fixtures.',
    dependencies: ['S10', 'S20'],
    status: 'planned',
  },
  {
    id: 'S23',
    phase: 'Phase 5: Orchestration',
    title: 'Create managed buildout orchestrator',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Coordinate sub-agents and work lanes from a single execution graph.',
    deliverable: 'CLI orchestrator with dry-run, phase filtering, and lane dispatch.',
    validation: 'Orchestrator tests pass and dry-run output matches plan data.',
    dependencies: ['S01'],
    status: 'completed',
  },
  {
    id: 'S24',
    phase: 'Phase 5: Orchestration',
    title: 'Add phase-level gating and dependencies to orchestrator',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Prevent the orchestrator from dispatching dependent work out of order.',
    deliverable: 'Dependency-aware filtering and blocked step reporting.',
    validation: 'Orchestrator tests cover blocked, ready, and filtered states.',
    dependencies: ['S23'],
    status: 'completed',
  },
  {
    id: 'S25',
    phase: 'Phase 5: Orchestration',
    title: 'Add transcript and receipt hooks to orchestrator runs',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Make orchestration itself observable and reviewable.',
    deliverable: 'Run transcript output and receipt-ready event structure.',
    validation: 'Orchestrator writes structured logs and can emit stable run ids.',
    dependencies: ['S23'],
    status: 'planned',
  },
  {
    id: 'S26',
    phase: 'Phase 5: Orchestration',
    title: 'Map each build lane to a specialist sub-agent profile',
    lane: 'architecture',
    repo: 'cross-repo',
    objective: 'Give future sub-agents clear scope and avoid generalist thrash.',
    deliverable: 'Lane-to-agent profile table and operating instructions.',
    validation: 'Every lane in the orchestrator resolves to one clear execution role.',
    dependencies: ['S23'],
    status: 'planned',
  },
  {
    id: 'S27',
    phase: 'Phase 6: Revenue Hardening',
    title: 'Tie receipts to SKU-specific billing in MaxxEval',
    lane: 'revenue-ops',
    repo: 'maxxeval',
    objective: 'Bill based on the products we actually deliver and prove.',
    deliverable: 'Receipt-backed billing hooks for storage, browser proof, and trust exports.',
    validation: 'Billing tests reconcile SKU usage with receipt counts.',
    dependencies: ['S04', 'S15', 'S16'],
    status: 'planned',
  },
  {
    id: 'S28',
    phase: 'Phase 6: Revenue Hardening',
    title: 'Add buyer-facing trust filters and proof selectors',
    lane: 'market-systems',
    repo: 'maxxeval',
    objective: 'Let buyers choose providers by evidence quality, not just profiles.',
    deliverable: 'Trust filters using storage proof, browser proof, and receipt coverage.',
    validation: 'Marketplace APIs and pages reflect proof-backed filters.',
    dependencies: ['S15', 'S27'],
    status: 'planned',
  },
  {
    id: 'S29',
    phase: 'Phase 6: Revenue Hardening',
    title: 'Run first internal cross-repo proving loop',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Dogfood the full path from JettyThunder transfer to AgentCache receipt to MaxxEval trust.',
    deliverable: 'Internal proving report with one complete transfer/trust/ROI narrative.',
    validation: 'All three repos contribute evidence to one coherent report.',
    dependencies: ['S03', 'S12', 'S22', 'S27'],
    status: 'planned',
  },
  {
    id: 'S30',
    phase: 'Phase 6: Revenue Hardening',
    title: 'Choose and onboard first three design partners',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Turn the built system into a real operating business with measurable partner pull.',
    deliverable: 'Three design partner targets, scoped workflow, owner, and success metric per target.',
    validation: 'Design partner pipeline exists with concrete ICP, workflow, and metric commitments.',
    dependencies: ['S18', 'S19', 'S22', 'S29'],
    status: 'planned',
  },
  {
    id: 'S31',
    phase: 'Phase 7: External Agent Identity',
    title: 'Create external agent registration model and API',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Support preregistration of third-party bots and agents before runtime evidence exists.',
    deliverable: 'External agent registration schema, route surface, and identity linkage rules.',
    validation: 'Registrations can be created, listed, and linked to later receipts.',
    dependencies: ['S06'],
    status: 'completed',
  },
  {
    id: 'S32',
    phase: 'Phase 7: External Agent Identity',
    title: 'Add Moltbook bot preregistration flow',
    lane: 'market-systems',
    repo: 'cross-repo',
    objective: 'Let Moltbook bots register into AgentCache/MaxxEval through a trustable ownership flow.',
    deliverable: 'Challenge-based preregistration path for Moltbook identities.',
    validation: 'A Moltbook-linked bot can complete ownership proof and receive a registration receipt.',
    dependencies: ['S31'],
    status: 'completed',
  },
  {
    id: 'S33',
    phase: 'Phase 7: External Agent Identity',
    title: 'Add Soulprint scan receipt subject and schema extensions',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Make design-time agent scans first-class trust evidence.',
    deliverable: 'Shared receipt support for Soulprint and preregistration scan metadata.',
    validation: 'Receipt APIs accept and summarize Soulprint scan receipts.',
    dependencies: ['S31'],
    status: 'completed',
  },
  {
    id: 'S34',
    phase: 'Phase 7: External Agent Identity',
    title: 'Build Soulprint static parser for prompts, skills, and config',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Analyze agent configuration before deployment instead of waiting for runtime drift.',
    deliverable: 'Soulprint parser with normalized findings and bias topology output.',
    validation: 'Fixture configs produce deterministic Soulprint findings in tests.',
    dependencies: ['S33'],
    status: 'planned',
  },
  {
    id: 'S35',
    phase: 'Phase 7: External Agent Identity',
    title: 'Expose preregistration and Soulprint report surfaces',
    lane: 'market-systems',
    repo: 'maxxeval',
    objective: 'Turn external registration into a buyer-visible trust surface.',
    deliverable: 'UI/API surfaces for external agent registration status and Soulprint summaries.',
    validation: 'Registered external agents show linked preregistration and Soulprint state in MaxxEval.',
    dependencies: ['S32', 'S34'],
    status: 'planned',
  },
  {
    id: 'S36',
    phase: 'Phase 8: Browser Substrate',
    title: 'Create Panda browser adapter behind BrowserProofService',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Move browser proof from intent-only Lightpanda support to a real adapter boundary.',
    deliverable: 'Panda adapter with fallback chain to Firecrawl and HTTP.',
    validation: 'Adapter tests cover Panda success, fallback, and receipt metadata.',
    dependencies: ['S01'],
    status: 'planned',
  },
  {
    id: 'S37',
    phase: 'Phase 8: Browser Substrate',
    title: 'Add browser witness contract tests for selector and text assertions',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Prove that browser witnesses are reproducible and not just fetch wrappers.',
    deliverable: 'Deterministic contract suite for browser proof witness semantics.',
    validation: 'Tests pass for selector matching, title/meta extraction, and fallback mode tagging.',
    dependencies: ['S36'],
    status: 'planned',
  },
  {
    id: 'S38',
    phase: 'Phase 8: Browser Substrate',
    title: 'Add authenticated browser workflow receipts',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Support login-gated or session-bearing browser tasks with signed receipts.',
    deliverable: 'Authenticated browser proof mode and receipt refs for session-safe flows.',
    validation: 'Receipt shape distinguishes authenticated runs and masks secrets correctly.',
    dependencies: ['S36', 'S37'],
    status: 'planned',
  },
  {
    id: 'S39',
    phase: 'Phase 8: Browser Substrate',
    title: 'Expose browser proof confidence and mode in MaxxEval trust views',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Make browser evidence quality visible to buyers and operators.',
    deliverable: 'Trust/profile views showing browser execution mode, witness quality, and fallback state.',
    validation: 'Paid trust/profile routes include browser-proof quality fields backed by receipts.',
    dependencies: ['S38'],
    status: 'planned',
  },
  {
    id: 'S40',
    phase: 'Phase 8: Browser Substrate',
    title: 'Add browser ROI and failure-rate rollups',
    lane: 'revenue-ops',
    repo: 'agentcache-ai',
    objective: 'Measure the practical value and failure profile of browser-backed evidence.',
    deliverable: 'Browser proof ROI/failure summaries in stats and receipt reports.',
    validation: 'Stats and receipt summaries expose browser success, fallback, and failure ratios.',
    dependencies: ['S38'],
    status: 'planned',
  },
  {
    id: 'S41',
    phase: 'Phase 9: Commerce Trust Surfaces',
    title: 'Create receipt inspection dashboard surface',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Turn receipt summaries into an operator-facing dashboard instead of API-only visibility.',
    deliverable: 'Receipt inspection panel for storage, commerce, browser, and trust receipts.',
    validation: 'Dashboard reflects receipt summary API values and filters consistently.',
    dependencies: ['S03', 'S04'],
    status: 'planned',
  },
  {
    id: 'S42',
    phase: 'Phase 9: Commerce Trust Surfaces',
    title: 'Add buyer-facing proof selectors and commerce receipt filters',
    lane: 'market-systems',
    repo: 'maxxeval',
    objective: 'Let buyers choose providers and listings by evidence coverage, not only reputation blurbs.',
    deliverable: 'Filters for commerce receipts, browser proof, storage proof, and trust coverage.',
    validation: 'Marketplace and order views filter correctly using receipt-backed fields.',
    dependencies: ['S41', 'S39'],
    status: 'planned',
  },
  {
    id: 'S43',
    phase: 'Phase 9: Commerce Trust Surfaces',
    title: 'Add storage and commerce evidence bundle export',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Provide one export path for storage, commerce, and trust evidence.',
    deliverable: 'Evidence bundle API with receipt refs, signatures, and summaries.',
    validation: 'Bundle export contains storage transfers, order lifecycle receipts, and trust exports.',
    dependencies: ['S12', 'S41'],
    status: 'planned',
  },
  {
    id: 'S44',
    phase: 'Phase 9: Commerce Trust Surfaces',
    title: 'Add provider trust scorecards combining storage, commerce, and browser metrics',
    lane: 'trust-evidence',
    repo: 'maxxeval',
    objective: 'Make provider trust a composite of actual evidence across product lines.',
    deliverable: 'Scorecard model and surfaces for provider-level trust composition.',
    validation: 'Provider scorecards reconcile to receipt summaries across all evidence types.',
    dependencies: ['S15', 'S40', 'S43'],
    status: 'planned',
  },
  {
    id: 'S45',
    phase: 'Phase 9: Commerce Trust Surfaces',
    title: 'Add metabolic pricing prototype for receipt-backed tasks',
    lane: 'revenue-ops',
    repo: 'maxxeval',
    objective: 'Price work based on actual computational and evidence cost rather than static guesswork.',
    deliverable: 'Metabolic pricing model tied to latency, retries, and receipt quality.',
    validation: 'Pricing tests show deterministic quotes from receipt-backed metabolic inputs.',
    dependencies: ['S16', 'S44'],
    status: 'planned',
  },
  {
    id: 'S46',
    phase: 'Phase 10: Orchestrator Agents',
    title: 'Add explicit completed-state tracking to orchestrator plan graph',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Let the orchestrator reason about real progress instead of only ready/planned states.',
    deliverable: 'Completed-state support and progress summary helpers in the buildout plan.',
    validation: 'Plan tests cover completed counts and filtered status views.',
    dependencies: ['S23', 'S24'],
    status: 'planned',
  },
  {
    id: 'S47',
    phase: 'Phase 10: Orchestrator Agents',
    title: 'Create specialist sub-agent manifest by lane',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Turn orchestration lanes into explicit sub-agent roles with scope and constraints.',
    deliverable: 'Manifest mapping lanes to specialist agent profiles and default instructions.',
    validation: 'Every lane resolves to a unique specialist profile with ownership rules.',
    dependencies: ['S26'],
    status: 'planned',
  },
  {
    id: 'S48',
    phase: 'Phase 10: Orchestrator Agents',
    title: 'Add orchestrator run transcript and receipt hooks',
    lane: 'trust-evidence',
    repo: 'agentcache-ai',
    objective: 'Make orchestrator work itself a receipt-producing, auditable process.',
    deliverable: 'Structured run transcript, run ids, and receipt hook surfaces.',
    validation: 'Orchestrator dry-runs and dispatches emit stable structured run artifacts.',
    dependencies: ['S25', 'S46'],
    status: 'planned',
  },
  {
    id: 'S49',
    phase: 'Phase 10: Orchestrator Agents',
    title: 'Add dependency-aware dispatch guardrails',
    lane: 'software-quality',
    repo: 'agentcache-ai',
    objective: 'Prevent the orchestrator from dispatching blocked work across repos and lanes.',
    deliverable: 'Dispatch-time dependency checks and blocked-step explanations.',
    validation: 'Dispatch tests verify blocked steps do not enqueue and ready steps do.',
    dependencies: ['S24', 'S46'],
    status: 'planned',
  },
  {
    id: 'S50',
    phase: 'Phase 10: Orchestrator Agents',
    title: 'Add sub-agent work packet generation',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Generate consistent work packets for specialist sub-agents instead of free-form dispatch payloads.',
    deliverable: 'Work packet schema with repo, objective, validation, and artifact requirements.',
    validation: 'Orchestrator can emit lane-specific work packets for selected steps.',
    dependencies: ['S47', 'S49'],
    status: 'planned',
  },
  {
    id: 'S51',
    phase: 'Phase 11: Design Partner Operations',
    title: 'Create design partner onboarding automation',
    lane: 'design-partners',
    repo: 'agentcache-ai',
    objective: 'Turn partner onboarding from a manual founder task into a repeatable system.',
    deliverable: 'Automation-ready onboarding workflow with required inputs, gates, and outputs.',
    validation: 'A dry-run partner onboarding completes without missing-step ambiguity.',
    dependencies: ['S20'],
    status: 'planned',
  },
  {
    id: 'S52',
    phase: 'Phase 11: Design Partner Operations',
    title: 'Add managed workload namespaces and tenant policy templates',
    lane: 'architecture',
    repo: 'agentcache-ai',
    objective: 'Make new partner onboarding safe, fast, and policy-consistent.',
    deliverable: 'Reusable tenant policy templates for storage, browser, and receipt behavior.',
    validation: 'Template tests confirm isolation, TTL, and evidence-mode defaults.',
    dependencies: ['S21', 'S51'],
    status: 'planned',
  },
  {
    id: 'S53',
    phase: 'Phase 11: Design Partner Operations',
    title: 'Publish evidence-first ROI dashboard',
    lane: 'revenue-ops',
    repo: 'agentcache-ai',
    objective: 'Give partners one place to see savings, proof coverage, and trust posture.',
    deliverable: 'Dashboard tying ROI, storage, commerce, browser, and trust metrics together.',
    validation: 'Dashboard values match receipt summaries and ROI APIs.',
    dependencies: ['S22', 'S41', 'S40'],
    status: 'planned',
  },
  {
    id: 'S54',
    phase: 'Phase 11: Design Partner Operations',
    title: 'Run first internal cross-repo proving loop',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Prove the full loop from storage and browser evidence to trust and commerce receipts.',
    deliverable: 'Internal proving report with one end-to-end storage/browser/trust/commerce narrative.',
    validation: 'All three repos contribute evidence to one coherent internal report.',
    dependencies: ['S29', 'S43', 'S53'],
    status: 'planned',
  },
  {
    id: 'S55',
    phase: 'Phase 11: Design Partner Operations',
    title: 'Create design-partner case study export',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Turn internal proving data into partner-facing narrative material.',
    deliverable: 'Case study export with ROI, trust, and evidence bundle sections.',
    validation: 'Export can be generated from real receipt and ROI fixtures.',
    dependencies: ['S54'],
    status: 'planned',
  },
  {
    id: 'S56',
    phase: 'Phase 12: Revenue and Market Grounding',
    title: 'Tie receipts to SKU-specific billing in MaxxEval',
    lane: 'revenue-ops',
    repo: 'maxxeval',
    objective: 'Make billing follow actual delivered proof-bearing work.',
    deliverable: 'Receipt-backed billing for storage, browser proof, trust exports, and commerce actions.',
    validation: 'Billing tests reconcile SKU usage to receipt counts and categories.',
    dependencies: ['S27', 'S43', 'S45'],
    status: 'planned',
  },
  {
    id: 'S57',
    phase: 'Phase 12: Revenue and Market Grounding',
    title: 'Choose and score first three design partner targets',
    lane: 'design-partners',
    repo: 'cross-repo',
    objective: 'Turn market thesis into a concrete, ranked target list.',
    deliverable: 'Three design partner targets with workflow, owner, and metric fit.',
    validation: 'Target list exists with explicit ICP, contact path, and success metric per target.',
    dependencies: ['S18', 'S19', 'S55'],
    status: 'planned',
  },
  {
    id: 'S58',
    phase: 'Phase 12: Revenue and Market Grounding',
    title: 'Create founder-facing pipeline tracker for partner outreach',
    lane: 'design-partners',
    repo: 'agentcache-ai',
    objective: 'Make partner pursuit visible and reviewable inside the operating system.',
    deliverable: 'Simple tracked pipeline with stage, owner, and next action fields.',
    validation: 'Pipeline state is queriable and matches the first three target records.',
    dependencies: ['S57'],
    status: 'planned',
  },
  {
    id: 'S59',
    phase: 'Phase 12: Revenue and Market Grounding',
    title: 'Package Soulprint and Grief Engine as attachable trust products',
    lane: 'market-systems',
    repo: 'cross-repo',
    objective: 'Turn our strongest asymmetric trust ideas into concrete add-ons to the main platform.',
    deliverable: 'SKU, API, and packaging spec for Soulprint and failure-trajectory products.',
    validation: 'Product surfaces map to existing receipt and trust infrastructure without hand-waving.',
    dependencies: ['S34', 'S35', 'S14'],
    status: 'planned',
  },
  {
    id: 'S60',
    phase: 'Phase 12: Revenue and Market Grounding',
    title: 'Run launch-readiness review for the next public operating cycle',
    lane: 'software-quality',
    repo: 'cross-repo',
    objective: 'Decide what is truly ready for external positioning and partner selling.',
    deliverable: 'Readiness review with shipping surface, risk list, and blocked items.',
    validation: 'Review references real validation signals and produces explicit ship/no-ship calls.',
    dependencies: ['S56', 'S57', 'S58', 'S59'],
    status: 'planned',
  },
];

export function listBuildoutSteps(options?: {
  phase?: string;
  lane?: BuildoutLane;
  status?: BuildoutStatus;
}): BuildoutStep[] {
  return BUILDOUT_STEPS.filter((step) => {
    if (options?.phase && step.phase !== options.phase) return false;
    if (options?.lane && step.lane !== options.lane) return false;
    if (options?.status && step.status !== options.status) return false;
    return true;
  });
}

export function getBuildoutStep(stepId: string): BuildoutStep | undefined {
  return BUILDOUT_STEPS.find((step) => step.id === stepId);
}

export function summarizeBuildoutSteps(steps: BuildoutStep[] = BUILDOUT_STEPS) {
  const byStatus = new Map<BuildoutStatus, number>();
  const byPhase = new Map<string, { total: number; completed: number }>();

  for (const step of steps) {
    byStatus.set(step.status, (byStatus.get(step.status) || 0) + 1);

    const phase = byPhase.get(step.phase) || { total: 0, completed: 0 };
    phase.total += 1;
    if (step.status === 'completed') {
      phase.completed += 1;
    }
    byPhase.set(step.phase, phase);
  }

  return {
    total: steps.length,
    byStatus: Object.fromEntries(byStatus.entries()),
    byPhase: Array.from(byPhase.entries()).map(([phase, counts]) => ({
      phase,
      total: counts.total,
      completed: counts.completed,
      remaining: counts.total - counts.completed,
    })),
  };
}

export function getReadyBuildoutSteps(): BuildoutStep[] {
  const completed = new Set<string>();

  return BUILDOUT_STEPS.filter((step) => {
    const dependencies = step.dependencies || [];
    const depsSatisfied = dependencies.every((dependency) => completed.has(dependency) || !getBuildoutStep(dependency));

    if (step.status === 'ready' && depsSatisfied) {
      completed.add(step.id);
      return true;
    }

    return step.status === 'ready' && dependencies.length === 0;
  });
}

export function toMarkdownChecklist(steps: BuildoutStep[] = BUILDOUT_STEPS): string {
  const lines: string[] = ['# Buildout Execution Graph', ''];
  let currentPhase = '';

  for (const step of steps) {
    if (step.phase !== currentPhase) {
      currentPhase = step.phase;
      lines.push(`## ${currentPhase}`, '');
    }

    lines.push(`- [ ] ${step.id} ${step.title}`);
    lines.push(`  - Lane: \`${step.lane}\``);
    lines.push(`  - Repo: \`${step.repo}\``);
    lines.push(`  - Objective: ${step.objective}`);
    lines.push(`  - Deliverable: ${step.deliverable}`);
    lines.push(`  - Validation: ${step.validation}`);

    if (step.dependencies?.length) {
      lines.push(`  - Dependencies: ${step.dependencies.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function toMarkdownSummary(steps: BuildoutStep[] = BUILDOUT_STEPS): string {
  const summary = summarizeBuildoutSteps(steps);
  const lines: string[] = ['# Buildout Summary', ''];
  lines.push(`- Total steps: ${summary.total}`);
  lines.push(`- Completed: ${summary.byStatus.completed || 0}`);
  lines.push(`- Ready: ${summary.byStatus.ready || 0}`);
  lines.push(`- Planned: ${summary.byStatus.planned || 0}`);
  lines.push(`- Blocked: ${summary.byStatus.blocked || 0}`);
  lines.push('');
  lines.push('## Phase Progress', '');

  for (const phase of summary.byPhase) {
    lines.push(`- ${phase.phase}: ${phase.completed}/${phase.total} completed`);
  }

  return lines.join('\n');
}
