
import React, { useState } from 'react';
import {
    Book,
    Share2,
    ShieldCheck,
    GitFork,
    ThumbsUp,
    Eye,
    Clock,
    User,
    Tag,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';
import CyberCard from '../components/CyberCard';

export default function WikiPage({ nodeId, onClose }) {
    // Mock Data for a "Pattern" Article
    const article = {
        title: "HIPAA-Compliant Clinical Triage",
        author: "Dr. Sarah Watts",
        trustScore: 98,
        views: "12.4k",
        forks: 342,
        lastUpdated: "2h ago",
        tags: ["Healthcare", "Privacy", "Triage", "L3-Cache"],
        description: "A robust caching pattern for handling patient symptom descriptions. Includes automatic PII redaction for MRN and SSN, and maps symptoms to SNOMED CT codes.",
        schema: `{
  "input": "Patient symptom text",
  "output": "JSON: { triage_level, suggested_specialty, snomed_codes[] }",
  "constraints": ["No PII", "Max latency 200ms"]
}`,
        governance: {
            status: "VERIFIED",
            auditor: "MedicalBoard_Bot_v2",
            notes: "Passed all safety checks. Zero hallucination rate in last 10k calls."
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-none">
            {/* Slide-over Panel */}
            <div className="w-[600px] h-full bg-[rgba(6,11,20,0.95)] backdrop-blur-xl border-l border-[var(--hud-border)] flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300 shadow-[-50px_0_100px_rgba(0,0,0,0.5)]">

                {/* Header */}
                <div className="p-6 border-b border-[var(--hud-border)] flex justify-between items-start bg-[rgba(0,243,255,0.02)]">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--hud-accent)]/10 text-[var(--hud-accent)] border border-[var(--hud-accent)]/30 font-mono">
                                PATTERN #{nodeId || '8492'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
                                <ShieldCheck size={10} /> {article.governance.status}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-white font-['Rajdhani'] tracking-wide">{article.title}</h1>
                        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[var(--hud-accent)]">
                            <img src="/cpu_icon.png" className="w-3 h-3 opacity-70" alt="" />
                            <span>SYNTHESIZED BY AGENT: {article.author}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--hud-text-dim)] hover:text-white transition-colors">
                        Close
                    </button>
                </div>

                {/* Content Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Meta Stats */}
                    <div className="flex gap-4 text-xs text-[var(--hud-text-dim)] font-mono border-b border-[var(--hud-border)] pb-6">
                        <div className="flex items-center gap-1.5"><Eye size={14} /> {article.views} Hits</div>
                        <div className="flex items-center gap-1.5"><GitFork size={14} /> {article.forks} Active Clones</div>
                        <div className="flex items-center gap-1.5"><Clock size={14} /> Last Opt: {article.lastUpdated}</div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Book size={16} className="text-[var(--hud-accent)]" />
                            ABSTRACT
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed bg-black/20 p-4 rounded border border-[var(--hud-border)]">
                            {article.description}
                        </p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                        {article.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--hud-accent-secondary)]/10 text-[var(--hud-accent-secondary)] text-xs border border-[var(--hud-accent-secondary)]/30">
                                <Tag size={10} /> {tag}
                            </span>
                        ))}
                    </div>

                    {/* Governance Card */}
                    <CyberCard className="border-l-4 border-l-green-500 bg-green-900/5">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-green-400 flex items-center gap-2">
                                <CheckCircle size={16} /> GOVERNANCE REPORT
                            </h4>
                            <span className="text-xs font-mono text-green-500/50">ID: AUDIT-992</span>
                        </div>
                        <p className="text-xs text-green-300/80 mb-3">{article.governance.notes}</p>
                        <div className="w-full bg-green-900/30 h-1.5 rounded-full overflow-hidden">
                            <div className="w-[98%] bg-green-500 h-full"></div>
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] font-mono text-green-500">
                            <span>SAFETY SCORE</span>
                            <span>{article.trustScore}/100</span>
                        </div>
                    </CyberCard>

                    {/* Technical Schema */}
                    <div>
                        <h3 className="text-sm font-bold text-white mb-2 font-mono">I/O SCHEMA</h3>
                        <pre className="bg-black border border-[var(--hud-border)] rounded p-4 text-[10px] font-mono text-[var(--hud-accent)] overflow-x-auto">
                            {article.article?.schema || article.schema}
                        </pre>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-[var(--hud-border)] bg-[rgba(0,0,0,0.4)] flex gap-3">
                    <button className="flex-1 btn-cyber px-4 py-3 flex items-center justify-center gap-2 font-bold text-sm">
                        <ThumbsUp size={16} /> VOTE ({article.trustScore})
                    </button>
                    <button className="flex-1 btn-cyber btn-cyber-primary px-4 py-3 flex items-center justify-center gap-2 font-bold text-sm text-[var(--hud-bg)]">
                        <GitFork size={16} /> FORK PATTERN
                    </button>
                </div>

            </div>
        </div>
    );
}
