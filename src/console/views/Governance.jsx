import React, { useState, useEffect } from 'react';

export default function Governance() {
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock data for now, replacing with real API call structure
        // In a real scenario, we would fetch from /api/organization
        setTimeout(() => {
            setOrg({
                name: 'Acme Corp',
                id: 'org_123456789',
                plan: 'Professional',
                role: 'Owner',
                members: [
                    { id: 'u_1', name: 'Alice Admin', email: 'alice@acme.com', role: 'owner' },
                    { id: 'u_2', name: 'Bob Builder', email: 'bob@acme.com', role: 'member' },
                    { id: 'u_3', name: 'Charlie Cache', email: 'charlie@acme.com', role: 'viewer' },
                ],
                apiKeys: [
                    { prefix: 'ac_live_', created: '2025-11-01', scopes: ['cache:read', 'cache:write'] },
                    { prefix: 'ac_test_', created: '2025-11-15', scopes: ['cache:read'] },
                ]
            });
            setLoading(false);
        }, 800);
    }, []);

    if (loading) return <div className="p-8 text-slate-400">Loading governance data...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Governance</h2>
                <p className="text-slate-400">Organization settings, access control, and security policies</p>
            </header>

            {/* Organization Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-white">{org.name}</h3>
                            <div className="text-sm text-slate-500 font-mono mt-1">ID: {org.id}</div>
                        </div>
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold border border-purple-500/30">
                            {org.plan.toUpperCase()} PLAN
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500 mb-1">Your Role</div>
                            <div className="font-semibold text-green-400">{org.role}</div>
                        </div>
                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500 mb-1">Region</div>
                            <div className="font-semibold text-white">US-East (N. Virginia)</div>
                        </div>
                    </div>
                </div>

                {/* Compliance Status */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Compliance</h3>
                    <div className="space-y-3">
                        <ComplianceItem label="SOC 2 Type II" status="active" />
                        <ComplianceItem label="GDPR" status="active" />
                        <ComplianceItem label="HIPAA" status="pending" />
                    </div>
                </div>
            </div>

            {/* Members & Roles */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Team Members</h3>
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors">
                        Invite Member
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                                <th className="pb-3 pl-2">User</th>
                                <th className="pb-3">Role</th>
                                <th className="pb-3">2FA</th>
                                <th className="pb-3 text-right pr-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {org.members.map(member => (
                                <tr key={member.id} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 pl-2">
                                        <div className="font-medium text-white">{member.name}</div>
                                        <div className="text-slate-500">{member.email}</div>
                                    </td>
                                    <td className="py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                      ${member.role === 'owner' ? 'bg-purple-500/10 text-purple-400' :
                                                member.role === 'admin' ? 'bg-blue-500/10 text-blue-400' :
                                                    'bg-slate-700/50 text-slate-400'}`}>
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <span className="text-green-400">Enabled</span>
                                    </td>
                                    <td className="py-3 text-right pr-2">
                                        <button className="text-slate-500 hover:text-white">•••</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* API Keys */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Active API Keys</h3>
                <div className="space-y-3">
                    {org.apiKeys.map((key, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-slate-400">
                                    🔑
                                </div>
                                <div>
                                    <div className="font-mono text-sm text-white">{key.prefix}****************</div>
                                    <div className="text-xs text-slate-500">Created {key.created}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {key.scopes.map(scope => (
                                    <span key={scope} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700">
                                        {scope}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ComplianceItem({ label, status }) {
    const colors = {
        active: 'bg-green-500',
        pending: 'bg-yellow-500',
        inactive: 'bg-slate-500'
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">{label}</span>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors[status]}`}></span>
                <span className="text-xs text-slate-500 capitalize">{status}</span>
            </div>
        </div>
    );
}
