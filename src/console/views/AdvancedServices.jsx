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
    const [form, setForm] = useState(initialForm);
    const [blueprint, setBlueprint] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const selected = useMemo(
        () => services.find((service) => service.id === selectedId) || services[0],
        [services, selectedId],
    );

    const submitBlueprint = async (event, attempt = 0) => {
        event?.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/advanced-services/blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    objective: form.objective,
                    sector: form.sector,
                    autonomy: form.autonomy,
                    riskTolerance: form.riskTolerance,
                    systems: splitList(form.systems),
                    painPoints: splitList(form.painPoints),
                    regulated: form.regulated,
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

    useEffect(() => {
        let mounted = true;

        fetch('/api/advanced-services/catalog')
            .then((res) => res.json())
            .then((data) => {
                if (mounted && Array.isArray(data.services)) {
                    setServices(data.services);
                }
            })
            .catch(() => null);

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
                        Package AgentCache into buyer-ready lanes: memory substrate, reliability controls, governed decisions, sandbox rehearsal, compliance, and forensics.
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
                    <div className="grid gap-3 md:grid-cols-3">
                        {services.slice(0, 6).map((service) => (
                            <button
                                key={service.id}
                                type="button"
                                onClick={() => setSelectedId(service.id)}
                                className={`rounded-lg border p-4 text-left transition ${selectedId === service.id
                                    ? 'border-cyan-300/50 bg-cyan-300/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-mono text-xs text-cyan-200">#{service.rank}</span>
                                    <span className={`rounded-md border px-2 py-1 text-[11px] ${badgeClass(service.maturity)}`}>{service.maturity}</span>
                                </div>
                                <h3 className="mt-3 min-h-[44px] font-['Rajdhani'] text-xl font-semibold leading-5 text-white">{service.name}</h3>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--hud-text-dim)]">{service.outcome}</p>
                            </button>
                        ))}
                    </div>

                    <section className="glass rounded-lg p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-cyan-200">
                                    <BrainCircuit size={19} />
                                    <span className="text-xs uppercase tracking-wide">{selected?.category}</span>
                                </div>
                                <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white">{selected?.name}</h2>
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
