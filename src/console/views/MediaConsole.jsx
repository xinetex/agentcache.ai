import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BadgeCheck,
    CheckCircle2,
    Clipboard,
    Clock3,
    ExternalLink,
    FileVideo,
    Gauge,
    Loader2,
    Play,
    RefreshCw,
    Route,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';

const FALLBACK_PROFILES = [
    {
        id: 'roku-hls',
        name: 'Roku HLS',
        target: 'Roku, TV apps',
        container: 'HLS VOD',
        description: 'Four-rung H.264/AAC ladder with conservative Roku playback constraints.',
        ladder: [
            { name: '1080p', height: 1080, bitrate: '8M', audio_bitrate: '192k' },
            { name: '720p', height: 720, bitrate: '4M', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '2M', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '800k', audio_bitrate: '64k' },
        ],
        validationRules: ['Master manifest exists', 'Every variant has playlist and segments', 'H.264/AAC output'],
    },
    {
        id: 'web-hls',
        name: 'Web HLS',
        target: 'Browsers, mobile web',
        container: 'HLS VOD',
        description: 'Balanced web ladder for hls.js and native mobile playback.',
        ladder: [
            { name: '1080p', height: 1080, bitrate: '6M', audio_bitrate: '160k' },
            { name: '720p', height: 720, bitrate: '3M', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '1400k', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '700k', audio_bitrate: '64k' },
        ],
        validationRules: ['Playable master manifest', 'Relative segment paths', 'Audio bitrate declared'],
    },
    {
        id: 'mobile-hls',
        name: 'Mobile HLS',
        target: 'Phones, low bandwidth',
        container: 'HLS VOD',
        description: 'Smaller ladder optimized for startup speed and reduced transfer cost.',
        ladder: [
            { name: '720p', height: 720, bitrate: '2200k', audio_bitrate: '128k' },
            { name: '480p', height: 480, bitrate: '1200k', audio_bitrate: '96k' },
            { name: '360p', height: 360, bitrate: '550k', audio_bitrate: '64k' },
        ],
        validationRules: ['Master manifest exists', 'Mobile bitrate ceiling', 'Segments for every rendition'],
    },
];

const sampleSources = [
    'audio1/uploads/live-session-001.mp4',
    'audio1/artists/featured/video-master.mov',
    'jettythunder/media/customer-demo.mp4',
];

const statusStyles = {
    queued: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    running: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    complete: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    cache_hit: 'border-violet-400/40 bg-violet-500/10 text-violet-200',
    failed: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
    not_found: 'border-slate-400/40 bg-slate-500/10 text-slate-200',
};

function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

function shortId(value = '') {
    if (!value) return 'pending';
    if (value.length <= 18) return value;
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDate(value) {
    if (!value) return 'Just now';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

async function apiFetch(path, options) {
    const res = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
        ...options,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(payload.error || `Request failed: ${res.status}`);
    }
    return payload;
}

const Metric = ({ icon: Icon, label, value, tone = 'text-cyan-200' }) => (
    <div className="glass-light rounded-lg p-4 min-h-[92px]">
        <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">{label}</span>
            <Icon size={18} className={tone} />
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatusBadge = ({ status }) => (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium', statusStyles[status] || statusStyles.not_found)}>
        {status?.replace('_', ' ') || 'unknown'}
    </span>
);

const MediaConsole = () => {
    const [profiles, setProfiles] = useState(FALLBACK_PROFILES);
    const [selectedProfileId, setSelectedProfileId] = useState('roku-hls');
    const [inputKey, setInputKey] = useState(sampleSources[0]);
    const [outputPrefix, setOutputPrefix] = useState('');
    const [plan, setPlan] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [queueLength, setQueueLength] = useState(0);
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [planning, setPlanning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || profiles[0];
    const selectedJob = jobs.find((job) => job.jobId === selectedJobId) || jobs[0];

    const metrics = useMemo(() => {
        const ready = jobs.filter((job) => job.status === 'complete' || job.status === 'cache_hit').length;
        const failed = jobs.filter((job) => job.status === 'failed').length;
        const cacheHits = jobs.filter((job) => job.cacheHit || job.status === 'cache_hit').length;
        return { ready, failed, cacheHits };
    }, [jobs]);

    const loadJobs = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiFetch('/api/transcode/jobs?limit=20');
            if (Array.isArray(data.profiles) && data.profiles.length > 0) {
                setProfiles(data.profiles);
            }
            setJobs(data.jobs || []);
            setQueueLength(data.queueLength || 0);
            setSelectedJobId((current) => current || data.jobs?.[0]?.jobId || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inspectPlan = async () => {
        if (!inputKey.trim()) {
            setError('Enter a source object key before planning.');
            return;
        }
        setPlanning(true);
        setError('');
        setNotice('');
        try {
            const data = await apiFetch('/api/transcode/plan', {
                method: 'POST',
                body: JSON.stringify({
                    inputKey: inputKey.trim(),
                    profile: selectedProfileId,
                    outputPrefix: outputPrefix.trim() || undefined,
                }),
            });
            setPlan(data.plan);
        } catch (err) {
            setError(err.message);
        } finally {
            setPlanning(false);
        }
    };

    const submitJob = async () => {
        if (!inputKey.trim()) {
            setError('Enter a source object key before queueing.');
            return;
        }
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            const data = await apiFetch('/api/transcode/submit', {
                method: 'POST',
                body: JSON.stringify({
                    inputKey: inputKey.trim(),
                    profile: selectedProfileId,
                    outputPrefix: outputPrefix.trim() || undefined,
                }),
            });
            setNotice(data.cacheHit ? 'Cached stream is ready.' : 'Encoding job queued.');
            setPlan(data.plan);
            await loadJobs();
            setSelectedJobId(data.jobId);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, []);

    useEffect(() => {
        if (!inputKey.trim()) return;
        const timeout = setTimeout(() => {
            inspectPlan();
        }, 450);
        return () => clearTimeout(timeout);
    }, [selectedProfileId]);

    return (
        <div className="space-y-6">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-3 text-cyan-200">
                        <FileVideo size={26} />
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--hud-text-dim)]">AgentCache Media Engine</span>
                    </div>
                    <h1 className="mt-3 font-['Rajdhani'] text-4xl font-bold tracking-wide text-white">Media Console</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--hud-text-dim)]">
                        Encode storage-backed source media into validated, cache-aware HLS streams for audio1.tv and device-specific playback.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={loadJobs}
                        className="btn-secondary inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                        disabled={loading}
                    >
                        {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={submitJob}
                        className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                        disabled={submitting}
                    >
                        {submitting ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                        Queue Encode
                    </button>
                </div>
            </section>

            {(error || notice) && (
                <div className={cx(
                    'rounded-lg border px-4 py-3 text-sm',
                    error ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                )}>
                    <div className="flex items-center gap-2">
                        {error ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                        <span>{error || notice}</span>
                    </div>
                </div>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric icon={Gauge} label="Queue" value={queueLength} />
                <Metric icon={BadgeCheck} label="Ready Streams" value={metrics.ready} tone="text-emerald-200" />
                <Metric icon={Sparkles} label="Cache Hits" value={metrics.cacheHits} tone="text-violet-200" />
                <Metric icon={ShieldCheck} label="Failed Checks" value={metrics.failed} tone={metrics.failed ? 'text-rose-200' : 'text-emerald-200'} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(560px,1.45fr)]">
                <div className="glass rounded-lg p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">New Stream</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">Select a stored source and target output.</p>
                        </div>
                        <Route className="text-cyan-200" size={22} />
                    </div>

                    <div className="mt-5 space-y-4">
                        <label className="block">
                            <span className="mb-2 block text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Source Object</span>
                            <input
                                value={inputKey}
                                onChange={(event) => setInputKey(event.target.value)}
                                className="input-cyber w-full rounded-lg px-3 py-3 text-sm"
                                placeholder="audio1/uploads/video.mp4"
                            />
                        </label>

                        <div className="flex flex-wrap gap-2">
                            {sampleSources.map((source) => (
                                <button
                                    type="button"
                                    key={source}
                                    onClick={() => setInputKey(source)}
                                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-white"
                                >
                                    {source.split('/').at(-1)}
                                </button>
                            ))}
                        </div>

                        <label className="block">
                            <span className="mb-2 block text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Output Prefix</span>
                            <input
                                value={outputPrefix}
                                onChange={(event) => setOutputPrefix(event.target.value)}
                                className="input-cyber w-full rounded-lg px-3 py-3 text-sm"
                                placeholder="Auto-generated if empty"
                            />
                        </label>

                        <div>
                            <span className="mb-2 block text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Target</span>
                            <div className="grid gap-2">
                                {profiles.map((profile) => {
                                    const active = profile.id === selectedProfileId;
                                    return (
                                        <button
                                            type="button"
                                            key={profile.id}
                                            onClick={() => setSelectedProfileId(profile.id)}
                                            className={cx(
                                                'rounded-lg border p-3 text-left transition',
                                                active
                                                    ? 'border-cyan-300/60 bg-cyan-500/10 text-white'
                                                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-semibold">{profile.name}</span>
                                                <span className="text-xs text-[var(--hud-text-dim)]">{profile.ladder?.length || 0} renditions</span>
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-[var(--hud-text-dim)]">{profile.target}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={inspectPlan}
                                className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm"
                                disabled={planning}
                            >
                                {planning ? <Loader2 size={17} className="animate-spin" /> : <Clipboard size={17} />}
                                Inspect Plan
                            </button>
                            <button
                                type="button"
                                onClick={submitJob}
                                className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm"
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                                Queue
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass rounded-lg p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Execution Plan</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">{selectedProfile?.description}</p>
                        </div>
                        <StatusBadge status={plan ? 'queued' : 'not_found'} />
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Cache Key</div>
                            <div className="mt-2 font-mono text-sm text-cyan-100">{shortId(plan?.cache?.key)}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Master Manifest</div>
                            <div className="mt-2 truncate font-mono text-sm text-white">{plan?.output?.masterManifestKey || 'Awaiting source'}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Policy</div>
                            <div className="mt-2 font-mono text-sm text-white">{plan?.cache?.policyVersion || 'media-policy-v1'}</div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Ladder</h3>
                            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                                {(plan?.profile?.ladder || selectedProfile?.ladder || []).map((rung) => (
                                    <div key={rung.name} className="grid grid-cols-[80px_1fr_80px] gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-sm last:border-b-0">
                                        <span className="font-mono text-cyan-100">{rung.name}</span>
                                        <span className="text-slate-300">{rung.height}p</span>
                                        <span className="text-right text-slate-300">{rung.bitrate}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Validation</h3>
                            <div className="mt-3 grid gap-2">
                                {(plan?.validation?.rules || selectedProfile?.validationRules || []).map((rule) => (
                                    <div key={rule} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                                        <CheckCircle2 size={15} className="text-emerald-300" />
                                        <span>{rule}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(420px,1fr)_minmax(520px,1.2fr)]">
                <div className="glass rounded-lg p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Jobs</h2>
                            <p className="mt-1 text-sm text-[var(--hud-text-dim)]">Recent media work for this environment.</p>
                        </div>
                        <Clock3 className="text-amber-200" size={22} />
                    </div>

                    <div className="mt-5 max-h-[520px] overflow-y-auto rounded-lg border border-white/10">
                        {jobs.length === 0 ? (
                            <div className="p-8 text-center text-sm text-[var(--hud-text-dim)]">
                                No media jobs yet.
                            </div>
                        ) : (
                            jobs.map((job) => (
                                <button
                                    type="button"
                                    key={job.jobId}
                                    onClick={() => setSelectedJobId(job.jobId)}
                                    className={cx(
                                        'block w-full border-b border-white/10 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.04]',
                                        selectedJob?.jobId === job.jobId ? 'bg-cyan-500/10' : 'bg-transparent'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-mono text-sm text-white">{job.jobId}</div>
                                            <div className="mt-1 truncate text-xs text-[var(--hud-text-dim)]">{job.inputKey || 'source unavailable'}</div>
                                        </div>
                                        <StatusBadge status={job.status} />
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                                        <span>{job.profile?.name || job.profileId || 'Media'}</span>
                                        <span>{formatDate(job.updatedAt || job.createdAt)}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300"
                                            style={{ width: `${Math.min(100, Math.max(0, job.progress || (job.status === 'complete' ? 100 : 0)))}%` }}
                                        />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="glass rounded-lg p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <h2 className="font-['Rajdhani'] text-2xl font-semibold text-white">Stream Detail</h2>
                            <p className="mt-1 truncate text-sm text-[var(--hud-text-dim)]">{selectedJob?.jobId || 'Select a job'}</p>
                        </div>
                        {selectedJob && <StatusBadge status={selectedJob.status} />}
                    </div>

                    {!selectedJob ? (
                        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-[var(--hud-text-dim)]">
                            Queue a stream or select an existing job.
                        </div>
                    ) : (
                        <div className="mt-5 space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                    <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Phase</div>
                                    <div className="mt-2 text-lg font-semibold text-white">{selectedJob.phase || selectedJob.status}</div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                    <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Output Prefix</div>
                                    <div className="mt-2 truncate font-mono text-sm text-white">{selectedJob.outputPrefix || selectedJob.plan?.output?.prefix || 'pending'}</div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Validation Checks</h3>
                                <div className="mt-3 grid gap-2">
                                    {(selectedJob.validation?.checks || selectedJob.plan?.validation?.rules?.map((rule) => ({ label: rule, status: 'pending' })) || []).map((check) => (
                                        <div key={check.id || check.label || check.rule} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                                            <span className="text-slate-300">{check.label || check.rule}</span>
                                            <span className={cx(
                                                'rounded-md border px-2 py-1 text-xs',
                                                check.status === 'passed' || check.status === 'cached'
                                                    ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                                    : check.status === 'failed'
                                                        ? 'border-rose-300/30 bg-rose-500/10 text-rose-200'
                                                        : 'border-amber-300/30 bg-amber-500/10 text-amber-200'
                                            )}>
                                                {check.status || 'pending'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Outputs</h3>
                                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                                    {(selectedJob.outputs || []).length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-[var(--hud-text-dim)]">Outputs appear after publishing.</div>
                                    ) : (
                                        selectedJob.outputs.map((output) => (
                                            <div key={`${output.profile}-${output.key}`} className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-sm last:border-b-0">
                                                <div className="min-w-0">
                                                    <div className="font-mono text-cyan-100">{output.profile}</div>
                                                    <div className="truncate text-xs text-slate-400">{output.key}</div>
                                                </div>
                                                {output.url && (
                                                    <a
                                                        href={output.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:border-cyan-300/40 hover:text-white"
                                                        title="Open output"
                                                    >
                                                        <ExternalLink size={15} />
                                                    </a>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Provenance</h3>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                        <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Engine</div>
                                        <div className="mt-2 truncate text-sm text-white">{selectedJob.provenance?.engine || 'agentcache-media-engine'}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                        <div className="text-xs uppercase tracking-wide text-[var(--hud-text-dim)]">Cache</div>
                                        <div className="mt-2 font-mono text-sm text-white">{shortId(selectedJob.cacheKey)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default MediaConsole;
