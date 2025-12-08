
import React, { useState, useEffect } from 'react';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    Lock,
    Eye,
    FileText,
    Gavel
} from 'lucide-react';
import CyberCard from '../components/CyberCard';
import DataGrid from '../components/DataGrid';
import StatDial from '../components/StatDial';

export default function Governance() {
    const [stats, setStats] = useState({
        trustScore: 98,
        piiBlocked: 142,
        biasDetected: 3,
        auditsPassed: 850
    });

    const [policyLog, setPolicyLog] = useState([]);

    useEffect(() => {
        // Mock Data Loading
        setPolicyLog([
            { id: 101, type: 'PII_REDACT', severity: 'HIGH', content: 'SSN detected in prompt', source: 'Triage-Bot-1', time: '10:42 AM' },
            { id: 102, type: 'TOPIC_GUARD', severity: 'MEDIUM', content: 'Blocked "Political Advice"', source: 'Chat-v2', time: '10:38 AM' },
            { id: 103, type: 'DATA_LEAK', severity: 'CRITICAL', content: 'API Key pattern in output', source: 'Dev-Agent', time: '10:15 AM' },
            { id: 104, type: 'AUDIT_PASS', severity: 'LOW', content: 'Routine safety scan complete', source: 'System', time: '09:00 AM' },
        ]);
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Gavel className="text-[var(--hud-accent)]" />
                        GOVERNANCE COUNCIL
                    </h1>
                    <p className="text-xs text-[var(--hud-text-dim)] font-mono mt-1">
                        ETHICS OVERSIGHT & POLICY ENFORCEMENT
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-cyber px-4 py-2 text-xs flex items-center gap-2">
                        <FileText size={14} /> EXPORT AUDIT LOG
                    </button>
                    <button className="btn-cyber btn-cyber-primary px-4 py-2 text-xs flex items-center gap-2">
                        <Shield size={14} /> POLICY CONFIG
                    </button>
                </div>
            </div>

            {/* Vitals Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <CyberCard className="border-l-4 border-l-[var(--hud-success)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">Trust Score</div>
                            <div className="text-3xl font-bold font-mono text-green-400">{stats.trustScore}/100</div>
                        </div>
                        <CheckCircle size={20} className="text-green-400" />
                    </div>
                </CyberCard>

                <CyberCard className="border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">PII Redacted</div>
                            <div className="text-3xl font-bold font-mono text-white">{stats.piiBlocked}</div>
                        </div>
                        <Lock size={20} className="text-red-500" />
                    </div>
                </CyberCard>

                <CyberCard className="border-l-4 border-l-yellow-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">Bias Warnings</div>
                            <div className="text-3xl font-bold font-mono text-white">{stats.biasDetected}</div>
                        </div>
                        <AlertTriangle size={20} className="text-yellow-500" />
                    </div>
                </CyberCard>

                <CyberCard className="border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">Audits Passed</div>
                            <div className="text-3xl font-bold font-mono text-white">{stats.auditsPassed}</div>
                        </div>
                        <Eye size={20} className="text-blue-500" />
                    </div>
                </CyberCard>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Active Policies */}
                <CyberCard title="Safety Protocols" icon={Shield} className="h-full">
                    <div className="space-y-3">
                        {[
                            { name: "HIPAA Guard", status: "Active", level: "Strict" },
                            { name: "Topic Fence", status: "Active", level: "Custom" },
                            { name: "Rate Limiter", status: "Active", level: "Standard" },
                            { name: "Hallucination Check", status: "Beta", level: "Low" }
                        ].map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/10">
                                <div>
                                    <div className="font-bold text-sm text-white">{p.name}</div>
                                    <div className="text-[10px] text-[var(--hud-text-dim)]">Level: {p.level}</div>
                                </div>
                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] rounded border border-green-500/30 uppercase">
                                    {p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </CyberCard>

                {/* Right: Violation Log */}
                <CyberCard title="Enforcement Log" icon={AlertTriangle} className="lg:col-span-2">
                    <DataGrid
                        columns={[
                            { header: 'Time', accessor: 'time' },
                            {
                                header: 'Severity', accessor: 'severity', render: (row) => (
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${row.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                                            row.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' :
                                                'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                        }`}>
                                        {row.severity}
                                    </span>
                                )
                            },
                            { header: 'Violation Type', accessor: 'type' },
                            { header: 'Agent Source', accessor: 'source' },
                            { header: 'Details', accessor: 'content', render: (row) => <span className="italic text-white/70">{row.content}</span> }
                        ]}
                        data={policyLog}
                    />
                </CyberCard>

            </div>
        </div>
    );
}
