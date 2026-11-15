# Governed Agent Execution: Market Landscape

Research checked 15 November 2026 against current official product, pricing, and developer pages. Product pages describe vendor capabilities and prices; they do not independently establish adoption, reliability, security outcomes, or market size. Composio's displayed catalog counts vary by product surface and page load, so use them as dated vendor claims rather than a fixed market denominator. See `EXECUTION_PRICING_VALIDATION.md` for the pricing comparison and validation gates.

## What the market is organizing around

Agent tool platforms cluster into three adjacent jobs:

1. **Tool access, governance, and integration breadth.** Composio sells distinct surfaces: its developer platform, team-facing “For You” app connections, Instant paid tools, and Firewall. Official pages currently claim 1,700+ apps/toolkits for Platform and For You, while the Instant landing page says 1,500+ tools. The detailed Instant catalog reports 87 apps and 2,805 tools, while its landing-page preview showed 73 apps during this check; these are dynamic, differently scoped counters. Instant uses provider accounts and a shared wallet for per-call charges, while connected customer accounts continue without Instant charges. Its Session API has no dollar-cap parameter and the prepaid balance check is asynchronous; Developer Platform Pro separately offers metered spend caps. The docs recommend application-side budgets and per-call approval when controlling each Session's spend. Firewall directly overlaps with policy enforcement: it checks tool requests/results and supports natural-language policies and prompt-injection defenses. For You Standard is $18/seat/month with 10,000 calls and $18 pooled credits per seat, SSO, and Firewall; the Developer Platform Pro plan is $29/month with monthly credits, and Firewall is a metered add-on there. These figures belong to different offers and should not be conflated. [Instant](https://composio.dev/instant) · [Instant catalog](https://composio.dev/pricing/for-you/instant-tools) · [Instant docs](https://docs.composio.dev/docs/instant-tools) · [Platform pricing](https://composio.dev/pricing/platform) · [Firewall docs](https://docs.composio.dev/docs/firewall) · [For You pricing](https://composio.dev/pricing/for-you)
2. **Enterprise gateway and API exposure.** Kong positions its AI Gateway around converting APIs to MCP tools, protecting upstream MCP traffic, access control, rate limits, and logs/metrics. AWS Bedrock AgentCore Gateway supports API/MCP targets, inbound and outbound authorization, and policy-backed access. [Kong MCP Gateway](https://developer.konghq.com/mcp/) · [AWS AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-prerequisites.html)
3. **Agent runtime and lifecycle.** AWS AgentCore includes more than tool routing: identity, runtime, memory, browser/code tools, and deployment controls. This competes for the platform layer, especially for teams standardized on AWS. [AgentCore tools](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html)

The strategic consequence: “more integrations” alone is an expensive and undifferentiated target. Generic policy hooks are no longer a defensible differentiation claim: Composio Firewall and enterprise gateways already advertise governance, while Composio documents application-side approvals for spending. AgentCache's candidate wedge is a portable, tenant-owned workflow record that binds context version, policy result, review, approval, provider outcome, and evidence across a company's existing systems. That is only a hypothesis until the live pilot proves it and buyers value the resulting evidence. The product should call evidence durable only after the run, review, and gate records persist beyond Redis; even then, tamper evidence and shared receipt migration remain open.

## Recommended market position

**AgentCache governs what an agent does across a workflow and leaves evidence a team can review.**

Lead with a workflow-level execution record and operator recovery path—policy decision, action, approval, review, provider result, and receipt—rather than claiming a large app catalog or generic AI Firewall superiority. Caching, memory, and knowledge support the execution layer; they should appear as capabilities inside that story, not three unrelated products.

Keep two use cases visible:

- **Project and media operations:** governed publish/send workflows with evidence and approvals, relevant to AgentCache’s audio/video and storage projects.
- **Enterprise operational automation:** policy-reviewed actions that cross tools and require clear accountability.

This is a positioning hypothesis, not validated customer demand. The first validation should be a complete workflow with one of the projects AgentCache serves; those projects are design partners, not independent paying customers.

## Product implications

- Keep the first catalog narrow and first-party. Establish reliable policy enforcement, failure records, and operator visibility before adding arbitrary MCP proxying or a broad connector marketplace.
- Treat every action as an authorization boundary. Discovery does not grant permission; check policy at invocation. Record allow/deny, actor, action, workflow/run, outcome, and timing while excluding credential values and sensitive payloads by default.
- Start with customer-owned AgentCache API credentials in the MCP client. Do not introduce AgentCache-held third-party credentials or a pooled wallet until credential delegation, revocation, provider terms, financial exposure, and a spending ceiling have a separately reviewed design.
- Measure activation by completed governed workflows, not catalog size: first tool call, successful end-to-end run, policy denial handled safely, approval completion, repeat use, and time to investigate a run.

## Competitive risks and open validation

- **Breadth gap:** Composio’s toolkits and managed access make onboarding broad integrations easier. AgentCache should not imply equivalent coverage until each integration is implemented and maintained.
- **Platform bundling:** Kong and AWS can bundle gateway capabilities into existing API-management or cloud estates. AgentCache needs to prove value in workflow-level context and evidence rather than compete on gateway infrastructure alone.
- **Trust burden and direct competition:** Governance claims require observable enforcement. Composio Firewall blocks selected tool calls or results and documents prompt-injection checks; its docs also describe human approval before an Instant tool call, while noting that its Session has no built-in dollar spend cap. Platform Pro does provide metered spend caps, so do not imply Composio lacks organization-level spend control. AgentCache's initial execution path supports a narrow Jetty storage-summary adapter, encrypted user-owned provider credentials, workflow review/gates, a redacted operator console, and invocation records. It does not yet proxy arbitrary customer MCP servers, offer OAuth setup, or prove cross-system evidence integrity; the pilot is a constrained workflow, not a general connector marketplace or established Firewall alternative. [Composio Firewall](https://docs.composio.dev/docs/firewall) · [Instant approvals and budget controls](https://docs.composio.dev/docs/instant-tools) · [Platform spend controls](https://composio.dev/pricing/platform)
- **Evidence durability:** Invocation rows now link the context version, run receipt, and the specific approval gate/receipt when one was required; an append-only decision ledger persists run/review/phase/gate outcomes with bounded, secret/PII-pattern-redacted summaries and findings. Context packs and active run state still use Redis with a 90-day retention setting. The ledger excludes full run payloads. Keep retention claims scoped and persist the remaining chain before selling regulated, long-retention audit use cases.
- **Budget-control distinction:** Composio Instant's Session API has no dollar spend-cap parameter; its prepaid balance checks are asynchronous. Composio Developer Platform Pro separately provides plan-level spend caps for metered usage. AgentCache now enforces an atomic, time-bounded *action-count* cap before provider traffic, but it does not estimate dollars, price individual calls, or bound provider pass-through charges. This prevents unbounded action volume for the configured adapter; it is not a financial spend cap and is not yet a competitive advantage over all Composio surfaces. Cost-aware preflight requires trusted upper bounds for each adapter and must remain a separate design and validation step. [Composio Instant spending docs](https://docs.composio.dev/docs/instant-tools) · [Composio Platform pricing](https://composio.dev/pricing/platform)
- **Price compression:** Composio's Developer Platform lists 100K free own-app/API-key/MCP calls per month and $0.0003/call on Pro after included usage; Arcade lists 2,000 free tool calls and a $25/month Team fee plus $0.01/call. Composio Firewall is a $0.50 / 1M token metered add-on on Developer Platform Pro and included on Developer Platform Enterprise and For You Standard. Packaging differs, but these prices make a raw-call-only offer hard to defend. [Composio Platform pricing](https://composio.dev/pricing/platform) · [Composio For You pricing](https://composio.dev/pricing/for-you) · [Arcade pricing](https://www.arcade.dev/pricing/)
- **Observability-price interpretation:** LangSmith's $1/LSU figure is for LangSmith Engine work (trace analysis/fix suggestions), not a unit price for retaining ordinary traces. Do not use it as a direct audit-retention benchmark. [LangSmith pricing](https://www.langchain.com/pricing)
- **Demand uncertainty:** Test workflow value and willingness to adopt with external buyers before changing pricing or committing to a larger catalog. The project teams remain design partners, not independent paying customers.

## Sources

- Composio Instant product page: https://composio.dev/instant
- Composio Instant catalog and per-tool pricing: https://composio.dev/pricing/for-you/instant-tools
- Composio Developer Platform pricing: https://composio.dev/pricing/platform
- Composio For You pricing: https://composio.dev/pricing/for-you
- Composio Instant developer docs: https://docs.composio.dev/docs/instant-tools
- Composio Firewall product and developer docs: https://composio.dev/firewall · https://docs.composio.dev/docs/firewall
- Kong MCP Gateway documentation: https://developer.konghq.com/mcp/
- Kong AI MCP Server governance and audit documentation: https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/
- AWS AgentCore Gateway prerequisites: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-prerequisites.html
- AWS AgentCore tools: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html
