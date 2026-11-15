import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, CircleAlert, KeyRound, Play, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';

const KEY_SLOT = 'agentcache_execution_api_key';

async function api(path, key, options = {}) {
    const response = await fetch(`/api/execution${path}`, {
        ...options,
        headers: { 'X-API-Key': key, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = data.code;
        error.retryWithNewKey = data.retryWithNewKey === true;
        throw error;
    }
    return data;
}

export default function AgentExecution() {
    const [key, setKey] = useState(() => sessionStorage.getItem(KEY_SLOT) || '');
    const [keyDraft, setKeyDraft] = useState(() => sessionStorage.getItem(KEY_SLOT) || '');
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [tools, setTools] = useState([]);
    const [connections, setConnections] = useState([]);
    const [recentInvocations, setRecentInvocations] = useState([]);
    const [recentDecisionEvents, setRecentDecisionEvents] = useState([]);
    const [invocationHistoryError, setInvocationHistoryError] = useState('');
    const [executionUsage, setExecutionUsage] = useState(null);
    const [executionUsageError, setExecutionUsageError] = useState('');
    const [connectionAccessError, setConnectionAccessError] = useState('');
    const [gateApproverKey, setGateApproverKey] = useState('');
    const [gateApproverKeyVisible, setGateApproverKeyVisible] = useState(false);
    const [provider, setProvider] = useState('jettythunder');
    const [connectionName, setConnectionName] = useState('');
    const [connectionScopes, setConnectionScopes] = useState('storage.read');
    const [connectionCredentials, setConnectionCredentials] = useState('');
    const [showConnectionCredentials, setShowConnectionCredentials] = useState(false);
    const [packs, setPacks] = useState([]);
    const [runs, setRuns] = useState([]);
    const [packId, setPackId] = useState('');
    const [packName, setPackName] = useState('My governed workflow');
    const [packObjective, setPackObjective] = useState('Review a requested action, collect evidence, and pause for approval before external publication.');
    const [reviewVerdict, setReviewVerdict] = useState('');
    const [reviewSummary, setReviewSummary] = useState('');
    const [reviewerKey, setReviewerKey] = useState('');
    const [runDetails, setRunDetails] = useState(null);
    const [invocationHistoryAvailable, setInvocationHistoryAvailable] = useState(true);
    const [action, setAction] = useState('manual');
    const [requireHumanApproval, setRequireHumanApproval] = useState(true);
    const [payload, setPayload] = useState('{\n  "objective": "Review the request and prepare evidence."\n}');
    const workspaceGeneration = useRef(0);

    const refresh = useCallback(async (apiKey) => {
        const generation = workspaceGeneration.current;
        setBusy(true);
        setError('');
        try {
            const [toolResult, packResult, runResult] = await Promise.all([
                api('/tools', apiKey), api('/context-packs?limit=50', apiKey), api('/runs?limit=50', apiKey),
            ]);
            if (generation !== workspaceGeneration.current) return;
            setTools(toolResult.tools || []);
            setPacks(packResult.packs || []);
            setRuns(runResult.runs || []);
            try {
                const decisionResult = await api('/decision-events?limit=50', apiKey);
                if (generation !== workspaceGeneration.current) return;
                setRecentDecisionEvents(decisionResult.decisionEvents || []);
            } catch {
                if (generation !== workspaceGeneration.current) return;
                setRecentDecisionEvents([]);
            }
            try {
                const invocationResult = await api('/invocations?limit=50', apiKey);
                if (generation !== workspaceGeneration.current) return;
                setRecentInvocations(invocationResult.invocations || []);
                setInvocationHistoryError('');
            } catch (historyError) {
                if (generation !== workspaceGeneration.current) return;
                setRecentInvocations([]);
                setInvocationHistoryError(historyError.message || 'Durable invocation history is unavailable.');
            }
            try {
                const usageResult = await api('/usage', apiKey);
                if (generation !== workspaceGeneration.current) return;
                setExecutionUsage(usageResult.usage || null);
                setExecutionUsageError('');
            } catch (usageError) {
                if (generation !== workspaceGeneration.current) return;
                setExecutionUsage(null);
                setExecutionUsageError(usageError.message || 'Action budget status is unavailable.');
            }
            try {
                const connectionResult = await api('/connections?limit=50', apiKey);
                if (generation !== workspaceGeneration.current) return;
                setConnections(connectionResult.connections || []);
                setConnectionAccessError('');
            } catch (connectionError) {
                if (generation !== workspaceGeneration.current) return;
                setConnections([]);
                setConnectionAccessError(connectionError.message || 'Account connections are unavailable for this API key.');
            }
            setPackId((current) => current || packResult.packs?.[0]?.id || '');
            setConnected(true);
        } catch (err) {
            if (generation !== workspaceGeneration.current) return;
            setConnected(false);
            setError(err.message || 'Could not connect to AgentCache.');
        } finally { if (generation === workspaceGeneration.current) setBusy(false); }
    }, []);

    useEffect(() => { if (key) refresh(key); }, [key, refresh]);

    const connect = async (event) => {
        event.preventDefault();
        const candidate = keyDraft.trim();
        if (!candidate) return setError('Enter an AgentCache API key.');
        setBusy(true);
        setError('');
        try {
            const result = await api('/tools', candidate);
            sessionStorage.setItem(KEY_SLOT, candidate);
            setKey(candidate);
            setTools(result.tools || []);
            setConnected(false);
            setMessage('Connected. The key is stored in this tab only.');
            if (candidate === key) await refresh(candidate);
        } catch (err) {
            setConnected(false);
            setError(err.message || 'Could not connect to AgentCache.');
        } finally { setBusy(false); }
    };

    const disconnect = () => {
        workspaceGeneration.current += 1;
        sessionStorage.removeItem(KEY_SLOT);
        setKey(''); setKeyDraft(''); setConnected(false);
        setError('');
        setTools([]); setPacks([]); setRuns([]); setPackId('');
        setConnections([]); setConnectionCredentials(''); setShowConnectionCredentials(false);
        setRecentInvocations([]); setRecentDecisionEvents([]); setExecutionUsage(null);
        setInvocationHistoryError(''); setExecutionUsageError(''); setConnectionAccessError('');
        setRunDetails(null); setInvocationHistoryAvailable(true);
        setReviewerKey(''); setReviewSummary(''); setReviewVerdict('');
        setGateApproverKey(''); setGateApproverKeyVisible(false);
        setPackName('My governed workflow');
        setPackObjective('Review a requested action, collect evidence, and pause for approval before external publication.');
        setAction('manual'); setRequireHumanApproval(true);
        setPayload('{\n  "objective": "Review the request and prepare evidence."\n}');
        setMessage('Disconnected. The key and workspace data were cleared from this tab.');
    };

    const startRun = async (event) => {
        event.preventDefault();
        setError(''); setMessage('');
        if (!packId) return setError('Choose a context pack before starting a run.');
        let runInput;
        try {
            runInput = JSON.parse(payload || '{}');
            if (!runInput || typeof runInput !== 'object' || Array.isArray(runInput)) throw new Error();
        } catch { return setError('Run input must be a JSON object.'); }
        setBusy(true);
        try {
            const result = await api('/runs', key, { method: 'POST', body: JSON.stringify({ contextPackId: packId, inputPayload: runInput, finalAction: action, requireHumanGate: requireHumanApproval, trigger: 'agent-execution-console' }) });
            setMessage(result.gate ? 'Run started and paused for human approval.' : 'Run started and recorded.');
            await refresh(key);
        } catch (err) { setError(err.message || 'Could not start the run.'); }
        finally { setBusy(false); }
    };

    const createPack = async (event) => {
        event.preventDefault();
        setError(''); setMessage(''); setBusy(true);
        try {
            const result = await api('/context-packs', key, { method: 'POST', body: JSON.stringify({ name: packName.trim(), objective: packObjective.trim(), workflowTemplate: 'policy_review', reviewerRoles: ['critical'], tools: ['policy-check', 'execution-history'] }) });
            setPackId(result.pack.id);
            setMessage('Context pack created. You can start its first governed run now.');
            await refresh(key);
            setPackId(result.pack.id);
        } catch (err) { setError(err.message || 'Could not create the context pack.'); }
        finally { setBusy(false); }
    };

    const createJettyPilotPack = async () => {
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await api('/context-packs', key, { method: 'POST', body: JSON.stringify({
                name: 'JettyThunder storage review',
                objective: 'Review aggregate storage quota and file count using read-only access.',
                sectorHint: 'general', workflowTemplate: 'policy_review', reviewerRoles: [], workflowPhases: ['draft', 'gate', 'finalize'],
                tools: ['jetty.storage.summary'],
                policyProfile: { allowedActions: ['jetty.storage.summary'], deniedActions: ['file.read', 'file.download', 'file.delete', 'file.write'] },
            }) });
            setPackId(result.pack.id);
            setMessage('Read-only JettyThunder workflow created. Start a run and approve its gate before reading the storage summary.');
            await refresh(key);
            setPackId(result.pack.id);
        } catch (err) { setError(err.message || 'Could not create the JettyThunder workflow.'); }
        finally { setBusy(false); }
    };

    const inspectRun = async (id) => {
        const generation = workspaceGeneration.current;
        setError(''); setRunDetails(null); setReviewerKey(''); setInvocationHistoryAvailable(true);
        try {
            const details = await api(`/runs/${encodeURIComponent(id)}`, key);
            if (generation !== workspaceGeneration.current) return;
            try {
                const history = await api(`/runs/${encodeURIComponent(id)}/invocations?limit=50`, key);
                if (generation !== workspaceGeneration.current) return;
                setRunDetails({ ...details, durableInvocations: history.invocations || [] });
            } catch {
                if (generation !== workspaceGeneration.current) return;
                setInvocationHistoryAvailable(false);
                setRunDetails(details);
            }
        }
        catch (err) { if (generation === workspaceGeneration.current) setError(err.message || 'Could not load run details.'); }
    };

    const advanceRun = async (phase) => {
        if (!runDetails?.run?.id || !phase) return;
        setBusy(true); setError(''); setMessage('');
        try {
            await api(`/runs/${encodeURIComponent(runDetails.run.id)}/phase`, key, {
                method: 'POST', body: JSON.stringify({ phase }),
            });
            setMessage(`Workflow moved to ${phase}.`);
            await inspectRun(runDetails.run.id);
            await refresh(key);
        } catch (err) { setError(err.message || 'Could not advance the workflow.'); }
        finally { setBusy(false); }
    };

    const submitReview = async (reviewerRole) => {
        if (!runDetails?.run?.id) return;
        const reviewApiKey = reviewerKey.trim();
        if (!reviewApiKey) return setError('Enter a separate API key owned by the reviewer who inspected this run.');
        if (reviewApiKey === key) return setError('The reviewer must use a different member API key from the run creator.');
        if (!reviewVerdict) return setError('Choose a review verdict before recording the decision.');
        if (!reviewSummary.trim()) return setError('Add a review rationale before recording the decision.');
        setBusy(true); setError(''); setMessage('');
        try {
            await api(`/runs/${encodeURIComponent(runDetails.run.id)}/reviews`, reviewApiKey, {
                method: 'POST', body: JSON.stringify({ reviewerRole, verdict: reviewVerdict, summary: reviewSummary.trim() }),
            });
            setReviewSummary('');
            setReviewerKey('');
            setMessage(`${reviewerRole} ${reviewVerdict} review recorded.`);
            await inspectRun(runDetails.run.id);
            await refresh(key);
        } catch (err) { setError(err.message || 'Could not record this review.'); }
        finally { setBusy(false); }
    };

    const decideRunGate = async (decision) => {
        if (!runDetails?.gate?.id || !gateApproverKey.trim()) return setError('Enter an owner or administrator member API key to decide this gate.');
        setBusy(true); setError(''); setMessage('');
        try {
            await api(`/gates/${encodeURIComponent(runDetails.gate.id)}/${decision}`, gateApproverKey.trim(), {
                method: 'POST', body: JSON.stringify({
                    note: decision === 'approve' ? 'Approved in AgentCache execution console.' : 'Rejected in AgentCache execution console.',
                }),
            });
            setGateApproverKey(''); setGateApproverKeyVisible(false);
            setMessage(decision === 'approve' ? 'Gate approved. The governed action is now available.' : 'Gate rejected. The governed action remains blocked.');
            await inspectRun(runDetails.run.id);
            await refresh(key);
        } catch (err) { setError(err.message || 'Could not decide the approval gate.'); }
        finally { setBusy(false); }
    };

    const invokeJettySummary = async (connectionId, freshRead = false) => {
        if (!runDetails?.run?.id) return;
        const invocationKeySlot = `agentcache_execution_invoke:${runDetails.run.id}:${connectionId}`;
        let idempotencyKey = freshRead ? null : sessionStorage.getItem(invocationKeySlot);
        if (!idempotencyKey) {
            idempotencyKey = crypto.randomUUID();
            sessionStorage.setItem(invocationKeySlot, idempotencyKey);
        }
        setBusy(true); setError(''); setMessage('');
        try {
            await api(`/runs/${encodeURIComponent(runDetails.run.id)}/invoke`, key, { method: 'POST', body: JSON.stringify({ tool: 'jetty.storage.summary', connectionId, idempotencyKey }) });
            sessionStorage.removeItem(invocationKeySlot);
            setMessage('Storage summary completed and added to this run’s history.');
            await inspectRun(runDetails.run.id);
            await refresh(key);
        } catch (err) {
            if (err.retryWithNewKey || (err.status && ![409, 503].includes(err.status))) sessionStorage.removeItem(invocationKeySlot);
            setError(err.message || 'Could not run the storage summary.');
            await inspectRun(runDetails.run.id); await refresh(key);
        }
        finally { setBusy(false); }
    };

    const connectProvider = async (event) => {
        event.preventDefault();
        setError(''); setMessage('');
        const requestedScopes = connectionScopes.split(',').map((scope) => scope.trim()).filter(Boolean);
        if (provider.trim() === 'jettythunder' && !requestedScopes.some((scope) => ['storage.read', 'metadata.read'].includes(scope))) {
            return setError('JettyThunder needs storage.read or metadata.read for the read-only summary.');
        }
        let credentials;
        if (provider.trim() === 'jettythunder') {
            const serviceKey = connectionCredentials.trim();
            if (!serviceKey) return setError('Enter your JettyThunder service key.');
            if (!/^ac_(prod|test)_[a-f0-9]{32,}$/i.test(serviceKey)) {
                return setError('JettyThunder keys must start with ac_prod_ or ac_test_ and end with at least 32 hexadecimal characters.');
            }
            credentials = { serviceKey };
        } else {
            try {
                credentials = JSON.parse(connectionCredentials || '{}');
                if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials) || !Object.keys(credentials).length) throw new Error();
            } catch { return setError('Provider credentials must be a non-empty JSON object.'); }
        }
        setBusy(true);
        try {
            await api('/connections', key, { method: 'POST', body: JSON.stringify({
                provider: provider.trim(), displayName: connectionName.trim() || undefined,
                scopes: requestedScopes, credentials,
            }) });
            setConnectionCredentials(''); setConnectionName(''); setShowConnectionCredentials(false);
            setMessage('Credentials saved encrypted. Provider access has not been verified yet.');
            await refresh(key);
        } catch (err) {
            setConnectionCredentials('');
            setShowConnectionCredentials(false);
            setShowConnectionCredentials(false);
            setError(`${err.message || 'Could not confirm the provider account save.'} Credentials were cleared; check saved accounts before retrying.`);
            try {
                const result = await api('/connections?limit=50', key);
                setConnections(result.connections || []);
            } catch { /* Preserve the save error; history will refresh on the next manual reload. */ }
        }
        finally { setBusy(false); }
    };

    const revokeProvider = async (id) => {
        setBusy(true); setError(''); setMessage('');
        try {
            await api(`/connections/${encodeURIComponent(id)}`, key, { method: 'DELETE' });
            setMessage('Account disconnected and stored credential material cleared.');
            await refresh(key);
        } catch (err) { setError(err.message || 'Could not disconnect this provider account.'); }
        finally { setBusy(false); }
    };

    const phasePlan = runDetails?.run?.phasePlan || [];
    const currentPhaseIndex = phasePlan.indexOf(runDetails?.run?.currentPhase);
    const nextPhase = currentPhaseIndex >= 0 ? phasePlan[currentPhaseIndex + 1] : null;
    const requiredReviewers = runDetails?.run?.requiredReviewerRoles || [];
    const completedReviewers = runDetails?.run?.completedReviewerRoles || [];
    const pendingReviewers = requiredReviewers.filter((role) => !completedReviewers.includes(role));

    return <div className="space-y-6 text-white">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[.2em] text-cyan-300"><ShieldCheck size={15} /> Governed execution</div><h1 className="text-3xl font-semibold">Agent tool control</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Connect your workspace, start a policy-checked workflow, and inspect its approval state and run history.</p></div>
            {connected && <button onClick={disconnect} disabled={busy} className="flex items-center gap-2 self-start rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-rose-200 disabled:cursor-wait disabled:opacity-50"><Unplug size={15} /> Disconnect</button>}
        </header>
        {error && <div role="alert" className="flex gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"><CircleAlert size={17} />{error}</div>}
        {message && !error && <div role="status" className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div>}
        {!connected ? <section className="max-w-2xl rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-6">
            <div className="mb-4 flex items-center gap-3"><KeyRound className="text-cyan-200" /><div><h2 className="font-semibold">Connect your AgentCache workspace</h2><p className="mt-1 text-sm text-white/55">Your key stays in this browser tab and is sent only to AgentCache.</p></div></div>
            <form onSubmit={connect} className="space-y-3"><label htmlFor="execution-key" className="block text-xs uppercase tracking-wider text-white/55">AgentCache API key</label><input id="execution-key" type="password" autoComplete="off" value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder="ac_…" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3 font-mono text-sm outline-none focus:border-cyan-300/60" /><button disabled={busy || !keyDraft.trim()} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Connecting…' : 'Connect'}</button></form>
        </section> : <>
            {executionUsageError ? <div role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm text-amber-100/80">Action budget status could not be loaded ({executionUsageError}). Provider calls fail closed until the budget can be verified.</div> : executionUsage?.actionBudget && (!executionUsage.actionBudget.configured || !executionUsage.actionBudget.active || executionUsage.actionBudget.remaining === 0) ? <div role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm text-amber-100/80">{!executionUsage.actionBudget.configured ? 'No time-bounded action budget is configured for this workspace. Provider calls are blocked until an administrator sets one.' : !executionUsage.actionBudget.active ? 'The action budget is outside its active time window. Provider calls are blocked until an administrator configures an active budget.' : 'The action budget has reached its attempt limit. Provider calls are blocked until the active budget is raised or renewed.'}</div> : null}
            <section className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-5">
                <div className="mb-4"><h2 className="font-semibold">Saved provider accounts</h2><p className="mt-1 text-xs leading-5 text-white/50">Save a credential for an account you own. AgentCache encrypts it; saving does not contact JettyThunder. The first approved storage summary checks access and marks the connection verified.</p></div>
                {connectionAccessError ? <p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm text-amber-100/80">{connectionAccessError} Use a user or organization API key to manage delegated provider accounts.</p> : <form onSubmit={connectProvider} className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-white/60">Provider ID<input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="provider-name" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
                    <label className="text-xs text-white/60">Connection label<input value={connectionName} onChange={(event) => setConnectionName(event.target.value)} placeholder="Publishing account" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
                    <label className="text-xs text-white/60">Requested scopes<input value={connectionScopes} onChange={(event) => setConnectionScopes(event.target.value)} placeholder="storage.read" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white" /><span className="mt-1 block text-[11px] leading-5 text-white/40">For JettyThunder, request storage.read or metadata.read. This declaration does not verify provider permissions.</span></label>
                    <label className="text-xs text-white/60">{provider.trim() === 'jettythunder' ? 'JettyThunder service key' : 'Provider credentials (JSON)'}
                        <div className="mt-1.5 flex gap-2"><input type={showConnectionCredentials ? 'text' : 'password'} autoComplete="new-password" value={connectionCredentials} onChange={(event) => setConnectionCredentials(event.target.value)} placeholder={provider.trim() === 'jettythunder' ? 'ac_test_… or ac_prod_…' : '{"token": "…"}'} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 font-mono text-xs text-white" /><button type="button" onClick={() => setShowConnectionCredentials((shown) => !shown)} className="rounded-lg border border-white/15 px-3 text-xs text-white/60">{showConnectionCredentials ? 'Hide' : 'Show'}</button></div>
                    </label>
                    <div className="md:col-span-2"><button disabled={busy || !provider.trim() || !connectionCredentials.trim()} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Save account'}</button></div>
                </form>}
                <div className="mt-4 space-y-2">{connections.map((connection) => <article key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 py-3"><div><p className="text-sm text-white">{connection.displayName || connection.provider} <span className="ml-2 text-xs text-white/40">{connection.provider}</span></p><p className="mt-1 text-xs text-white/45">{(connection.scopes || []).join(', ') || 'No scopes specified'} · {connection.status} · {connection.verificationStatus || 'unverified'}</p></div>{connection.status === 'active' && <button disabled={busy} onClick={() => revokeProvider(connection.id)} className="flex items-center gap-1.5 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 disabled:opacity-50"><Unplug size={13} /> Disconnect</button>}</article>)}{!connections.length && <p className="rounded-lg bg-white/[.03] p-3 text-sm text-white/45">No saved provider accounts yet.</p>}</div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Available tools</h2><p className="mt-1 text-xs text-white/45">AgentCache checks each action; approved calls use the selected saved provider account.</p></div><button onClick={() => refresh(key)} disabled={busy} aria-label="Refresh tools and runs" className="rounded-lg border border-white/10 p-2 text-white/60"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button></div>
                    <div className="space-y-2">{tools.map((tool) => <article key={tool.name} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="flex justify-between gap-2"><code className="text-sm text-cyan-200">{tool.name}</code><span className="text-[10px] text-white/45">{tool.method}</span></div><p className="mt-2 text-xs leading-5 text-white/55">{tool.description}</p></article>)}{!tools.length && <p className="text-sm text-white/50">No tools returned.</p>}</div>
                </section>
                <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Play size={16} className="text-cyan-200" /><div><h2 className="font-semibold">Start a governed run</h2><p className="mt-1 text-xs text-white/45">High-impact actions pause for review. The Jetty pilot reads aggregate metadata only.</p></div></div><button onClick={createJettyPilotPack} disabled={busy} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">Create Jetty read-only workflow</button></div>
                    {packs.length ? <form onSubmit={startRun} className="space-y-4"><div><label htmlFor="context-pack" className="mb-1.5 block text-xs text-white/60">Workflow context</label><select id="context-pack" value={packId} onChange={(event) => setPackId(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 text-sm">{packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.name} — {pack.objective}</option>)}</select></div>
                        <div><label htmlFor="run-input" className="mb-1.5 block text-xs text-white/60">Run input (JSON)</label><textarea id="run-input" rows={5} value={payload} onChange={(event) => setPayload(event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 font-mono text-xs leading-5 outline-none focus:border-cyan-300/60" /></div>
                        <div><label htmlFor="final-action" className="mb-1.5 block text-xs text-white/60">Intended final action</label><select id="final-action" value={action} onChange={(event) => setAction(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 text-sm"><option value="manual">Manual / review only</option><option value="publish">Publish</option><option value="send">Send</option><option value="pay">Pay</option><option value="delete">Delete</option><option value="external_store">Store externally</option></select></div>
                        <label className="flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-white/70"><input type="checkbox" checked={requireHumanApproval} onChange={(event) => setRequireHumanApproval(event.target.checked)} className="mt-1 accent-cyan-300" /><span><strong className="text-amber-100">Require human approval before provider access</strong><br />On by default. AgentCache pauses at the approval gate until an administrator approves the run.</span></label>
                        <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Play size={14} />{busy ? 'Working…' : 'Start governed run'}</button></form> : <form onSubmit={createPack} className="space-y-3 rounded-xl border border-dashed border-white/15 p-4"><p className="text-sm text-white/65">Create a workflow definition, then run it through policy checks and approval gates.</p><label className="block text-xs text-white/55" htmlFor="pack-name">Workflow name</label><input id="pack-name" value={packName} onChange={(event) => setPackName(event.target.value)} required className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /><label className="block text-xs text-white/55" htmlFor="pack-objective">Workflow objective</label><textarea id="pack-objective" value={packObjective} onChange={(event) => setPackObjective(event.target.value)} required rows={3} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /><button disabled={busy || !packName.trim() || !packObjective.trim()} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50">{busy ? 'Creating…' : 'Create context pack'}</button></form>}
                </section>
            </div>
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity size={17} className="text-cyan-200" /><div><h2 className="font-semibold">Recent tool activity</h2><p className="mt-1 text-xs text-white/45">Durable redacted invocation evidence remains available if a run’s Redis view expires.</p></div></div>{executionUsage && <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-cyan-100/50">This month</p><p className="text-sm text-cyan-100">{executionUsage.totals.completed} completed · {executionUsage.totals.blocked} blocked</p>{executionUsage.actionBudget?.configured && <><p className="mt-1 text-[10px] text-cyan-100/75">Provider-attempt cap {executionUsage.actionBudget.reservedCount} / {executionUsage.actionBudget.actionLimit} · {executionUsage.actionBudget.remaining} remaining</p><p className="mt-1 text-[10px] text-white/40">Attempt cap, not dollar spend. Provider errors count; denials and retries do not.</p></>}<p className="mt-1 text-[10px] text-white/50">{executionUsage.adoption?.completedRunCount || 0} completed runs · {executionUsage.adoption?.repeatedWorkflowVersionCount || 0} repeated workflow versions · {executionUsage.adoption?.activeWeeks || 0} active weeks</p><p className="mt-1 text-[10px] text-white/40">Completed calls are measurement only · no charge</p></div>}</div>{invocationHistoryError ? <p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm text-amber-100/80">{invocationHistoryError} Apply database migrations 0005 through 0019 before using execution history and provider tools.</p> : recentInvocations.length ? <div className="space-y-2">{recentInvocations.map((invocation) => <article key={invocation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2.5"><div><p className="text-sm text-white">{invocation.toolName} <span className="ml-2 text-xs text-white/45">{invocation.status}</span></p><p className="mt-1 font-mono text-[10px] text-white/40">Run {invocation.executionRunId} · Actor {invocation.actorPrincipalId || 'identity unavailable'} · {new Date(invocation.createdAt).toLocaleString()}</p></div><div className="text-right text-xs text-white/55">{invocation.resultSummary ? `Files ${invocation.resultSummary.fileCount} · ${invocation.resultSummary.usedBytes}/${invocation.resultSummary.quotaBytes} bytes` : invocation.errorCode || 'No terminal result'}</div></article>)}</div> : <p className="rounded-lg bg-white/[.03] p-4 text-sm text-white/55">No provider actions recorded yet.</p>}</section>
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-cyan-200" /><div><h2 className="font-semibold">Durable decision history</h2><p className="mt-1 text-xs text-white/45">Run starts, reviews, phase changes, and gate outcomes remain available after the active run view expires.</p></div></div>{recentDecisionEvents.length ? <div className="space-y-2">{recentDecisionEvents.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2.5"><div><p className="text-sm text-white">{event.eventType.replaceAll('_', ' ')} <span className="ml-2 text-xs text-white/45">{event.verdict || event.status || 'recorded'}</span></p><p className="mt-1 font-mono text-[10px] text-white/40">Run {event.executionRunId} · {event.actorRole || 'actor'} · {event.actorPrincipalId || 'identity unavailable'}</p>{event.summary && <p className="mt-2 max-w-2xl text-xs text-white/65">{event.summary}</p>}{event.findings?.length > 0 && <p className="mt-1 max-w-2xl text-[11px] text-white/50">Findings: {event.findings.join(' · ')}</p>}</div><div className="text-right text-xs text-white/50">{event.phase || '—'} · {new Date(event.occurredAt).toLocaleString()}<br />Receipt {event.receiptId || 'not available'}</div></article>)}</div> : <p className="rounded-lg bg-white/[.03] p-4 text-sm text-white/55">No durable decision events yet. Apply migration 0008 to enable this history.</p>}</section>
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><div className="mb-4 flex items-center gap-2"><Activity size={17} className="text-cyan-200" /><div><h2 className="font-semibold">Recent execution history</h2><p className="mt-1 text-xs text-white/45">Run status, approval state, phases, and receipts.</p></div></div>
                {runs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/40"><tr><th className="pb-3 pr-4">Run ID</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Phase</th><th className="pb-3 pr-4">Approval</th><th className="pb-3">Started</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-white/10"><td className="py-3 pr-4"><button onClick={() => inspectRun(run.id)} className="font-mono text-xs text-cyan-200 hover:underline">{run.id}</button></td><td className="py-3 pr-4">{run.status}</td><td className="py-3 pr-4">{run.currentPhase}</td><td className="py-3 pr-4">{run.gateStatus || 'not required'}</td><td className="py-3 text-xs text-white/50">{run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div> : <div className="rounded-lg bg-white/[.03] p-4 text-sm text-white/55">{busy ? 'Loading history…' : 'No runs yet. Start a governed run to create a reviewable record.'}</div>}
                {runDetails && <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs uppercase tracking-wider text-cyan-100/60">Selected run</p><code className="text-sm text-cyan-100">{runDetails.run.id}</code></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{runDetails.run.status} · {runDetails.run.gateStatus}</span></div><p className="mt-3 text-sm text-white/70">Workflow: {runDetails.contextPack?.name} · Current phase: {runDetails.run.currentPhase}</p><details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-xs text-white/70">Review redacted run input</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-white/55">{JSON.stringify(runDetails.run.inputPayload || {}, null, 2)}</pre></details>{runDetails.decisionEvents?.length > 0 && <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-xs text-white/70">Durable decision history ({runDetails.decisionEvents.length})</summary><div className="mt-2 space-y-2">{runDetails.decisionEvents.map((event) => <div key={event.id} className="rounded-md bg-white/[.03] p-2"><p className="text-xs text-white/75">{event.eventType.replaceAll('_', ' ')} · {event.status || event.verdict || 'recorded'} · {new Date(event.occurredAt).toLocaleString()}</p><p className="mt-1 break-all font-mono text-[10px] text-white/40">{event.actorRole || 'actor'} · {event.actorPrincipalId || 'identity unavailable'} · receipt {event.receiptId || 'not available'}</p></div>)}</div></details>}{runDetails.run.currentPhase === 'review' && pendingReviewers.length > 0 && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/55">Required review labels: {pendingReviewers.join(', ')}</p><p className="mt-1 text-[11px] leading-5 text-amber-100/65">The service verifies a different individual account in the same organization for each reviewer role. Shared organization keys cannot submit reviews; use a user-owned key tied to an organization member.</p><label className="mt-3 block text-xs text-white/65">Reviewer member API key<input type="password" autoComplete="off" value={reviewerKey} onChange={(event) => setReviewerKey(event.target.value)} placeholder="Use a different member’s ac_… key" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm" /></label><p className="mt-1 text-[11px] leading-5 text-white/45">This key is used only for the review request, stays in memory, and is cleared after a successful submission or when you select another run. The authenticated reviewer must be a different member in the same organization.</p><label className="mt-3 block text-xs text-white/65">Review verdict<select value={reviewVerdict} onChange={(event) => setReviewVerdict(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm"><option value="">Choose a verdict</option>{['PASS', 'REVIEW', 'BLOCK', 'INFO'].map((verdict) => <option key={verdict} value={verdict}>{verdict}</option>)}</select></label><label className="mt-3 block text-xs text-white/65">Rationale<textarea value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} rows={3} placeholder="Summarize the evidence you reviewed and why this verdict is appropriate." className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /></label><div className="mt-2 flex flex-wrap gap-2">{pendingReviewers.map((role) => <button key={role} disabled={busy || !reviewVerdict || !reviewSummary.trim()} onClick={() => submitReview(role)} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">Record {role} review</button>)}</div><p className="mt-2 text-[11px] text-amber-100/60">Your user identity and organization membership are checked by the service; the role name is a workflow label.</p></div>}{nextPhase && runDetails.run.currentPhase !== 'gate' && (runDetails.run.currentPhase !== 'review' || pendingReviewers.length === 0) && <button disabled={busy} onClick={() => advanceRun(nextPhase)} className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 disabled:opacity-50">Advance to {nextPhase}</button>}{runDetails.gate && <><p className="mt-2 text-sm text-amber-200">Approval gate: {runDetails.gate.status}{runDetails.gate.reason ? ` — ${runDetails.gate.reason}` : ''}</p>{runDetails.gate.decidedByPrincipalId && <p className="mt-1 text-[11px] text-white/45">Authenticated approver: {runDetails.gate.decidedByPrincipalId}{runDetails.gate.decidedBy ? ` · operator label: ${runDetails.gate.decidedBy}` : ''}</p>}</>}{runDetails.reviews?.length > 0 && <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-xs text-white/70">Review history ({runDetails.reviews.length})</summary><div className="mt-2 space-y-2">{runDetails.reviews.map((review) => <div key={review.id} className="rounded-md bg-white/[.03] p-2"><p className="text-xs text-white/75">{review.reviewerRole} · {review.verdict} · {new Date(review.createdAt).toLocaleString()}</p><p className="mt-1 text-xs text-white/55">{review.summary || 'No rationale recorded.'}</p><p className="mt-1 break-all font-mono text-[10px] text-white/35">Authenticated principal: {review.reviewerPrincipalId || 'not recorded'}</p></div>)}</div></details>}{runDetails.gate?.status === 'pending' && runDetails.run.currentPhase === 'gate' && <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[.04] p-3"><label className="block text-xs text-white/65">Owner or administrator member API key<input type={gateApproverKeyVisible ? 'text' : 'password'} autoComplete="off" value={gateApproverKey} onChange={(event) => setGateApproverKey(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" /></label><p className="mt-2 text-[11px] text-white/45">Use a different owner or administrator in this organization from the person who started the run. This key stays in memory and is cleared after the decision.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setGateApproverKeyVisible((visible) => !visible)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65">{gateApproverKeyVisible ? 'Hide token' : 'Show token'}</button><button type="button" disabled={busy || !gateApproverKey.trim()} onClick={() => decideRunGate('approve')} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Approve gate</button><button type="button" disabled={busy || !gateApproverKey.trim()} onClick={() => decideRunGate('reject')} className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">Reject</button></div></div>}{runDetails.contextPackVersion?.tools?.includes('jetty.storage.summary') && (runDetails.run.gateStatus === 'not_required' || runDetails.run.gateStatus === 'approved') && runDetails.run.status !== 'blocked' && <div className="mt-3 flex flex-wrap gap-2">{connections.filter((connection) => connection.status === 'active' && connection.provider === 'jettythunder' && connection.verificationStatus !== 'expired').map((connection) => <button key={connection.id} disabled={busy || !invocationHistoryAvailable} onClick={() => invokeJettySummary(connection.id)} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Read storage summary · {connection.displayName || 'Jetty account'}</button>)}</div>}{connections.some((connection) => connection.provider === 'jettythunder' && connection.status === 'active' && connection.verificationStatus === 'expired') && <p role="status" className="mt-2 text-xs text-amber-200">A JettyThunder key expired. Disconnect that account and save a current key before running it again.</p>}{!invocationHistoryAvailable && <p role="status" className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100/80">Durable invocation history is unavailable. Apply execution migrations 0005 through 0019 before running provider tools.</p>}{(runDetails.durableInvocations || []).map((invocation) => <div key={invocation.id} className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-cyan-100">{invocation.toolName} · {invocation.status} · invocation {invocation.id} · {new Date(invocation.createdAt).toLocaleString()}</p><p className="mt-1 break-all font-mono text-[10px] text-white/40">Owner {invocation.principalId} · Actor {invocation.actorPrincipalId || 'identity unavailable'}</p><p className="mt-1 text-[11px] text-white/45">Context version: {invocation.contextPackVersionId || 'not recorded'} · Run receipt: {invocation.runReceiptId || 'not available'} · Approval receipt: {invocation.approvalReceiptId || 'not required'}</p><p className="mt-1 text-[11px] text-white/45">Policy: {invocation.policyDecision || 'not evaluated'} · {invocation.policyVersion || 'version unavailable'} · Rules: {invocation.policyRuleIds?.length ? invocation.policyRuleIds.join(', ') : 'not recorded'}{invocation.policyReasonCode ? ` · ${invocation.policyReasonCode}` : ''}</p>{invocation.status === 'started' && <p className="mt-1 text-xs text-amber-200">Provider outcome is not confirmed yet. Wait for reconciliation before retrying.</p>}{invocation.status === 'outcome_unknown' && <><p className="mt-1 text-xs text-amber-200">This action only reads aggregate quota and file count. A fresh read will create a separate audit record.</p>{invocation.connectionId && connections.some((connection) => connection.id === invocation.connectionId && connection.status === 'active' && connection.provider === 'jettythunder' && connection.verificationStatus !== 'expired') && (runDetails.run.gateStatus === 'not_required' || runDetails.run.gateStatus === 'approved') && runDetails.run.status !== 'blocked' && <button disabled={busy || !invocationHistoryAvailable} onClick={() => invokeJettySummary(invocation.connectionId, true)} className="mt-2 rounded-lg border border-amber-200/30 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">Run a fresh read-only check</button>}</>}{invocation.resultSummary && <p className="mt-1 text-xs text-white/65">Files: {invocation.resultSummary.fileCount} · Used: {invocation.resultSummary.usedBytes} / {invocation.resultSummary.quotaBytes} bytes ({invocation.resultSummary.usagePercent}%)</p>}{invocation.errorCode && <p className="mt-1 text-xs text-rose-200">{invocation.errorCode}</p>}</div>)}<p className="mt-2 text-xs text-white/45">Receipt: {runDetails.run.receiptId || 'not available'} · Reviews recorded: {runDetails.reviews?.length || 0}</p></div>}
            </section>
        </>}
        <p className="text-xs leading-5 text-white/35">Connections store encrypted credentials. The JettyThunder pilot reads only aggregate quota and file counts through fixed endpoints; it never returns file names, identifiers, or storage keys.</p>
    </div>;
}
