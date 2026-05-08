import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgeCheck,
    BrainCircuit,
    BriefcaseBusiness,
    CheckCircle2,
    ClipboardList,
    GitBranch,
    RefreshCw,
    Route,
    Scale,
    Send,
    ShieldCheck,
    Sparkles,
    Workflow,
} from 'lucide-react';

const fallbackServices = [
    {
        id: 'workflow-memory-fabric',
        rank: 2,
        name: 'Workflow Memory Fabric',
        category: 'memory',
        buyer: 'AI-native teams',
        outcome: 'Durable context across agents, tools, people, and approvals.',
        maturity: 'available',
        capabilities: ['task-state memory', 'decision recall', 'namespace policy'],
        endpoints: [{ label: 'Recall memory', method: 'POST', path: '/api/memory/recall' }],
    },
    {
        id: 'agent-reliability-mesh',
        rank: 1,
        name: 'Agent Reliability Mesh',
        category: 'reliability',
        buyer: 'Production agent teams',
        outcome: 'Trust scores, drift detection, intervention posture, and receipts.',
        maturity: 'available',
        capabilities: ['drift scoring', 'shared receipts', 'kill-switch posture'],
        endpoints: [{ label: 'Reliability posture', method: 'GET', path: '/api/observability/reliability-mesh' }],
    },
    {
        id: 'decisionrail',
        rank: 3,
        name: 'DecisionRail',
        category: 'governance',
        buyer: 'Finance, procurement, operations',
        outcome: 'Bounded decisions with approvals, budgets, and execution receipts.',
        maturity: 'available',
        capabilities: ['context packs', 'review roles', 'approval gates'],
        endpoints: [{ label: 'Create context pack', method: 'POST', path: '/api/execution/context-packs' }],
    },
    {
        id: 'media-workflow-reliability',
        rank: 4,
        name: 'Media Workflow Reliability',
        category: 'media',
        buyer: 'Streaming and media teams',
        outcome: 'Cache-aware planning, rendition validation, and playback-ready evidence for video workflows.',
        maturity: 'available',
        capabilities: ['transcode planning', 'profile validation', 'queue visibility'],
        endpoints: [{ label: 'Recent media jobs', method: 'GET', path: '/api/transcode/jobs' }],
    },
];

const initialForm = {
    objective: 'Deploy a finance procurement agent that can triage vendor requests, recall prior decisions, recommend approvals, and never execute payments without review.',
    sector: 'finance',
    autonomy: 'copilot',
    riskTolerance: 'low',
    systems: 'Slack, GitHub, Salesforce, internal procurement API',
    painPoints: 'handoffs lose context, approvals are slow, leaders do not trust autonomous actions, audit evidence is scattered',
    regulated: true,
};

const outcomePresets = [
    {
        id: 'reduce-llm-cost',
        title: 'Reduce LLM cost',
        serviceId: 'workflow-memory-fabric',
        icon: Sparkles,
        form: {
            objective: 'Reduce LLM spend for support and research agents by reusing safe answers, tool results, and memory without serving stale responses.',
            sector: 'saas',
            autonomy: 'copilot',
            riskTolerance: 'medium',
            systems: 'OpenAI, Anthropic, LangChain, support desk, product docs',
            painPoints: 'duplicate prompts are expensive, cache hits are hard to trust, freshness rules are unclear',
            regulated: false,
        },
    },
    {
        id: 'agent-memory',
        title: 'Give agents memory',
        serviceId: 'workflow-memory-fabric',
        icon: BrainCircuit,
        form: {
            objective: 'Give agents durable workspace memory so they can recall prior decisions, constraints, handoffs, and tool outcomes across sessions.',
            sector: 'operations',
            autonomy: 'copilot',
            riskTolerance: 'medium',
            systems: 'Slack, Linear, GitHub, Google Drive, internal tools',
            painPoints: 'agents repeat discovery, handoffs lose context, teams cannot inspect what memory influenced an answer',
            regulated: false,
        },
    },
    {
        id: 'monitor-drift',
        title: 'Monitor drift',
        serviceId: 'agent-reliability-mesh',
        icon: GitBranch,
        form: {
            objective: 'Monitor production agent workflows for execution drift, unexpected phase movement, and rising intervention risk.',
            sector: 'enterprise-ai',
            autonomy: 'copilot',
            riskTolerance: 'low',
            systems: 'agent runtime, telemetry stream, ticketing system, policy service',
            painPoints: 'operators cannot tell when agents are drifting, incidents lack replayable evidence, intervention thresholds are fuzzy',
            regulated: true,
        },
    },
    {
        id: 'govern-approvals',
        title: 'Govern approvals',
        serviceId: 'decisionrail',
        icon: Scale,
        form: {
            objective: 'Govern recommendations so agents can prepare decisions, but final external actions require reviewer roles, approval gates, and receipts.',
            sector: 'finance',
            autonomy: 'copilot',
            riskTolerance: 'low',
            systems: 'Slack, Salesforce, procurement API, ERP, audit archive',
            painPoints: 'approvals are slow, reviewers lack context, payment and procurement actions need audit evidence',
            regulated: true,
        },
    },
    {
        id: 'ship-media-workflows',
        title: 'Ship media workflows',
        serviceId: 'media-workflow-reliability',
        icon: Workflow,
        form: {
            objective: 'Ship reliable media workflows that plan transcodes, validate HLS outputs, reuse cached renditions, and expose queue status before publishing.',
            sector: 'media',
            autonomy: 'copilot',
            riskTolerance: 'medium',
            systems: 'Lyve S3, FFmpeg worker, CDN stream route, Roku channel, web player',
            painPoints: 'encoding jobs are opaque, manifests fail late, duplicate renditions waste compute, playback readiness is hard to prove',
            regulated: false,
        },
    },
];

const fallbackSignals = {
    outcomes: Object.fromEntries(outcomePresets.map((preset) => [
        preset.id,
        {
            status: 'loading',
            serviceId: preset.serviceId,
            summary: 'Checking local runtime signals.',
            evidence: [],
            sources: [],
            gaps: [],
        },
    ])),
};

function splitList(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function badgeClass(value) {
    if (value === 'available' || value === 'monitor') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    if (value === 'review' || value === 'beta' || value === 'copilot') return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    if (value === 'block' || value === 'autonomous') return 'border-rose-400/30 bg-rose-500/10 text-rose-200';
    return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
}

function statusClass(value) {
    if (value === 'live') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    if (value === 'partial') return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    if (value === 'loading') return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
    return 'border-white/10 bg-white/[0.04] text-slate-200';
}

function formatMetricValue(metric) {
    if (typeof metric?.value === 'number') {
        if (metric.unit === '%') return `${Number(metric.value).toFixed(metric.value % 1 ? 1 : 0)}%`;
        if (metric.unit === 'USD') return `$${Number(metric.value).toFixed(2)}`;
        return Number(metric.value).toLocaleString();
    }
    return metric?.value || '0';
}

const Field = ({ label, children }) => (
    <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">{label}</span>
        {children}
    </label>
);

const Select = ({ value, onChange, children }) => (
    <select
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
    >
        {children}
    </select>
);

const TextInput = (props) => (
    <input
        {...props}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
    />
);

const AdvancedServices = () => {
    const [services, setServices] = useState(fallbackServices);
    const [selectedId, setSelectedId] = useState('agent-reliability-mesh');
    const [activeOutcomeId, setActiveOutcomeId] = useState('monitor-drift');
    const [signals, setSignals] = useState(fallbackSignals);
    const [form, setForm] = useState(initialForm);
    const [blueprint, setBlueprint] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const selected = useMemo(
        () => services.find((service) => service.id === selectedId) || services[0],
        [services, selectedId],
    );

    const activeOutcome = useMemo(
        () => outcomePresets.find((outcome) => outcome.id === activeOutcomeId) || outcomePresets[2],
        [activeOutcomeId],
    );

    const activeSignal = signals?.outcomes?.[activeOutcomeId] || fallbackSignals.outcomes[activeOutcomeId];

    const submitBlueprint = async (event, attempt = 0, overrideForm = null) => {
        event?.preventDefault();
        setLoading(true);
        setError('');
        const sourceForm = overrideForm || form;

        try {
            const res = await fetch('/api/advanced-services/blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    objective: sourceForm.objective,
                    sector: sourceForm.sector,
                    autonomy: sourceForm.autonomy,
                    riskTolerance: sourceForm.riskTolerance,
                    systems: splitList(sourceForm.systems),
                    painPoints: splitList(sourceForm.painPoints),
                    regulated: sourceForm.regulated,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to build blueprint.');
            setBlueprint(data.blueprint);
        } catch (err) {
            setError(err.message);
            if (!event && attempt < 2) {
                setTimeout(() => submitBlueprint(undefined, attempt + 1), 750 * (attempt + 1));
            }
        } finally {
            setLoading(false);
        }
    };

    const applyOutcome = (outcome) => {
        const nextForm = { ...form, ...outcome.form };
        setActiveOutcomeId(outcome.id);
        setSelectedId(outcome.serviceId);
        setForm(nextForm);
        setBlueprint(null);
        submitBlueprint(undefined, 0, nextForm);
    };

    useEffect(() => {
        let mounted = true;

        Promise.allSettled([
            fetch('/api/advanced-services/catalog').then((res) => res.json()),
            fetch('/api/advanced-services/signals').then((res) => res.json()),
        ]).then(([catalogResult, signalResult]) => {
            if (!mounted) return;
            if (catalogResult.status === 'fulfilled' && Array.isArray(catalogResult.value.services)) {
                setServices(catalogResult.value.services);
            }
            if (signalResult.status === 'fulfilled' && signalResult.value?.outcomes) {
                setSignals(signalResult.value);
            }
        }).catch(() => null);

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        submitBlueprint();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-3 text-cyan-200">
                        <BriefcaseBusiness size={28} />
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--hud-text-dim)]">Enterprise Demand Control Plane</span>
                    </div>
                    <h1 className="mt-3 font-['Rajdhani'] text-4xl font-bold tracking-wide text-white">Advanced Services</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--hud-text-dim)]">
                        Start from the reliability outcome a buyer cares about, then map the service bundle, evidence, and first production lane.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={submitBlueprint}
                    disabled={loading}
                    className="btn-secondary inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                >
                    <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                    Rebuild
                </button>
            </section>

            {error && (
                <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={17} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <section className="glass rounded-lg p-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">Outcome first</div>
                        <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white">What are you trying to make reliable?</h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-[var(--hud-text-dim)]">
                        The badges below come from current AgentCache routes. Live means aggregate data is accessible now; partial means the APIs exist and need governed workflow traffic.
                    </p>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-5">
                    {outcomePresets.map((outcome) => {
                        const Icon = outcome.icon;
                        const signal = signals?.outcomes?.[outcome.id] || fallbackSignals.outcomes[outcome.id];
                        return (
                            <button
                                key={outcome.id}
                                type="button"
                                onClick={() => applyOutcome(outcome)}
                                className={`flex min-h-[210px] flex-col rounded-lg border p-4 text-left transition ${activeOutcomeId === outcome.id
                                    ? 'border-cyan-300/50 bg-cyan-300/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                                        <Icon size={20} />
                                    </span>
                                    <span className={`rounded-md border px-2 py-1 text-[11px] uppercase ${statusClass(signal?.status)}`}>
                                        {signal?.status || 'loading'}
                                    </span>
                                </div>
                                <h3 className="mt-4 font-['Rajdhani'] text-xl font-semibold leading-6 text-white">{outcome.title}</h3>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--hud-text-dim)]">{signal?.summary}</p>
                                <div className="mt-auto pt-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {(signal?.evidence || []).slice(0, 4).map((item) => (
                                            <div key={item.label} className="rounded-md border border-white/10 bg-black/20 px-2 py-2">
                                                <div className="truncate text-[10px] uppercase tracking-wide text-[var(--hud-text-dim)]">{item.label}</div>
                                                <div className="mt-1 truncate font-mono text-sm text-white">{formatMetricValue(item)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.65fr]">
                <form onSubmit={submitBlueprint} className="glass rounded-lg p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Service Intake</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">Customer objective, risk, systems, and buying pain.</p>
                        </div>
                        <Sparkles size={20} className="text-cyan-200" />
                    </div>

                    <div className="mt-5 space-y-4">
                        <Field label="Objective">
                            <textarea
                                value={form.objective}
                                onChange={(event) => setForm({ ...form, objective: event.target.value })}
                                rows={6}
                                className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                            />
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Sector">
                                <TextInput
                                    value={form.sector}
                                    onChange={(event) => setForm({ ...form, sector: event.target.value })}
                                    placeholder="finance"
                                />
                            </Field>
                            <Field label="Autonomy">
                                <Select
                                    value={form.autonomy}
                                    onChange={(event) => setForm({ ...form, autonomy: event.target.value })}
                                >
                                    <option value="shadow">Shadow</option>
                                    <option value="copilot">Copilot</option>
                                    <option value="autonomous">Autonomous</option>
                                </Select>
                            </Field>
                            <Field label="Risk">
                                <Select
                                    value={form.riskTolerance}
                                    onChange={(event) => setForm({ ...form, riskTolerance: event.target.value })}
                                >
                                    <option value="low">Low tolerance</option>
                                    <option value="medium">Medium tolerance</option>
                                    <option value="high">High tolerance</option>
                                </Select>
                            </Field>
                            <label className="flex min-h-[46px] items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white">
                                <input
                                    type="checkbox"
                                    checked={form.regulated}
                                    onChange={(event) => setForm({ ...form, regulated: event.target.checked })}
                                    className="h-4 w-4 accent-cyan-300"
                                />
                                Regulated workflow
                            </label>
                        </div>

                        <Field label="Systems">
                            <TextInput
                                value={form.systems}
                                onChange={(event) => setForm({ ...form, systems: event.target.value })}
                            />
                        </Field>

                        <Field label="Pain Points">
                            <textarea
                                value={form.painPoints}
                                onChange={(event) => setForm({ ...form, painPoints: event.target.value })}
                                rows={4}
                                className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                            />
                        </Field>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm"
                        >
                            <Send size={17} />
                            Build Blueprint
                        </button>
                    </div>
                </form>

                <div className="space-y-6">
                    <section className="glass rounded-lg p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-cyan-200">
                                    <ShieldCheck size={19} />
                                    <span className="text-xs uppercase tracking-wide">{activeOutcome.title}</span>
                                </div>
                                <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white">Accessible Data Points</h2>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--hud-text-dim)]">{activeSignal?.summary}</p>
                            </div>
                            <span className={`rounded-md border px-2 py-1 text-xs uppercase ${statusClass(activeSignal?.status)}`}>{activeSignal?.status || 'loading'}</span>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {(activeSignal?.evidence || []).map((item) => (
                                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--hud-text-dim)]">{item.label}</div>
                                    <div className="mt-2 font-mono text-lg text-white">{formatMetricValue(item)}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Sources</h3>
                                <div className="mt-3 space-y-2">
                                    {(activeSignal?.sources || []).map((source) => (
                                        <div key={`${source.method}-${source.path}`} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 text-sm last:border-b-0">
                                            <span className="text-slate-300">{source.fields?.slice(0, 2).join(', ') || 'runtime fields'}</span>
                                            <code className="rounded bg-white/10 px-2 py-1 text-xs text-cyan-100">{source.method} {source.path}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Next Instrumentation</h3>
                                <div className="mt-3 space-y-2">
                                    {(activeSignal?.gaps?.length ? activeSignal.gaps : ['no immediate gaps']).map((gap) => (
                                        <div key={gap} className="flex items-center gap-2 text-sm text-slate-300">
                                            <CheckCircle2 size={15} className={gap === 'no immediate gaps' ? 'text-emerald-300' : 'text-amber-300'} />
                                            <span>{gap}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="glass rounded-lg p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-cyan-200">
                                    <BrainCircuit size={19} />
                                    <span className="text-xs uppercase tracking-wide">{selected?.category}</span>
                                </div>
                                <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white">Selected Control Plane</h2>
                                <div className="mt-1 text-sm font-semibold text-cyan-100">{selected?.name}</div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--hud-text-dim)]">{selected?.outcome}</p>
                            </div>
                            <span className={`rounded-md border px-2 py-1 text-xs ${badgeClass(selected?.maturity)}`}>{selected?.maturity}</span>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Capabilities</h3>
                                <div className="mt-3 grid gap-2">
                                    {(selected?.capabilities || []).map((capability) => (
                                        <div key={capability} className="flex items-center gap-2 text-sm text-slate-300">
                                            <CheckCircle2 size={15} className="text-emerald-300" />
                                            <span>{capability}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Endpoints</h3>
                                <div className="mt-3 space-y-2">
                                    {(selected?.endpoints || []).map((endpoint) => (
                                        <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 text-sm last:border-b-0">
                                            <span className="text-slate-300">{endpoint.label}</span>
                                            <code className="rounded bg-white/10 px-2 py-1 text-xs text-cyan-100">{endpoint.method} {endpoint.path}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </section>

            {blueprint && (
                <>
                    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="glass rounded-lg p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-200">
                                        <ClipboardList size={19} />
                                        <span className="text-xs uppercase tracking-wide">Blueprint {blueprint.blueprintId}</span>
                                    </div>
                                    <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white">Recommended Bundle</h2>
                                    <p className="mt-2 text-sm leading-6 text-[var(--hud-text-dim)]">{blueprint.summary}</p>
                                </div>
                                <span className={`rounded-md border px-2 py-1 text-xs ${badgeClass(blueprint.autonomy)}`}>{blueprint.autonomy}</span>
                            </div>

                            <div className="mt-5 space-y-3">
                                {blueprint.recommendedBundle.map((item) => (
                                    <div key={item.service.id} className="grid gap-3 border-b border-white/10 pb-3 last:border-b-0 md:grid-cols-[54px_1fr_80px]">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 font-mono text-cyan-100">
                                            {item.priority}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">{item.service.name}</h3>
                                            <p className="mt-1 text-sm leading-5 text-[var(--hud-text-dim)]">{item.reason}</p>
                                            <p className="mt-2 text-xs uppercase tracking-wide text-cyan-200">{item.firstMilestone}</p>
                                        </div>
                                        <div className="self-start rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
                                            <div className="font-mono text-lg text-white">{item.fitScore}</div>
                                            <div className="text-[10px] uppercase tracking-wide text-[var(--hud-text-dim)]">fit</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass rounded-lg p-5">
                            <div className="flex items-center gap-2 text-cyan-200">
                                <Scale size={19} />
                                <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Policy Pack</h2>
                            </div>
                            <div className="mt-4 space-y-3">
                                {blueprint.policyPack.map((control) => (
                                    <div key={control.control} className="border-b border-white/10 pb-3 last:border-b-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold text-white">{control.control}</span>
                                            <span className={`rounded-md border px-2 py-1 text-[11px] ${badgeClass(control.mode)}`}>{control.mode}</span>
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-[var(--hud-text-dim)]">{control.rationale}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                        <div className="glass rounded-lg p-5">
                            <div className="flex items-center gap-2 text-cyan-200">
                                <GitBranch size={19} />
                                <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Architecture</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                {blueprint.architecture.map((layer) => (
                                    <div key={layer.layer} className="grid gap-3 border-b border-white/10 pb-4 last:border-b-0 md:grid-cols-[130px_1fr]">
                                        <div>
                                            <div className="text-sm font-semibold text-white">{layer.layer}</div>
                                            <div className="mt-1 text-xs uppercase tracking-wide text-cyan-200">{layer.owner}</div>
                                        </div>
                                        <p className="text-sm leading-6 text-[var(--hud-text-dim)]">{layer.responsibility}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass rounded-lg p-5">
                            <div className="flex items-center gap-2 text-cyan-200">
                                <Route size={19} />
                                <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Starter Requests</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                {blueprint.starterRequests.map((request) => (
                                    <div key={`${request.method}-${request.path}`} className="border-b border-white/10 pb-4 last:border-b-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold text-white">{request.name}</span>
                                            <code className="rounded bg-white/10 px-2 py-1 text-xs text-cyan-100">{request.method} {request.path}</code>
                                        </div>
                                        {request.body && (
                                            <pre className="mt-3 max-h-52 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                                                {JSON.stringify(request.body, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="glass rounded-lg p-5">
                        <div className="flex items-center gap-2 text-cyan-200">
                            <Workflow size={19} />
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">90-Day Build Plan</h2>
                        </div>
                        <div className="mt-5 grid gap-4 lg:grid-cols-4">
                            {blueprint.implementationPlan.map((phase) => (
                                <div key={phase.phase} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <div className="text-xs uppercase tracking-wide text-cyan-200">{phase.duration}</div>
                                    <h3 className="mt-2 min-h-[28px] font-semibold text-white">{phase.phase}</h3>
                                    <p className="mt-2 text-sm leading-5 text-[var(--hud-text-dim)]">{phase.goal}</p>
                                    <div className="mt-4 space-y-2">
                                        {phase.deliverables.slice(0, 3).map((item) => (
                                            <div key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
                                                <BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default AdvancedServices;
