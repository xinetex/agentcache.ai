import React, { useEffect, useState } from 'react';
import { ShieldCheck, Database, BookOpenText, Radar } from 'lucide-react';

type Offer = {
    id: string;
    name: string;
    tagline: string;
    buyer: string;
    outcome: string;
    tier: 'free' | 'pro' | 'enterprise';
    launchPriority: number;
    pricingHint: string;
};

type RevenueCorePayload = {
    thesis: string;
    mode: string;
    recommendedLaunchWedge: string;
    offers: Offer[];
};

function iconFor(id: string) {
    if (id === 'agentcache-core') return <Database className="w-4 h-4 text-cyan-300" />;
    if (id === 'agentcache-guardrails') return <ShieldCheck className="w-4 h-4 text-emerald-300" />;
    if (id === 'agentcache-knowledge') return <BookOpenText className="w-4 h-4 text-amber-300" />;
    return <Radar className="w-4 h-4 text-rose-300" />;
}

function tierTone(tier: Offer['tier']) {
    if (tier === 'enterprise') return 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20';
    if (tier === 'pro') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
    return 'bg-white/10 text-white/70 border-white/10';
}

export function RevenueCorePanel() {
    const [data, setData] = useState<RevenueCorePayload | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch('/api/catalog/revenue-core');
                const json = await res.json();
                if (!cancelled) setData(json);
            } catch (error) {
                console.error('Failed to load revenue core', error);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="p-6 bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950 rounded-2xl border border-cyan-500/20 backdrop-blur-xl group hover:border-cyan-400/35 transition-all duration-700">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg tracking-tight group-hover:text-cyan-300 transition-colors">Revenue Core</h3>
                    <p className="text-white/40 text-xs uppercase tracking-widest mt-1">What AgentCache can realistically sell now</p>
                </div>
                <div className="px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-mono">
                    SELLABLE
                </div>
            </div>

            {!data ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-xs text-white/40">
                    Loading revenue core offers...
                </div>
            ) : (
                <>
                    <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4 mb-4">
                        <div className="text-[10px] uppercase tracking-widest text-cyan-300 mb-2">Recommended Wedge</div>
                        <div className="text-white font-semibold">{data.recommendedLaunchWedge}</div>
                        <div className="text-xs text-white/50 mt-1">{data.thesis}</div>
                    </div>

                    <div className="space-y-3">
                        {data.offers.map((offer) => (
                            <div key={offer.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        {iconFor(offer.id)}
                                        <div>
                                            <div className="text-sm font-semibold text-white">{offer.name}</div>
                                            <div className="text-[11px] text-white/45">{offer.tagline}</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-widest font-mono ${tierTone(offer.tier)}`}>
                                        {offer.tier}
                                    </span>
                                </div>
                                <div className="text-[11px] text-white/55 mb-1">Buyer: {offer.buyer}</div>
                                <div className="text-[11px] text-emerald-200/85">{offer.outcome}</div>
                                <div className="text-[10px] text-cyan-200/65 mt-2">{offer.pricingHint}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
