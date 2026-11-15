
import React, { useState, useEffect } from 'react';
import { User, Key, Users, Bell, Shield, Wallet, Save, RefreshCw, Trash2, CheckCircle, Plus } from 'lucide-react';
import CyberCard from '../components/CyberCard.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Settings() {
    const { user, token, setSession } = useAuth();
    const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).has('invite') ? 'team' : 'profile');

    const TABS = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'api', label: 'API Keys', icon: Key },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'billing', label: 'Billing', icon: Wallet },
    ];

    return (
        <div className="flex flex-col h-full p-6 text-white overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold tracking-wide">Account Settings</h2>
                <div className="text-sm text-white/40 font-mono">ID: {user?.id?.substring(0, 8) || 'Unknown'}</div>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Sidebar Tabs */}
                <div className="w-64 flex flex-col gap-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                                ${activeTab === tab.id
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {activeTab === 'profile' && <ProfileSettings user={user} token={token} />}
                    {activeTab === 'api' && <ApiSettings user={user} token={token} />}
                    {activeTab === 'team' && <TeamSettings user={user} token={token} setSession={setSession} />}
                    {activeTab === 'billing' && <BillingSettings />}
                </div>
            </div>
        </div>
    );
}

function ProfileSettings({ user, token }) {
    const [displayName, setDisplayName] = useState(user?.displayName || 'Agent Architect');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'update_profile', displayName, email: user?.email })
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <CyberCard title="Personal Information" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                    <div className="space-y-2">
                        <label className="text-xs text-white/40 uppercase font-bold tracking-wider">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-white/40 uppercase font-bold tracking-wider">Email Address</label>
                        <input
                            type="email"
                            defaultValue={user?.email || 'user@example.com'}
                            disabled
                            className="w-full bg-white/5 border border-white/5 rounded px-3 py-2 text-white/50 cursor-not-allowed"
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all
                            ${success ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30'}
                        `}
                    >
                        {saving ? <RefreshCw className="animate-spin" size={16} /> : success ? <CheckCircle size={16} /> : <Save size={16} />}
                        {success ? 'Saved' : 'Save Changes'}
                    </button>
                </div>
            </CyberCard>

            <CyberCard title="Notifications" icon={Bell}>
                <div className="space-y-4 p-2">
                    <Toggle label="Security Alerts" desc="Login attempts and policy violations" defaultChecked />
                    <Toggle label="Weekly Digest" desc="Performance summary and efficiency report" defaultChecked />
                    <Toggle label="Product Updates" desc="New features and changelog" />
                </div>
            </CyberCard>
        </div>
    );
}

function ApiSettings({ user, token }) {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/settings?type=keys`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load API keys.');
            setKeys(data.keys || []);
            setError('');
        } catch (err) {
            setError(err.message || 'Could not load API keys.');
        }
        setLoading(false);
    };

    const createKey = async () => {
        setError(''); setMessage(''); setNewKey('');
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'create_key' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not create API key.');
            setNewKey(data.key.value);
            setMessage('Key created. Copy it now; it will not be shown again.');
            await fetchKeys();
        } catch (err) { setError(err.message || 'Could not create API key.'); }
    };

    const revokeKey = async (keyId) => {
        if (!confirm('Are you sure? This action cannot be undone.')) return;
        setError(''); setMessage('');
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'revoke_key', keyId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not revoke API key.');
            setMessage('API key revoked.');
            await fetchKeys();
        } catch (err) { setError(err.message || 'Could not revoke API key.'); }
    };

    useEffect(() => { fetchKeys(); }, []);

    return (
        <div className="space-y-6">
            <CyberCard title="Active API Keys" icon={Key}>
                <div className="p-2 space-y-4">
                    {error && <p role="alert" className="rounded border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                    {message && <p role="status" className="rounded border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</p>}
                    {newKey && <div className="rounded border border-cyan-300/20 bg-cyan-300/[.06] p-3"><label className="block text-xs text-cyan-100/70">Copy your new member key now</label><div className="mt-2 flex gap-2"><input readOnly value={newKey} className="min-w-0 flex-1 rounded bg-black/40 px-3 py-2 font-mono text-xs text-cyan-100" onFocus={(event) => event.target.select()} /><button onClick={async () => { try { await navigator.clipboard.writeText(newKey); setMessage('API key copied to clipboard.'); } catch { setMessage('Select and copy the key manually.'); } }} className="rounded border border-cyan-300/30 px-3 text-xs text-cyan-100">Copy</button></div><p className="mt-2 text-[11px] text-white/45">This key belongs to {user?.email || 'your account'} and is shown only once. Use it for individual approvals and revoke it here when no longer needed.</p></div>}
                    {loading ? (
                        <div className="text-white/40 text-center py-4">Loading keys...</div>
                    ) : keys.length === 0 ? (
                        <div className="text-white/40 text-center py-4">No active keys found.</div>
                    ) : (
                        keys.map(k => (
                            <div key={k.id} className="flex justify-between items-center bg-white/5 p-4 rounded border border-white/10">
                                <div>
                                    <div className="font-mono text-cyan-400 font-bold">{k.value}</div>
                                    <div className="text-xs text-white/40 mt-1">Created {new Date(k.created).toLocaleDateString()}</div>
                                </div>
                                <button onClick={() => revokeKey(k.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 flex items-center gap-1">
                                    <Trash2 size={12} /> Revoke
                                </button>
                            </div>
                        ))
                    )}

                    <button onClick={createKey} className="w-full py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2 font-bold text-sm">
                        <Plus size={14} /> Generate New Key
                    </button>
                </div>
            </CyberCard>
        </div>
    );
}

function TeamSettings({ user, token, setSession }) {
    const [members, setMembers] = useState([]);
    const [memberships, setMemberships] = useState([]);
    const [activeOrganizationId, setActiveOrganizationId] = useState(user?.orgId || '');
    const [invitations, setInvitations] = useState([]);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [inviteUrl, setInviteUrl] = useState('');
    const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const loadTeam = async () => {
        setLoading(true); setError('');
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [memberResponse, inviteResponse, membershipsResponse] = await Promise.all([
                fetch('/api/governance/members', { headers }),
                fetch('/api/governance/invitations', { headers }),
                fetch('/api/governance/memberships', { headers }),
            ]);
            const [memberData, inviteData, membershipsData] = await Promise.all([memberResponse.json(), inviteResponse.json(), membershipsResponse.json()]);
            if (!memberResponse.ok) throw new Error(memberData.error || 'Could not load team members.');
            if (!inviteResponse.ok) throw new Error(inviteData.error || 'Could not load invitations.');
            if (!membershipsResponse.ok) throw new Error(membershipsData.error || 'Could not load organizations.');
            setMembers(memberData.members || []);
            setInvitations(inviteData.invitations || []);
            setMemberships(membershipsData.memberships || []);
            setActiveOrganizationId(membershipsData.activeOrganizationId || '');
        } catch (err) { setError(err.message || 'Could not load team members.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadTeam(); }, [token]);

    const createInvitation = async (event) => {
        event.preventDefault(); setBusy(true); setError(''); setMessage(''); setInviteUrl('');
        try {
            const response = await fetch('/api/governance/invitations', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not create invitation.');
            setInviteUrl(data.inviteUrl);
            setEmail('');
            setMessage('Invitation created. Copy the link and share it with the invited person.');
            await loadTeam();
        } catch (err) { setError(err.message || 'Could not create invitation.'); }
        finally { setBusy(false); }
    };

    const cancelInvitation = async (id) => {
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch(`/api/governance/invitations/${encodeURIComponent(id)}`, {
                method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not cancel invitation.');
            setMessage('Invitation canceled. Its link can no longer be used.');
            await loadTeam();
        } catch (err) { setError(err.message || 'Could not cancel invitation.'); }
        finally { setBusy(false); }
    };

    const acceptInvitation = async () => {
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch('/api/governance/invitations/accept', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: inviteToken }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not accept invitation.');
            setSession({ token: data.token, user: data.user });
            setInviteToken('');
            window.history.replaceState({}, '', window.location.pathname);
            setMessage(`You joined ${data.organization || 'the organization'} as ${data.user.role}.`);
        } catch (err) { setError(err.message || 'Could not accept invitation.'); }
        finally { setBusy(false); }
    };

    const switchOrganization = async (organizationId) => {
        setBusy(true); setError(''); setMessage('');
        try {
            const response = await fetch('/api/governance/switch-organization', {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizationId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not switch organizations.');
            setSession({ token: data.token, user: data.user });
            setActiveOrganizationId(data.organization.id);
            setMessage(`Switched to ${data.organization.name}.`);
        } catch (err) { setError(err.message || 'Could not switch organizations.'); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-5">
            <CyberCard title="Team Members" icon={Users}>
                <div className="space-y-4 p-3">
                    {error && <p role="alert" className="rounded border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                    {message && <p role="status" className="rounded border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</p>}
                    {inviteToken && <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.05] p-4"><p className="text-sm font-medium text-cyan-100">You have a team invitation</p><p className="mt-1 text-xs text-white/55">Accepting changes your active organization and role to the invitation’s organization. The invite must match your signed-in email.</p><button disabled={busy} onClick={acceptInvitation} className="mt-3 rounded bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Accept invitation</button></div>}
                    {memberships.length > 1 && <label className="block text-xs text-white/55">Active organization<select value={activeOrganizationId} onChange={(event) => switchOrganization(event.target.value)} disabled={busy} className="mt-1 w-full rounded border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white">{memberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.name} · {membership.role}</option>)}</select></label>}
                    {loading ? <p role="status" className="text-sm text-white/50">Loading team…</p> : members.length ? <div className="space-y-2">{members.map((member) => <div key={member.id} className="flex items-center justify-between rounded border border-white/10 bg-white/[.03] px-3 py-2"><div><p className="text-sm text-white">{member.name || member.email}</p><p className="text-xs text-white/45">{member.email}</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize text-white/70">{member.role}</span></div>)}</div> : <p className="text-sm text-white/50">No team members found.</p>}
                    <form onSubmit={createInvitation} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-white">Invite a teammate</h3>
                        <p className="mt-1 text-xs text-white/45">Only organization owners and admins can invite. Links expire after seven days and can be canceled here.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                            <label className="text-xs text-white/60">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" placeholder="teammate@company.com" /></label>
                            <label className="text-xs text-white/60">Role<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select></label>
                            <button disabled={busy || !email.trim()} className="self-end rounded bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Create invite</button>
                        </div>
                        {inviteUrl && <div className="mt-3 rounded border border-cyan-300/20 bg-cyan-300/[.05] p-3"><label className="text-xs text-cyan-100/70">Share this private invite link</label><div className="mt-2 flex gap-2"><input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} className="min-w-0 flex-1 rounded bg-black/40 px-3 py-2 font-mono text-xs text-cyan-100" /><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); setMessage('Invite link copied.'); } catch { setMessage('Select and copy the invite link.'); } }} className="rounded border border-cyan-300/30 px-3 text-xs text-cyan-100">Copy link</button></div><p className="mt-2 text-[11px] text-amber-100/60">The link grants the selected role to the invited email. Share it only with that person.</p></div>}
                    </form>
                    {!!invitations.length && <div className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Pending invitations</h3>{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 px-3 py-2"><div><p className="text-sm text-white">{invitation.email} <span className="ml-1 capitalize text-white/50">· {invitation.role}</span></p><p className="text-xs text-white/40">Expires {new Date(invitation.expiresAt).toLocaleString()}</p></div><button disabled={busy} onClick={() => cancelInvitation(invitation.id)} className="rounded border border-rose-300/20 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50">Cancel</button></div>)}</div>}
                    <p className="text-[11px] text-white/40">Signed in as {user?.email || 'unknown account'}. Member API keys are personal and can be created in API Keys settings.</p>
                </div>
            </CyberCard>
        </div>
    );
}

function BillingSettings() {
    return (
        <CyberCard title="Pro Plan" icon={Wallet}>
            <div className="p-4 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-white/10 rounded mb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-lg font-bold text-white">AgentCache Pro</div>
                        <div className="text-sm text-white/60">$49/month</div>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500 rounded text-black font-bold text-xs uppercase">Active</div>
                </div>
            </div>
            <div className="text-center">
                <button className="text-white/60 hover:text-white text-sm underline">Manage Subscription & Invoices</button>
            </div>
        </CyberCard>
    );
}

function Toggle({ label, desc, defaultChecked }) {
    const [checked, setChecked] = useState(defaultChecked);
    return (
        <div className="flex justify-between items-center">
            <div>
                <div className="text-sm font-bold text-white">{label}</div>
                <div className="text-xs text-white/40">{desc}</div>
            </div>
            <button
                onClick={() => setChecked(!checked)}
                className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-cyan-500' : 'bg-white/10'}`}
            >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
    );
}

