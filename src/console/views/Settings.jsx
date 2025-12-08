
import React, { useState } from 'react';
import { User, Key, Users, Bell, Shield, Wallet } from 'lucide-react';
import CyberCard from '../components/CyberCard';
import { useAuth } from '../auth/AuthContext';

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

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
                    {activeTab === 'profile' && <ProfileSettings user={user} />}
                    {activeTab === 'api' && <ApiSettings />}
                    {activeTab === 'team' && <TeamSettings />}
                    {activeTab === 'billing' && <BillingSettings />}
                </div>
            </div>
        </div>
    );
}

function ProfileSettings({ user }) {
    return (
        <div className="space-y-6">
            <CyberCard title="Personal Information" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                    <div className="space-y-2">
                        <label className="text-xs text-white/40 uppercase font-bold tracking-wider">Display Name</label>
                        <input
                            type="text"
                            defaultValue={user?.email?.split('@')[0] || 'Agent Architect'}
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

function ApiSettings() {
    return (
        <div className="space-y-6">
            <CyberCard title="Active API Keys" icon={Key}>
                <div className="p-2 space-y-4">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded border border-white/10">
                        <div>
                            <div className="font-mono text-cyan-400 font-bold">sk-live-8f92...9d2a</div>
                            <div className="text-xs text-white/40 mt-1">Created 2 days ago • Last used just now</div>
                        </div>
                        <button className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1.5 rounded bg-red-500/10">Revoke</button>
                    </div>
                    <button className="w-full py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2 font-bold text-sm">
                        <Key size={14} /> Generate New Key
                    </button>
                </div>
            </CyberCard>
        </div>
    );
}

function TeamSettings() {
    return (
        <CyberCard title="Team Members" icon={Users}>
            <div className="p-8 text-center text-white/40 text-sm font-mono">
                <Users size={32} className="mx-auto mb-4 opacity-50" />
                Invite functionality coming in v1.2
            </div>
        </CyberCard>
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
