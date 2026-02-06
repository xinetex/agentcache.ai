/**
 * Seed Maxxeval with Focus Group Report Data
 *
 * Extracts findings from the Nov 2025 focus group evaluation
 * (8 agent personas + 5 user personas) and pushes them as
 * real demand signals into the Maxxeval API.
 *
 * Usage:
 *   npx tsx scripts/seed-maxxeval.ts
 *
 * This populates the dashboard at maxxeval.com/loop/ with real data.
 */

const MAXXEVAL_API = process.env.MAXXEVAL_API_URL || 'https://maxxeval-api.vercel.app';

// ============================================================================
// AGENT PERSONAS (from FOCUS_GROUP_REPORT.md)
// ============================================================================

const AGENTS = [
    { id: 'fg_healthcare_agent', name: 'Healthcare AI Assistant', capabilities: ['diagnosis', 'clinical-support', 'phi-protection'], source: 'focus_group' },
    { id: 'fg_finance_agent', name: 'Financial Trading Bot', capabilities: ['market-analysis', 'hft', 'fraud-detection'], source: 'focus_group' },
    { id: 'fg_legal_agent', name: 'Legal Research Assistant', capabilities: ['contract-analysis', 'precedent-search', 'compliance'], source: 'focus_group' },
    { id: 'fg_education_agent', name: 'Education Tutor Bot', capabilities: ['tutoring', 'adaptive-learning', 'ferpa-compliance'], source: 'focus_group' },
    { id: 'fg_ecommerce_agent', name: 'E-commerce Recommendation Engine', capabilities: ['recommendations', 'personalization', 'inventory'], source: 'focus_group' },
    { id: 'fg_enterprise_agent', name: 'Enterprise IT Support Bot', capabilities: ['helpdesk', 'knowledge-base', 'sso'], source: 'focus_group' },
    { id: 'fg_developer_agent', name: 'Developer Code Assistant', capabilities: ['code-generation', 'debugging', 'ide-integration'], source: 'focus_group' },
    { id: 'fg_datascience_agent', name: 'Data Science RAG System', capabilities: ['rag', 'embeddings', 'data-governance'], source: 'focus_group' },
];

// ============================================================================
// MISSING CAPABILITIES (Critical Gaps from each agent persona)
// ============================================================================

const MISSING_CAPABILITIES = [
    // Healthcare Agent
    { agentId: 'fg_healthcare_agent', capability: 'Agent SDK (Python/Node.js client library with retry logic and type definitions)', context: 'Healthcare agents must manually construct HTTP requests with no error handling', urgency: 'critical' },
    { agentId: 'fg_healthcare_agent', capability: 'Real-time event system (webhooks for cache invalidation, pub/sub for multi-agent coordination)', context: 'Cannot subscribe to cache events or trigger alerts on PHI detection', urgency: 'critical' },
    { agentId: 'fg_healthcare_agent', capability: 'Secure context passing (patient context, conversation threading, session management)', context: 'No way to pass patient context securely or chain multiple agent queries', urgency: 'high' },

    // Finance Agent
    { agentId: 'fg_finance_agent', capability: 'Streaming API (SSE, WebSocket support for real-time partial results)', context: 'All responses are synchronous, no partial results for HFT use case', urgency: 'critical' },
    { agentId: 'fg_finance_agent', capability: 'Batch operations (parallel query support, bulk cache warm-up)', context: 'Must query one security at a time, cannot analyze portfolio of 500 stocks efficiently', urgency: 'high' },
    { agentId: 'fg_finance_agent', capability: 'Multi-region edge deployment with latency guarantees', context: 'No guarantee of <50ms in all regions, no edge network integration', urgency: 'high' },

    // Legal Agent
    { agentId: 'fg_legal_agent', capability: 'Semantic search API (vector similarity search, embedding reuse)', context: 'Cache is keyword-based only, cannot find similar contracts easily', urgency: 'critical' },
    { agentId: 'fg_legal_agent', capability: 'Document upload and OCR (PDF upload, document versioning)', context: 'Must pass full contract text in prompt, no direct document upload', urgency: 'high' },
    { agentId: 'fg_legal_agent', capability: 'Bulk data export (export cached precedents, retrieve cache keys)', context: 'Cannot export all cached precedents, no Westlaw/LexisNexis integration', urgency: 'medium' },

    // Education Agent
    { agentId: 'fg_education_agent', capability: 'Multi-tenancy with namespace isolation (per-school, per-student)', context: 'Cannot isolate student data by school district, no hierarchical access control', urgency: 'critical' },
    { agentId: 'fg_education_agent', capability: 'Personalization engine (adaptive caching by learning style, A/B testing)', context: 'Cache does not adapt to student learning style, no progress tracking', urgency: 'high' },

    // E-commerce Agent
    { agentId: 'fg_ecommerce_agent', capability: 'User segmentation and cohort-based caching', context: 'Cannot cache by user cohort, no collaborative filtering integration', urgency: 'high' },
    { agentId: 'fg_ecommerce_agent', capability: 'Inventory-aware cache invalidation (webhooks for stock changes)', context: 'Cache does not know if product is in stock, no Shopify/Magento webhooks', urgency: 'high' },

    // Enterprise Agent
    { agentId: 'fg_enterprise_agent', capability: 'Ticket system integration (Zendesk/ServiceNow auto-populate, escalation)', context: 'Cannot auto-populate cache from ticket systems, no escalation workflows', urgency: 'high' },
    { agentId: 'fg_enterprise_agent', capability: 'Team collaboration on cached responses (shared annotations, flagging)', context: 'Support agents cannot see what is cached, no shared annotation', urgency: 'medium' },

    // Developer Agent
    { agentId: 'fg_developer_agent', capability: 'IDE integration (VSCode/Cursor/Windsurf extensions)', context: 'Must use REST API manually, no inline code suggestions', urgency: 'critical' },
    { agentId: 'fg_developer_agent', capability: 'Code context awareness (project structure, AST-based caching, git branch)', context: 'Cache does not understand project structure or reference other files', urgency: 'high' },

    // Data Science Agent
    { agentId: 'fg_datascience_agent', capability: 'Built-in vector database (native embedding cache, hybrid search)', context: 'Must bring own Pinecone/Weaviate, no native vector search', urgency: 'critical' },
    { agentId: 'fg_datascience_agent', capability: 'Notebook integration (Jupyter magic commands, Databricks support)', context: 'No Jupyter/Databricks notebook support, must use CLI/API manually', urgency: 'high' },
    { agentId: 'fg_datascience_agent', capability: 'Data governance (column-level permissions, PII detection in results, lineage)', context: 'Cannot enforce column-level permissions or track data lineage through cache', urgency: 'high' },
];

// ============================================================================
// FRICTION POINTS (Pain points from agents + users)
// ============================================================================

const FRICTION_POINTS = [
    { agentId: 'fg_healthcare_agent', task: 'Integrating cache with clinical decision support', frictionPoints: ['No Agent SDK', 'Must manually construct HTTP requests', 'No retry logic', 'Missing type definitions'], timeCost: '2-3 weeks per integration' },
    { agentId: 'fg_finance_agent', task: 'Real-time market analysis with cached data', frictionPoints: ['Synchronous-only responses', 'Cannot stream partial results', 'No SSE support', 'No batch queries'], timeCost: '50ms latency budget exceeded' },
    { agentId: 'fg_legal_agent', task: 'Searching cached legal precedents semantically', frictionPoints: ['Keyword-only cache', 'No vector similarity', 'Must re-embed every query', 'No document upload'], timeCost: '10x slower than needed' },
    { agentId: 'fg_education_agent', task: 'Isolating student data across school districts', frictionPoints: ['No multi-tenancy', 'No namespace-per-user', 'No hierarchical access control', 'Cross-student data leakage risk'], timeCost: 'Compliance blocker' },
    { agentId: 'fg_ecommerce_agent', task: 'Keeping recommendations fresh with inventory changes', frictionPoints: ['Cache unaware of stock status', 'No inventory webhooks', 'Stale recommendations served', 'Manual invalidation required'], timeCost: 'Lost sales from out-of-stock recommendations' },
    { agentId: 'fg_enterprise_agent', task: 'Connecting cache to existing ticket workflows', frictionPoints: ['No Zendesk/ServiceNow integration', 'Must build custom bridge', 'No escalation support', 'Cannot link cached answers to tickets'], timeCost: '4-6 weeks custom development' },
    { agentId: 'fg_developer_agent', task: 'Using cache from IDE without leaving editor', frictionPoints: ['No VSCode extension', 'Must switch to REST client', 'No inline suggestions', 'Context lost on every query'], timeCost: 'Developer flow broken' },
    { agentId: 'fg_datascience_agent', task: 'Running cached queries from Jupyter notebooks', frictionPoints: ['No notebook integration', 'Must use CLI separately', 'No magic commands', 'Cannot inline results'], timeCost: 'Extra 5 minutes per query' },
    // User persona friction
    { agentId: 'fg_healthcare_agent', task: 'Enterprise evaluation blocked by missing compliance docs', frictionPoints: ['No BAA template', 'No SOC2 report', 'No security questionnaire', 'Legal team cannot approve'], timeCost: 'Deal blocker - months of delay' },
    { agentId: 'fg_developer_agent', task: 'Onboarding too complex for simple use case', frictionPoints: ['Must choose sector immediately', 'Overwhelmed by compliance options', 'Wizard has too many steps', 'No npm install quick start'], timeCost: 'Abandonment in first 5 minutes' },
    { agentId: 'fg_enterprise_agent', task: 'Enterprise-wide deployment evaluation', frictionPoints: ['No RBAC', 'No team collaboration', 'No admin delegation', 'No SLA commitments', 'Rate limits not documented'], timeCost: 'Cannot recommend to leadership' },
    { agentId: 'fg_education_agent', task: 'Meeting FERPA student privacy requirements', frictionPoints: ['No bulk student data deletion', 'Missing parental consent workflow', 'No COPPA age verification', 'Cannot generate privacy reports'], timeCost: 'Regulatory risk' },
];

// ============================================================================
// WORKFLOW PATTERNS (What works well / recommendations)
// ============================================================================

const PATTERNS = [
    { agentId: 'fg_healthcare_agent', name: 'HIPAA Pipeline Template', description: 'Pre-built HIPAA-compliant pipeline with PHI filter, audit logging, and 88% cache hit rate for clinical Q&A', steps: ['Configure HIPAA sector template', 'Enable PHI filter node', 'Set 7-day TTL for medical knowledge', 'Enable audit logging'], tags: ['healthcare', 'compliance', 'hipaa'] },
    { agentId: 'fg_finance_agent', name: 'Low-Latency Cache Strategy', description: '38ms average latency achieved using L1 memory cache with PCI-DSS compliance for financial data', steps: ['Use L1 in-memory cache (no Redis round-trip)', 'Enable PCI-DSS filter', 'Set short TTL (5 min) for market data', 'Use deterministic hashing for identical queries'], tags: ['finance', 'low-latency', 'compliance'] },
    { agentId: 'fg_legal_agent', name: 'Legal Research Cache with Long TTL', description: 'Citation validator + privilege guard + 7-day TTL for legal research. Matter tracker for billing integration.', steps: ['Enable privilege guard', 'Configure citation validator', 'Set 7-day TTL', 'Enable matter tracker for billing'], tags: ['legal', 'compliance', 'research'] },
    { agentId: 'fg_ecommerce_agent', name: 'High Hit Rate Product Recommendations', description: '94% cache hit rate for product recommendations using deterministic query hashing and price freshness validation', steps: ['Hash by product category + user segment', 'Enable price freshness validation', 'Set 1-hour TTL for trending items', 'Warm cache for top 100 products daily'], tags: ['ecommerce', 'recommendations', 'high-throughput'] },
    { agentId: 'fg_enterprise_agent', name: 'Enterprise SSO + Department Routing', description: 'SSO connector (Okta/Azure AD) with department router isolating HR/IT/Finance cached responses', steps: ['Configure SSO connector', 'Set up department routing rules', 'Enable knowledge base integration', 'Set per-department cache namespaces'], tags: ['enterprise', 'sso', 'multi-tenant'] },
    { agentId: 'fg_developer_agent', name: 'Reasoning Cache for O1 Queries', description: 'Cache expensive reasoning model outputs (O1/O3) with secret scanner to prevent API key leakage. 90% hit rate on repetitive coding tasks.', steps: ['Enable secret scanner on all cached content', 'Use semantic matching for code queries', 'Set per-project namespaces', 'Configure cost budget alerts'], tags: ['developer', 'reasoning', 'cost-optimization'] },
    { agentId: 'fg_datascience_agent', name: 'Lakehouse RAG with Embedding Cache', description: 'Databricks/Snowflake connector + MLflow experiment tracking + embedding cache saves huge costs on repeated vector searches', steps: ['Connect lakehouse source', 'Enable embedding cache layer', 'Configure MLflow tracking', 'Set OpenLineage for reproducibility'], tags: ['data-science', 'rag', 'embeddings'] },
    { agentId: 'fg_education_agent', name: 'FERPA-Compliant Tutoring Cache', description: 'FERPA filter + pedagogical validator + 90% hit rate. Learning analytics tracking for adaptive content delivery.', steps: ['Enable FERPA student data filter', 'Configure pedagogical validator for age-appropriate content', 'Set up learning analytics tracking', 'Use per-student namespaces'], tags: ['education', 'ferpa', 'adaptive-learning'] },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function postJson(path: string, body: any): Promise<any> {
    const url = `${MAXXEVAL_API}${path}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) {
            console.error(`  ✗ ${res.status} ${url}: ${text}`);
            return null;
        }
        try { return JSON.parse(text); } catch { return text; }
    } catch (err: any) {
        console.error(`  ✗ Network error ${url}: ${err.message}`);
        return null;
    }
}

async function seedAgents() {
    console.log('\n📋 Registering agent personas...');
    let ok = 0;
    for (const agent of AGENTS) {
        const result = await postJson('/agents/register', {
            agent_id: agent.id,
            name: agent.name,
            capabilities: agent.capabilities,
            source: agent.source,
        });
        if (result) { ok++; console.log(`  ✓ ${agent.name}`); }
    }
    console.log(`  → ${ok}/${AGENTS.length} agents registered`);
}

async function seedMissingCapabilities() {
    console.log('\n🔧 Reporting missing capabilities...');
    let ok = 0;
    for (const cap of MISSING_CAPABILITIES) {
        const result = await postJson('/demand/events/missing-capability', {
            agent_id: cap.agentId,
            capability: cap.capability,
            context: cap.context,
            urgency: cap.urgency,
        });
        if (result) { ok++; console.log(`  ✓ [${cap.urgency}] ${cap.capability.slice(0, 60)}...`); }
    }
    console.log(`  → ${ok}/${MISSING_CAPABILITIES.length} capabilities reported`);
}

async function seedFriction() {
    console.log('\n⚡ Reporting friction points...');
    let ok = 0;
    for (const fp of FRICTION_POINTS) {
        const result = await postJson('/demand/events/friction', {
            agent_id: fp.agentId,
            task: fp.task,
            friction_points: fp.frictionPoints,
            time_cost: fp.timeCost,
        });
        if (result) { ok++; console.log(`  ✓ ${fp.task.slice(0, 60)}...`); }
    }
    console.log(`  → ${ok}/${FRICTION_POINTS.length} friction points reported`);
}

async function seedPatterns() {
    console.log('\n✨ Sharing workflow patterns...');
    let ok = 0;
    for (const pat of PATTERNS) {
        const result = await postJson('/demand/events/pattern', {
            agent_id: pat.agentId,
            name: pat.name,
            description: pat.description,
            steps: pat.steps,
            tags: pat.tags,
        });
        if (result) { ok++; console.log(`  ✓ ${pat.name}`); }
    }
    console.log(`  → ${ok}/${PATTERNS.length} patterns shared`);
}

async function verifyStats() {
    console.log('\n📊 Verifying Maxxeval stats...');
    try {
        const res = await fetch(`${MAXXEVAL_API}/stats`);
        const stats = await res.json();
        console.log('  Stats:', JSON.stringify(stats, null, 2));
        return stats;
    } catch (err: any) {
        console.error('  ✗ Could not fetch stats:', err.message);
        return null;
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Seeding Maxxeval with Focus Group Report Data');
    console.log(`  Target: ${MAXXEVAL_API}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Check API is alive
    try {
        const res = await fetch(`${MAXXEVAL_API}/stats`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const before = await res.json();
        console.log('\n✅ Maxxeval API is alive');
        console.log(`  Before: ${before.total_events} events, ${before.agents_registered} agents`);
    } catch (err: any) {
        console.error(`\n❌ Maxxeval API unreachable at ${MAXXEVAL_API}: ${err.message}`);
        process.exit(1);
    }

    await seedAgents();
    await seedMissingCapabilities();
    await seedFriction();
    await seedPatterns();

    const stats = await verifyStats();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Seeding Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n  Expected totals:`);
    console.log(`    Agents:       ${AGENTS.length}`);
    console.log(`    Capabilities: ${MISSING_CAPABILITIES.length}`);
    console.log(`    Friction:     ${FRICTION_POINTS.length}`);
    console.log(`    Patterns:     ${PATTERNS.length}`);
    console.log(`    Total Events: ${MISSING_CAPABILITIES.length + FRICTION_POINTS.length + PATTERNS.length}`);
    console.log(`\n  Next steps:`);
    console.log(`    1. Check dashboard: https://maxxeval.com/loop/`);
    console.log(`    2. Deploy to Vercel: git push origin main`);
    console.log(`    3. Import to local DB (after deploy):`);
    console.log(`       npx tsx scripts/seed-maxxeval.ts --import`);
    console.log(`    4. Or manually: curl -X POST https://agentcache.ai/api/needs/refresh`);
    console.log(`    5. View trends: curl https://agentcache.ai/api/needs/trends`);
    console.log(`    6. View evaluation: curl https://agentcache.ai/api/needs/evaluation`);

    // If --import flag, also push directly to AgentCache needs API
    if (process.argv.includes('--import')) {
        await directImport();
    }
}

/**
 * Direct import: push signals into AgentCache /api/needs/import
 * This bypasses Maxxeval read endpoints and seeds the local needs_signals table directly.
 */
async function directImport() {
    const agentcacheUrl = process.env.AGENTCACHE_URL || 'https://agentcache.ai';
    const adminToken = process.env.ADMIN_TOKEN || '';

    console.log(`\n📥 Direct import to ${agentcacheUrl}/api/needs/import...`);

    // Build signals array
    const signals = [
        ...MISSING_CAPABILITIES.map(cap => ({
            type: 'missing_capability',
            title: cap.capability,
            description: cap.context,
            score: cap.urgency === 'critical' ? 10 : cap.urgency === 'high' ? 7 : 3,
            raw: cap,
        })),
        ...FRICTION_POINTS.map(fp => ({
            type: 'friction',
            title: fp.task,
            description: fp.frictionPoints.join('; '),
            score: 5,
            raw: fp,
        })),
        ...PATTERNS.map(pat => ({
            type: 'pattern',
            title: pat.name,
            description: pat.description,
            score: 3,
            raw: pat,
        })),
    ];

    try {
        const res = await fetch(`${agentcacheUrl}/api/needs/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ signals }),
        });

        const result = await res.json();
        if (res.ok) {
            console.log(`  ✅ Imported: ${result.imported} signals, ${result.skipped} skipped`);
        } else {
            console.error(`  ✗ Import failed: ${JSON.stringify(result)}`);
        }
    } catch (err: any) {
        console.error(`  ✗ Import error: ${err.message}`);
        console.log(`\n  💡 If not deployed yet, deploy first, then run:`);
        console.log(`     ADMIN_TOKEN=<your-token> npx tsx scripts/seed-maxxeval.ts --import`);
    }
}

main().catch(console.error);
