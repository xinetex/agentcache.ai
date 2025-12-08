import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shield, ArrowRight, UserPlus, Building2, Key } from 'lucide-react';
import CyberCard from './CyberCard';

export default function RegisterOverlay() {
    const { login } = useAuth(); // We'll need a register function in AuthContext later
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        orgName: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Registration failed');

            // Auto-login on success
            await login(formData.email, formData.password);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-lg p-6 relative">
                {/* Decorative Grid Background */}
                <div className="absolute inset-0 bg-[url('/assets/grid.svg')] opacity-10 pointer-events-none"></div>

                <CyberCard
                    title="IDENTITY PROTOCOL // NEW OPERATOR"
                    icon={UserPlus}
                    className="border-[var(--hud-accent)] shadow-[0_0_50px_rgba(0,243,255,0.15)] relative z-10"
                >
                    <form onSubmit={handleSubmit} className="space-y-6 mt-6">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-mono text-[var(--hud-text-dim)] mb-1">OPERATOR DESIGNATION (NAME)</label>
                                <div className="relative group">
                                    <Shield className="absolute left-3 top-3 text-[var(--hud-text-dim)] w-4 h-4 group-focus-within:text-[var(--hud-accent)] transition-colors" />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/50 border border-[var(--hud-border)] rounded pl-10 p-2.5 text-sm text-white focus:border-[var(--hud-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-accent)] transition-all font-mono"
                                        placeholder="ALICE W."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-[10px] font-mono text-[var(--hud-text-dim)] mb-1">COMM LINK (EMAIL)</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-3 text-[var(--hud-text-dim)]">@</div>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-black/50 border border-[var(--hud-border)] rounded pl-10 p-2.5 text-sm text-white focus:border-[var(--hud-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-accent)] transition-all font-mono"
                                        placeholder="alice@agentcache.ai"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-[10px] font-mono text-[var(--hud-text-dim)] mb-1">SECTOR ID (ORGANIZATION)</label>
                                <div className="relative group">
                                    <Building2 className="absolute left-3 top-3 text-[var(--hud-text-dim)] w-4 h-4 group-focus-within:text-[var(--hud-accent)] transition-colors" />
                                    <input
                                        type="text"
                                        value={formData.orgName}
                                        onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                        className="w-full bg-black/50 border border-[var(--hud-border)] rounded pl-10 p-2.5 text-sm text-white focus:border-[var(--hud-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-accent)] transition-all font-mono"
                                        placeholder="ACME CORP."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-[10px] font-mono text-[var(--hud-text-dim)] mb-1">ACCESS KEY (PASSWORD)</label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-3 text-[var(--hud-text-dim)] w-4 h-4 group-focus-within:text-[var(--hud-accent)] transition-colors" />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-black/50 border border-[var(--hud-border)] rounded pl-10 p-2.5 text-sm text-white focus:border-[var(--hud-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--hud-accent)] transition-all font-mono"
                                        placeholder="••••••••••••"
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-500 text-[10px] font-mono border border-red-500/50 bg-red-900/10 p-2 rounded flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                ERROR: {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[var(--hud-accent)] text-black font-bold font-mono text-sm tracking-wider rounded hover:bg-white transition-all flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <span className="animate-pulse">TOKENIZING IDENTITY...</span>
                            ) : (
                                <>
                                    INITIALIZE UPLINK <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="text-center text-[10px] text-[var(--hud-text-dim)] font-mono mt-4">
                            ALREADY INITIALIZED? <button type="button" onClick={() => window.location.href = '/console?demo=false'} className="text-[var(--hud-accent)] hover:underline border-b border-[var(--hud-accent)]">ACCESS TERMINAL (LOGIN)</button>
                        </div>
                    </form>
                </CyberCard>
            </div>
        </div>
    );
}
