import React, { useState, useEffect } from 'react';
import { FileText, Search, Activity, CheckCircle, AlertTriangle, Clock, Hash, Globe, Database, Monitor } from 'lucide-react';

type Receipt = {
    receiptId: string;
    issuedAt: string;
    producer: {
        system: string;
        id: string;
    };
    subject: {
        kind: string;
        id: string;
        ref?: string;
    };
    trust: {
        verdict: 'PASS' | 'REVIEW' | 'BLOCK' | 'INFO';
        confidence?: number;
    };
    operation: {
        action: string;
        statusCode?: number | string;
    };
};

type StoredReceipt = {
    receipt: Receipt;
    receiptHash: string;
    signatureStatus: string;
    ingestedAt: string;
};

export function ReceiptInspector() {
    const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [filters, setFilters] = useState({
        producerSystem: '',
        subjectKind: '',
        verdict: '',
    });
    const [selectedReceipt, setSelectedReceipt] = useState<StoredReceipt | null>(null);

    const readApiKey = () => {
        const candidates = [
            window.localStorage.getItem('agentcache_api_key'),
            window.localStorage.getItem('agentcache_latest_api_key'),
            window.localStorage.getItem('latestApiKeySecret'),
            window.localStorage.getItem('agentcache_token'),
        ];

        return candidates.find((value) => typeof value === 'string' && value.startsWith('ac_')) || '';
    };

    const exportEvidenceBundle = () => {
        if (!selectedReceipt) return;
        const bundle = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            content: selectedReceipt,
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evidence-bundle-${selectedReceipt.receipt.receiptId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const fetchReceipts = async () => {
        setLoading(true);
        setError('');
        try {
            const apiKey = readApiKey();
            if (!apiKey) {
                setReceipts([]);
                setSelectedReceipt(null);
                setError('Add an AgentCache API key in local storage to inspect protected receipts.');
                return;
            }

            const query = new URLSearchParams(filters as any).toString();
            const res = await fetch(`/api/receipts?${query}`, {
                headers: {
                    'X-API-Key': apiKey,
                },
            });
            const data = await res.json();
            if (data.success) {
                setReceipts(data.receipts);
                setSelectedReceipt((current) => data.receipts.find((item: StoredReceipt) => item.receipt.receiptId === current?.receipt.receiptId) || data.receipts[0] || null);
            } else {
                setReceipts([]);
                setSelectedReceipt(null);
                setError(data.error || 'Failed to load receipts.');
            }
        } catch (e) {
            console.error('Failed to fetch receipts', e);
            setReceipts([]);
            setSelectedReceipt(null);
            setError('Failed to fetch receipts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReceipts();
    }, [filters]);

    const getVerdictIcon = (verdict: string) => {
        switch (verdict) {
            case 'PASS': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case 'REVIEW': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
            case 'BLOCK': return <AlertTriangle className="w-4 h-4 text-rose-400" />;
            default: return <Activity className="w-4 h-4 text-cyan-400" />;
        }
    };

    const getSubjectIcon = (kind: string) => {
        if (kind.includes('STORAGE')) return <Database className="w-4 h-4" />;
        if (kind.includes('BROWSER')) return <Monitor className="w-4 h-4" />;
        if (kind.includes('API')) return <Globe className="w-4 h-4" />;
        return <FileText className="w-4 h-4" />;
    };

    return (
        <div className="flex flex-col h-full bg-slate-950/40 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-white font-medium">Receipt Inspector</h3>
                </div>
                <div className="flex gap-2">
                    <select 
                        className="bg-black/40 border border-white/10 rounded-lg text-xs text-white/70 px-2 py-1 outline-none focus:border-cyan-500/50"
                        value={filters.producerSystem}
                        onChange={(e) => setFilters({ ...filters, producerSystem: e.target.value })}
                    >
                        <option value="">All Systems</option>
                        <option value="AGENTCACHE">AgentCache</option>
                        <option value="JETTYAGENT">JettyAgent</option>
                        <option value="MAXXEVAL">MaxxEval</option>
                    </select>
                    <select 
                        className="bg-black/40 border border-white/10 rounded-lg text-xs text-white/70 px-2 py-1 outline-none focus:border-cyan-500/50"
                        value={filters.verdict}
                        onChange={(e) => setFilters({ ...filters, verdict: e.target.value })}
                    >
                        <option value="">All Verdicts</option>
                        <option value="PASS">Pass</option>
                        <option value="REVIEW">Review</option>
                        <option value="BLOCK">Block</option>
                    </select>
                </div>
            </div>

            {error ? (
                <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-200/80">
                    {error}
                </div>
            ) : null}

            <div className="flex-1 overflow-hidden flex">
                {/* List View */}
                <div className="w-1/2 border-r border-white/10 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading && receipts.length === 0 ? (
                        <div className="flex justify-center py-10">
                            <Activity className="w-6 h-6 text-cyan-500 animate-spin" />
                        </div>
                    ) : receipts.length === 0 ? (
                        <div className="text-center py-10 text-white/20 text-xs italic">No receipts found</div>
                    ) : (
                        receipts.map((r) => (
                            <button
                                key={r.receipt.receiptId}
                                onClick={() => setSelectedReceipt(r)}
                                className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
                                    selectedReceipt?.receipt.receiptId === r.receipt.receiptId 
                                    ? 'bg-cyan-500/10 border-cyan-500/40' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        {getSubjectIcon(r.receipt.subject.kind)}
                                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{r.receipt.subject.kind}</span>
                                    </div>
                                    {getVerdictIcon(r.receipt.trust.verdict)}
                                </div>
                                <p className="text-sm text-white truncate font-mono">{r.receipt.receiptId}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] text-white/30">{new Date(r.receipt.issuedAt).toLocaleTimeString()}</span>
                                    <span className="text-[10px] text-cyan-400 font-mono tracking-tighter">{r.receipt.producer.system}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Detail View */}
                <div className="w-1/2 overflow-y-auto custom-scrollbar p-6 bg-black/20">
                    {selectedReceipt ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 mb-6">
                                <div>
                                    <h4 className="text-white font-medium mb-1">Receipt Details</h4>
                                    <p className="text-[10px] text-white/40 font-mono break-all">{selectedReceipt.receipt.receiptId}</p>
                                </div>
                                <button 
                                    onClick={exportEvidenceBundle}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] uppercase font-bold tracking-widest hover:bg-cyan-500/30 transition-all"
                                >
                                    <FileText className="w-3 h-3" />
                                    Export Bundle
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <DetailItem label="Issued At" value={new Date(selectedReceipt.receipt.issuedAt).toLocaleString()} icon={<Clock className="w-3 h-3" />} />
                                <DetailItem label="System" value={selectedReceipt.receipt.producer.system} icon={<Globe className="w-3 h-3" />} />
                                <DetailItem label="Verdict" value={selectedReceipt.receipt.trust.verdict} icon={getVerdictIcon(selectedReceipt.receipt.trust.verdict)} />
                                <DetailItem label="Conf" value={selectedReceipt.receipt.trust.confidence ? `${(selectedReceipt.receipt.trust.confidence * 100).toFixed(1)}%` : 'n/a'} icon={<Activity className="w-3 h-3" />} />
                            </div>

                            <div className="space-y-4">
                                <Section label="Subject">
                                    <pre className="text-[11px] text-cyan-300/80 bg-black/40 p-3 rounded-lg overflow-x-auto">
                                        {JSON.stringify(selectedReceipt.receipt.subject, null, 2)}
                                    </pre>
                                </Section>
                                <Section label="Operation">
                                    <pre className="text-[11px] text-emerald-300/80 bg-black/40 p-3 rounded-lg overflow-x-auto">
                                        {JSON.stringify(selectedReceipt.receipt.operation, null, 2)}
                                    </pre>
                                </Section>
                                <Section label="Payload Integrity">
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                                        <Hash className="w-3 h-3" />
                                        <span className="truncate">{selectedReceipt.receiptHash}</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${selectedReceipt.signatureStatus === 'verified' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <span className="text-[10px] uppercase font-bold text-white/60 tracking-widest">
                                            Signature {selectedReceipt.signatureStatus}
                                        </span>
                                    </div>
                                </Section>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                            <Search className="w-12 h-12 opacity-20" />
                            <p className="text-sm italic">Select a receipt to view evidence details</p>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </div>
    );
}

function DetailItem({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-[9px] uppercase font-bold text-white/30 tracking-widest">{label}</span>
            </div>
            <p className="text-xs text-white font-mono truncate">{value}</p>
        </div>
    );
}

function Section({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div>
            <h5 className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-2 px-1">{label}</h5>
            {children}
        </div>
    );
}
